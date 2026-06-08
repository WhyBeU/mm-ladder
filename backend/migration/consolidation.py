from collections import defaultdict
from dataclasses import dataclass
from itertools import combinations

import click
from sqlalchemy import or_
from sqlalchemy.orm import Session

from mm_ladder.logger import get_logger
from mm_ladder.models.match import Match
from mm_ladder.models.player import Player
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.services.player_matching import name_tokens, normalize_player_name

log = get_logger("migration.consolidation")


def _is_initial_of(initial_tokens: list[str], full_tokens: list[str]) -> bool:
    """True if `initial_tokens` is a single-letter token standing in as an
    initial for the first surname token of `full_tokens` (e.g. ["c"] for
    ["cengarle", "barilari"]).

    Only matches when the *entire* remaining name is reduced to one letter —
    a lone single-letter fragment inside a longer compound surname (e.g. the
    "o" in "Tevardy-O'Neil" -> ["tevardy", "o", "neil"]) is not an initial.
    """
    return len(initial_tokens) == 1 and len(initial_tokens[0]) == 1 and full_tokens[0].startswith(initial_tokens[0])


def _are_likely_variants(tokens_a: list[str], tokens_b: list[str]) -> bool:
    """True if two surname-token lists look like spellings of the same name.

    Covers exact matches (punctuation-only differences already collapsed by
    name_tokens), shared tokens (e.g. a shared hyphenated surname), and a
    lone initial standing in for a full surname (e.g. "C" vs "Cengarle Barilari").
    """
    if not tokens_a or not tokens_b:
        return True
    if set(tokens_a) & set(tokens_b):
        return True
    return _is_initial_of(tokens_a, tokens_b) or _is_initial_of(tokens_b, tokens_a)


def _connected_groups(pairs: list[tuple[Player, Player]]) -> list[list[Player]]:
    """Merge pairwise candidate matches into connected groups via union-find,
    so that A~B and B~C produce a single {A, B, C} group."""
    parent: dict[int, int] = {}

    def find(player_id: int) -> int:
        parent.setdefault(player_id, player_id)
        while parent[player_id] != player_id:
            parent[player_id] = parent[parent[player_id]]
            player_id = parent[player_id]
        return player_id

    def union(a: int, b: int) -> None:
        root_a, root_b = find(a), find(b)
        if root_a != root_b:
            parent[root_a] = root_b

    by_identity: dict[int, Player] = {}
    for player_a, player_b in pairs:
        by_identity[id(player_a)] = player_a
        by_identity[id(player_b)] = player_b
        union(id(player_a), id(player_b))

    grouped: dict[int, list[Player]] = defaultdict(list)
    for identity, player in by_identity.items():
        grouped[find(identity)].append(player)

    return list(grouped.values())


def find_candidate_groups(players: list[Player]) -> list[list[Player]]:
    """Find groups of players whose names look like alternate spellings of the
    same person.

    Players are bucketed by their first name token (accent/punctuation-folded),
    then paired within each bucket when their remaining (surname) tokens are
    identical, overlap, or one is a prefix/subset of the other. Pairs are then
    merged into connected groups so a 3-way match (e.g. a full name, an accented
    short form, and an initial) forms one group rather than separate pairs.

    This is intentionally permissive — it surfaces likely-unrelated pairs (e.g.
    two different people who share a surname) too, for a human to reject.
    """
    by_first_name: dict[str, list[Player]] = defaultdict(list)
    for player in players:
        tokens = name_tokens(player.display_name)
        if tokens:
            by_first_name[tokens[0]].append(player)

    pairs: list[tuple[Player, Player]] = []
    for members in by_first_name.values():
        if len(members) < 2:
            continue
        for player_a, player_b in combinations(members, 2):
            rest_a = name_tokens(player_a.display_name)[1:]
            rest_b = name_tokens(player_b.display_name)[1:]
            if _are_likely_variants(rest_a, rest_b):
                pairs.append((player_a, player_b))

    return _connected_groups(pairs)


