import json
from datetime import date
from itertools import groupby
from pathlib import Path

from sqlalchemy.orm import Session

from migration.seasons import BEST_QUALIFYING_FROM, POINTS_TO_WLD, SEASONS, season_dir_name
from mm_ladder.logger import get_logger
from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.models.yearly_cup import YearlyCup
from mm_ladder.services.player_matching import find_matching_player, register_alias_if_new

DATA_DIR = Path(__file__).parent / "data"
log = get_logger("migration.importer")


def wld_for_points(points: int) -> tuple[int, int, int]:
    """Return (wins, losses, draws) for a single 3-round tournament result."""
    return POINTS_TO_WLD[points]


def _find_cup(session: Session, season_meta: dict) -> YearlyCup | None:
    cup_year = season_meta.get("cup_year") or date.fromisoformat(season_meta["starts_on"]).year
    return session.query(YearlyCup).filter_by(year=cup_year).first()


def ensure_season(session: Session, season_meta: dict) -> Season:
    """Find existing Season by set_code or create it, linking to its yearly cup."""
    starts_on = date.fromisoformat(season_meta["starts_on"])
    cup = _find_cup(session, season_meta)
    qualifying = season_meta.get("qualifying", True)
    qualifier_count = 0 if not qualifying else season_meta.get("qualifier_count", 2)
    qualifying_type = "BEST" if qualifying and starts_on >= BEST_QUALIFYING_FROM else "POINTS"

    season = session.query(Season).filter_by(set_code=season_meta["set_code"]).first()
    if season is None:
        log.debug("creating season", set_code=season_meta["set_code"], name=season_meta["name"])
        season = Season(
            name=season_meta["name"],
            set_code=season_meta["set_code"],
            starts_on=starts_on,
            ends_on=date.fromisoformat(season_meta["ends_on"]),
            yearly_cup_id=cup.id if cup else None,
            qualifier_count=qualifier_count,
            qualifying_type=qualifying_type,
        )
        session.add(season)
        session.flush()
    else:
        log.debug("season exists, updating config fields", set_code=season_meta["set_code"])
        season.qualifier_count = qualifier_count
        season.qualifying_type = qualifying_type
        if season.yearly_cup_id is None and cup is not None:
            season.yearly_cup_id = cup.id
        session.flush()
    return season


def _normalize_name(firstname: str, lastname: str) -> str:
    """Normalize to title-case with collapsed whitespace for consistent player lookup."""
    first = " ".join(firstname.strip().split()).title()
    last = " ".join(lastname.strip().split()).title()
    return f"{first} {last}"


def ensure_player(session: Session, firstname: str, lastname: str) -> Player:
    """Find existing Player by display_name/alias match or create it."""
    display_name = _normalize_name(firstname, lastname)
    player = session.query(Player).filter_by(display_name=display_name).first()
    if player is None:
        player = find_matching_player(session.query(Player).all(), display_name)
    if player is not None:
        register_alias_if_new(player, display_name)
        return player
    log.debug("creating player", display_name=display_name)
    player = Player(display_name=display_name)
    session.add(player)
    session.flush()
    return player


def import_tournament(session: Session, season: Season, data: dict) -> Tournament:
    """Create one Tournament and its TournamentParticipants from a saved JSON file's data."""
    held_on = date.fromisoformat(data["tournament_date"])
    tournament = Tournament(
        held_on=held_on,
        season_id=season.id,
        is_migrated=True,
        has_match_detail=False,
        name=f"{season.name} – {held_on.strftime('%d %b %Y')}",
    )
    session.add(tournament)
    session.flush()

    seen_player_ids: set[int] = set()
    for p in data["players"]:
        player = ensure_player(session, p["Firstname"], p["Lastname"])
        if player.id in seen_player_ids:
            log.warning(
                "duplicate player in tournament, skipping",
                display_name=player.display_name,
                date=held_on.isoformat(),
                set_code=season.set_code,
            )
            continue
        seen_player_ids.add(player.id)
        w, losses, d = wld_for_points(p["TotalMatchPoints"])
        participant = TournamentParticipant(
            tournament_id=tournament.id,
            player_id=player.id,
            match_wins=w,
            match_losses=losses,
            match_draws=d,
        )
        session.add(participant)

    session.flush()
    log.debug(
        "tournament imported",
        date=held_on.isoformat(),
        set_code=season.set_code,
        players=len(data["players"]),
    )
    return tournament


