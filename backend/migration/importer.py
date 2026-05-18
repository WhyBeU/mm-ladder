import json
from datetime import date
from pathlib import Path

from sqlalchemy.orm import Session

from migration.seasons import POINTS_TO_WLD, SEASONS
from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant

DATA_DIR = Path(__file__).parent / "data"


def wld_for_points(points: int) -> tuple[int, int, int]:
    """Return (wins, losses, draws) for a single 3-round tournament result."""
    return POINTS_TO_WLD[points]


def ensure_season(session: Session, season_meta: dict) -> Season:
    """Find existing Season by set_code or create it."""
    season = session.query(Season).filter_by(set_code=season_meta["set_code"]).first()
    if season is None:
        season = Season(
            name=season_meta["name"],
            set_code=season_meta["set_code"],
            starts_on=date.fromisoformat(season_meta["starts_on"]),
            ends_on=date.fromisoformat(season_meta["ends_on"]),
        )
        session.add(season)
        session.flush()
    return season


def ensure_player(session: Session, firstname: str, lastname: str) -> Player:
    """Find existing Player by display_name or create it."""
    display_name = f"{firstname} {lastname}"
    player = session.query(Player).filter_by(display_name=display_name).first()
    if player is None:
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

    for p in data["players"]:
        player = ensure_player(session, p["Firstname"], p["Lastname"])
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
    return tournament


def reset_migrated(session: Session, db_season_id: int | None = None) -> None:
    """Delete migrated tournaments (and participants), then orphaned players.

    If db_season_id is given, only resets that season's migrated tournaments.
    """
    query = session.query(Tournament.id).filter_by(is_migrated=True)
    if db_season_id is not None:
        query = query.filter(Tournament.season_id == db_season_id)

    migrated_ids = [row[0] for row in query.all()]
    if migrated_ids:
        session.query(TournamentParticipant).filter(
            TournamentParticipant.tournament_id.in_(migrated_ids)
        ).delete(synchronize_session=False)
        session.query(Tournament).filter(Tournament.id.in_(migrated_ids)).delete(
            synchronize_session=False
        )

    for player in session.query(Player).all():
        if not session.query(TournamentParticipant).filter_by(player_id=player.id).first():
            session.delete(player)

    session.flush()


def run_import(session: Session, set_code: str | None = None) -> tuple[int, int, int]:
    """
    Full idempotent import: reset migrated data, then re-import all saved JSON files.
    If set_code is given (e.g. "tdm"), only processes that season.
    Returns (seasons_processed, tournaments_imported, players_created).
    """
    seasons_to_process = [s for s in SEASONS if s["set_code"] == set_code] if set_code else SEASONS

    if set_code is not None:
        db_season = session.query(Season).filter_by(set_code=set_code).first()
        reset_migrated(session, db_season_id=db_season.id if db_season else None)
    else:
        reset_migrated(session)

    seasons_processed = 0
    tournaments_imported = 0
    players_before = session.query(Player).count()

    for season_meta in seasons_to_process:
        season_dir = DATA_DIR / f"season_{season_meta['id']}"
        if not season_dir.exists():
            continue

        json_files = sorted(season_dir.glob("*.json"))
        if not json_files:
            continue

        season = ensure_season(session, season_meta)
        seasons_processed += 1

        for json_file in json_files:
            data = json.loads(json_file.read_text())
            import_tournament(session, season, data)
            tournaments_imported += 1

    session.commit()
    players_after = session.query(Player).count()
    return seasons_processed, tournaments_imported, players_after - players_before