def select_survivor(group: list[Player]) -> Player:
    """Pick the canonical player for a group: the longest display_name (assumed
    most complete/unique), tie-broken by earliest created_at."""
    return min(group, key=lambda p: (-len(p.display_name), p.created_at))


@dataclass
class Conflict:
    """A pair within a candidate group that cannot be merged without violating
    a database constraint."""

    player_a: Player
    player_b: Player
    description: str


def find_conflicts(session: Session, group: list[Player]) -> list[Conflict]:
    """Find pairs in a candidate group that cannot be merged because doing so
    would violate a database constraint:

    - both played in the same tournament (would violate uq_tp_tournament_player)
    - they faced each other in a match (would violate ck_match_different_players)
    """
    conflicts: list[Conflict] = []
    player_ids = [player.id for player in group]
    by_id = {player.id: player for player in group}

    participations = (
        session.query(TournamentParticipant.player_id, Tournament.name)
        .join(Tournament, Tournament.id == TournamentParticipant.tournament_id)
        .filter(TournamentParticipant.player_id.in_(player_ids))
        .all()
    )
    by_tournament: dict[str, list[int]] = defaultdict(list)
    for player_id, tournament_name in participations:
        by_tournament[tournament_name].append(player_id)
    for tournament_name, ids in by_tournament.items():
        for id_a, id_b in combinations(sorted(set(ids)), 2):
            conflicts.append(Conflict(by_id[id_a], by_id[id_b], f'both played in "{tournament_name}"'))

    matches = (
        session.query(Match.player_a_id, Match.player_b_id, Tournament.name)
        .join(Tournament, Tournament.id == Match.tournament_id)
        .filter(Match.player_a_id.in_(player_ids), Match.player_b_id.in_(player_ids))
        .all()
    )
    for player_a_id, player_b_id, tournament_name in matches:
        conflicts.append(
            Conflict(by_id[player_a_id], by_id[player_b_id], f'faced each other in "{tournament_name}"')
        )

    return conflicts


@dataclass
class MergePlan:
    """The computed result of merging a candidate group: who survives, who is
    merged away, what aliases the survivor gains, and how many rows need
    repointing."""

    survivor: Player
    merged: list[Player]
    new_aliases: list[str]
    participant_count: int
    match_count: int


def plan_merge(session: Session, group: list[Player]) -> MergePlan:
    """Compute the merge plan for a (conflict-free) candidate group without
    making any changes."""
    survivor = select_survivor(group)
    merged = [player for player in group if player.id != survivor.id]
    merged_ids = [player.id for player in merged]

    known = {survivor.display_name, *survivor.aliases}
    new_aliases = [player.display_name for player in merged if player.display_name not in known]

    participant_count = (
        session.query(TournamentParticipant).filter(TournamentParticipant.player_id.in_(merged_ids)).count()
    )
    match_count = (
        session.query(Match)
        .filter(or_(Match.player_a_id.in_(merged_ids), Match.player_b_id.in_(merged_ids)))
        .count()
    )
    return MergePlan(survivor, merged, new_aliases, participant_count, match_count)


def execute_merge(session: Session, plan: MergePlan) -> None:
    """Apply a merge plan: record aliases, repoint tournament_participant and
    match references to the survivor, and delete the merged-away player rows."""
    survivor = plan.survivor
    merged_ids = [player.id for player in plan.merged]

    survivor.aliases = [*survivor.aliases, *plan.new_aliases]

    session.query(TournamentParticipant).filter(TournamentParticipant.player_id.in_(merged_ids)).update(
        {TournamentParticipant.player_id: survivor.id}, synchronize_session="fetch"
    )
    session.query(Match).filter(Match.player_a_id.in_(merged_ids)).update(
        {Match.player_a_id: survivor.id}, synchronize_session="fetch"
    )
    session.query(Match).filter(Match.player_b_id.in_(merged_ids)).update(
        {Match.player_b_id: survivor.id}, synchronize_session="fetch"
    )

    for player in plan.merged:
        session.expire(player)
        session.delete(player)
    session.flush()
    log.info(
        "merged players",
        survivor=survivor.display_name,
        merged=[player.display_name for player in plan.merged],
    )


