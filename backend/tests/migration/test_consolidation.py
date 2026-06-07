from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from mm_ladder.models.match import Match
from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant


def _player(display_name: str, *, created_offset: int = 0) -> Player:
    player = Player(display_name=display_name)
    player.created_at = datetime(2026, 1, 1) + timedelta(seconds=created_offset)
    return player


def _season(set_code: str) -> Season:
    return Season(
        name="Test Season",
        set_code=set_code,
        starts_on=datetime(2026, 1, 1).date(),
        ends_on=datetime(2026, 3, 1).date(),
        qualifier_count=0,
        qualifying_type="POINTS",
    )


def test_find_candidate_groups_groups_punctuation_variants() -> None:
    from migration.consolidation import find_candidate_groups

    a = _player("Alex Norton - Smith")
    b = _player("Alex Norton-Smith", created_offset=1)
    groups = find_candidate_groups([a, b])

    assert len(groups) == 1
    assert {p.display_name for p in groups[0]} == {"Alex Norton - Smith", "Alex Norton-Smith"}


def test_find_candidate_groups_groups_accent_and_partial_name_variants() -> None:
    from migration.consolidation import find_candidate_groups

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    initial = _player("Damian C", created_offset=2)
    groups = find_candidate_groups([full, accented, initial])

    assert len(groups) == 1
    assert {p.display_name for p in groups[0]} == {
        "Damian Cengarle Barilari",
        "Damián Cengarle",
        "Damian C",
    }


def test_find_candidate_groups_does_not_group_unrelated_players() -> None:
    from migration.consolidation import find_candidate_groups

    alice = _player("Alice Smith")
    bob = _player("Bob Jones", created_offset=1)
    groups = find_candidate_groups([alice, bob])

    assert groups == []


def test_select_survivor_picks_longest_display_name() -> None:
    from migration.consolidation import select_survivor

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    initial = _player("Damian C", created_offset=2)

    assert select_survivor([accented, initial, full]) is full


def test_select_survivor_breaks_ties_with_earliest_created_at() -> None:
    from migration.consolidation import select_survivor

    earlier = _player("Alex Norton-Smith", created_offset=0)
    later = _player("Alex Norton Smith", created_offset=10)

    assert select_survivor([later, earlier]) is earlier


def test_find_conflicts_detects_shared_tournament_participation(session: Session) -> None:
    from migration.consolidation import find_conflicts

    season = _season("tst")
    session.add(season)
    session.flush()
    tournament = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    session.add(tournament)
    session.flush()

    alice = _player("Alice Smith")
    alicia = _player("Alicia Smith", created_offset=1)
    session.add_all([alice, alicia])
    session.flush()
    session.add_all(
        [
            TournamentParticipant(tournament_id=tournament.id, player_id=alice.id),
            TournamentParticipant(tournament_id=tournament.id, player_id=alicia.id),
        ]
    )
    session.flush()

    conflicts = find_conflicts(session, [alice, alicia])
    assert len(conflicts) == 1
    assert "Week 1" in conflicts[0].description


def test_find_conflicts_detects_head_to_head_match(session: Session) -> None:
    from migration.consolidation import find_conflicts

    season = _season("tst")
    session.add(season)
    session.flush()
    tournament = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    session.add(tournament)
    session.flush()

    alice = _player("Alice Smith")
    alicia = _player("Alicia Smith", created_offset=1)
    session.add_all([alice, alicia])
    session.flush()
    session.add(Match(tournament_id=tournament.id, player_a_id=alice.id, player_b_id=alicia.id))
    session.flush()

    conflicts = find_conflicts(session, [alice, alicia])
    assert len(conflicts) == 1
    assert "Week 1" in conflicts[0].description


def test_find_conflicts_returns_empty_for_clean_group(session: Session) -> None:
    from migration.consolidation import find_conflicts

    alice = _player("Alice Smith")
    alicia = _player("Alicia Smith", created_offset=1)
    session.add_all([alice, alicia])
    session.flush()

    assert find_conflicts(session, [alice, alicia]) == []


def test_plan_merge_computes_aliases_and_counts(session: Session) -> None:
    from migration.consolidation import plan_merge

    season = _season("tst")
    session.add(season)
    session.flush()
    tournament = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    session.add(tournament)
    session.flush()

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    initial = _player("Damian C", created_offset=2)
    bystander = _player("Carol Lee", created_offset=3)
    session.add_all([full, accented, initial, bystander])
    session.flush()
    session.add_all(
        [
            TournamentParticipant(tournament_id=tournament.id, player_id=accented.id),
            Match(tournament_id=tournament.id, player_a_id=initial.id, player_b_id=bystander.id),
        ]
    )
    session.flush()

    plan = plan_merge(session, [full, accented, initial])

    assert plan.survivor is full
    assert {p.id for p in plan.merged} == {accented.id, initial.id}
    assert plan.new_aliases == ["Damián Cengarle", "Damian C"]
    assert plan.participant_count == 1
    assert plan.match_count == 1


def test_plan_merge_skips_already_known_aliases(session: Session) -> None:
    from migration.consolidation import plan_merge

    full = Player(display_name="Damian Cengarle Barilari", aliases=["Damian C"])
    full.created_at = datetime(2026, 1, 1)
    accented = _player("Damián Cengarle", created_offset=1)
    session.add_all([full, accented])
    session.flush()

    plan = plan_merge(session, [full, accented])
    assert plan.new_aliases == ["Damián Cengarle"]


def test_execute_merge_repoints_references_and_deletes_merged_players(session: Session) -> None:
    from migration.consolidation import execute_merge, plan_merge

    season = _season("tst")
    session.add(season)
    session.flush()
    week1 = Tournament(season_id=season.id, held_on=datetime(2026, 1, 5).date(), name="Week 1")
    week2 = Tournament(season_id=season.id, held_on=datetime(2026, 1, 12).date(), name="Week 2")
    session.add_all([week1, week2])
    session.flush()

    full = _player("Damian Cengarle Barilari")
    accented = _player("Damián Cengarle", created_offset=1)
    bystander = _player("Carol Lee", created_offset=2)
    session.add_all([full, accented, bystander])
    session.flush()
    session.add_all(
        [
            TournamentParticipant(tournament_id=week1.id, player_id=accented.id),
            Match(tournament_id=week2.id, player_a_id=accented.id, player_b_id=bystander.id),
        ]
    )
    session.flush()
    accented_id = accented.id

    plan = plan_merge(session, [full, accented])
    execute_merge(session, plan)
    session.commit()

    assert session.get(Player, accented_id) is None
    assert full.aliases == ["Damián Cengarle"]

    participant = session.query(TournamentParticipant).filter_by(tournament_id=week1.id).one()
    assert participant.player_id == full.id

    match = session.query(Match).filter_by(tournament_id=week2.id).one()
    assert match.player_a_id == full.id
    assert match.player_b_id == bystander.id