def reset_migrated(session: Session, db_season_id: int | None = None) -> None:
    """Delete migrated tournaments and their participants, keeping all players.

    Players are intentionally preserved so their ids stay stable across re-imports:
    champion / POTY / cup-winner / qualification / match FKs all reference player.id.
    If db_season_id is given, only resets that season's migrated tournaments.
    """
    query = session.query(Tournament.id).filter_by(is_migrated=True)
    if db_season_id is not None:
        query = query.filter(Tournament.season_id == db_season_id)

    migrated_ids = [row[0] for row in query.all()]
    log.info("resetting migrated data", tournaments=len(migrated_ids), scoped_to_season=db_season_id is not None)

    if migrated_ids:
        session.query(TournamentParticipant).filter(TournamentParticipant.tournament_id.in_(migrated_ids)).delete(
            synchronize_session=False
        )
        session.query(Tournament).filter(Tournament.id.in_(migrated_ids)).delete(synchronize_session=False)

    session.flush()


def seed_cups(session: Session) -> int:
    """Upsert YearlyCup rows from SEASONS and link Season.yearly_cup_id. Returns cups upserted."""
    sorted_seasons = sorted(SEASONS, key=lambda s: s["cup_year"])
    cups_upserted = 0

    for cup_year, group_iter in groupby(sorted_seasons, key=lambda s: s["cup_year"]):
        group = list(group_iter)
        starts_on = min(date.fromisoformat(s["starts_on"]) for s in group)
        ends_on = max(date.fromisoformat(s["ends_on"]) for s in group)
        name = f"MM Cup {cup_year}"

        cup = session.query(YearlyCup).filter_by(year=cup_year).first()
        if cup is None:
            cup = YearlyCup(year=cup_year, name=name, starts_on=starts_on, ends_on=ends_on)
            session.add(cup)
        else:
            cup.name = name
            cup.starts_on = starts_on
            cup.ends_on = ends_on
        session.flush()
        cups_upserted += 1

        for season_meta in group:
            db_season = session.query(Season).filter_by(set_code=season_meta["set_code"]).first()
            if db_season is not None:
                db_season.yearly_cup_id = cup.id
        session.flush()

    session.commit()
    log.info("cups seeded", cups=cups_upserted)
    return cups_upserted


def run_import(session: Session, set_code: str | None = None, force_re_upload: bool = False) -> tuple[int, int, int]:
    """
    Idempotent import of saved JSON files. Players are never deleted, so their ids
    stay stable across runs.

    By default, tournaments already in the database (matched by season + date) are
    skipped, and only missing events are imported. With force_re_upload=True, the
    migrated tournaments in scope are deleted and rebuilt from the JSON (recomputing
    results), while players are preserved.

    If set_code is given (e.g. "tdm"), only that season is processed.
    Returns (seasons_processed, tournaments_imported, players_created).
    """
    seasons_to_process = [s for s in SEASONS if s["set_code"] == set_code] if set_code else SEASONS

    if force_re_upload:
        if set_code is not None:
            db_season = session.query(Season).filter_by(set_code=set_code).first()
            reset_migrated(session, db_season_id=db_season.id if db_season else None)
        else:
            reset_migrated(session)

    seasons_processed = 0
    tournaments_imported = 0
    players_before = session.query(Player).count()

    for season_meta in seasons_to_process:
        season_dir = DATA_DIR / season_dir_name(season_meta)
        if not season_dir.exists():
            log.debug("no data dir, skipping season", set_code=season_meta["set_code"])
            continue

        json_files = sorted(season_dir.glob("*.json"))
        if not json_files:
            log.debug("no json files, skipping season", set_code=season_meta["set_code"])
            continue

        log.info("importing season", set_code=season_meta["set_code"], name=season_meta["name"], files=len(json_files))
        season = ensure_season(session, season_meta)
        season.event_count = len(json_files)
        session.flush()
        seasons_processed += 1

        for json_file in json_files:
            try:
                text = json_file.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                log.warning("falling back to cp1252 encoding", file=json_file.name)
                text = json_file.read_text(encoding="cp1252")
            data = json.loads(text)

            held_on = date.fromisoformat(data["tournament_date"])
            existing = (
                session.query(Tournament.id)
                .filter_by(season_id=season.id, held_on=held_on, is_migrated=True)
                .first()
            )
            if existing is not None:
                # force_re_upload deleted in-scope tournaments above, so a survivor
                # here means a default run: leave it untouched.
                log.debug("tournament already imported, skipping", date=held_on.isoformat(), set_code=season.set_code)
                continue

            import_tournament(session, season, data)
            tournaments_imported += 1

    log.info("committing", seasons=seasons_processed, tournaments=tournaments_imported)
    session.commit()
    players_after = session.query(Player).count()
    return seasons_processed, tournaments_imported, players_after - players_before