def _describe_player(player: Player, *, is_survivor: bool) -> str:
    marker = "  <- proposed survivor" if is_survivor else ""
    events = len(player.participations)
    return f"{player.display_name} ({events} events, created {player.created_at:%Y-%m-%d}){marker}"


def _print_plan(plan: MergePlan) -> None:
    click.echo(f'  Plan: keep "{plan.survivor.display_name}" (id={plan.survivor.id})')
    click.echo(f"    new aliases: {plan.new_aliases}")
    click.echo(f"    repoint {plan.participant_count} tournament participation row(s)")
    click.echo(f"    repoint {plan.match_count} match row(s)")
    click.echo(f"    delete player row(s): {[player.display_name for player in plan.merged]}")


def review_group(session: Session, label: str, group: list[Player], *, dry_run: bool) -> None:
    """Print a candidate group, preview its merge plan, and — unless this is a dry run —
    let the operator exclude members, skip the group, or apply the merge."""
    click.echo(f"\n{label}:")
    survivor = select_survivor(group)
    for index, player in enumerate(group, start=1):
        click.echo(f"  [{index}] {_describe_player(player, is_survivor=player.id == survivor.id)}")

    conflicts = find_conflicts(session, group)
    if conflicts:
        click.echo("  Skipped — merging would violate database constraints:")
        for conflict in conflicts:
            click.echo(
                f"    {conflict.player_a.display_name} & {conflict.player_b.display_name}: {conflict.description}"
            )
        return

    if dry_run:
        plan = plan_merge(session, group)
        _print_plan(plan)
        click.echo("  (dry run — no changes made)")
        return

    raw = click.prompt(
        "  Exclude any from this merge? (comma-separated numbers, blank = merge all, 's' = skip group)",
        default="",
        show_default=False,
    )
    choice = raw.strip().lower()
    if choice == "s":
        click.echo("  Skipped.")
        return

    excluded: set[int] = set()
    if choice:
        try:
            excluded = {int(part.strip()) for part in choice.split(",") if part.strip()}
        except ValueError:
            click.echo("  Invalid input — skipping group.")
            return

    remaining = [player for index, player in enumerate(group, start=1) if index not in excluded]
    if len(remaining) < 2:
        click.echo("  Fewer than 2 players remain — skipping group.")
        return

    plan = plan_merge(session, remaining)
    _print_plan(plan)

    if not click.confirm("  Apply this merge?", default=False):
        click.echo("  Skipped.")
        return

    execute_merge(session, plan)
    session.commit()
    click.echo("  Merged.")


def run_auto_consolidation(session: Session, *, dry_run: bool) -> None:
    """Detect candidate duplicate groups and walk the operator through each one."""
    players = session.query(Player).all()
    groups = find_candidate_groups(players)
    if not groups:
        click.echo("No candidate duplicate groups found.")
        return

    click.echo(f"Found {len(groups)} candidate group(s).")
    for index, group in enumerate(groups, start=1):
        review_group(session, f"Group {index}", group, dry_run=dry_run)


def run_select_consolidation(session: Session, *, select_filter: str | None, dry_run: bool) -> None:
    """Let the operator browse the roster and manually build merge groups."""
    target = normalize_player_name(select_filter) if select_filter else None
    while True:
        players = session.query(Player).order_by(Player.display_name).all()
        if target:
            players = [player for player in players if normalize_player_name(player.display_name).startswith(target)]
        if not players:
            click.echo("No players match the given filter.")
            return

        click.echo("\nPlayers:")
        for index, player in enumerate(players, start=1):
            click.echo(f"  [{index}] {player.display_name} ({len(player.participations)} events)")

        raw = click.prompt("Enter 2+ numbers to merge (comma-separated), or blank to stop", default="", show_default=False)
        if not raw.strip():
            return

        try:
            indices = [int(part.strip()) for part in raw.split(",") if part.strip()]
            group = [players[index - 1] for index in indices]
        except (ValueError, IndexError):
            click.echo("Invalid selection — try again.")
            continue

        if len(group) < 2:
            click.echo("Select at least 2 players.")
            continue

        review_group(session, "Selected group", group, dry_run=dry_run)
