from datetime import date

import pytest
from sqlalchemy.orm import Session

TOURNAMENT_FILE = {
    "season_id": 39,
    "tournament_date": "2025-04-07",
    "players": [
        {"Firstname": "Alice", "Lastname": "Smith", "NbTournaments": 1, "TotalMatchPoints": 9},
        {"Firstname": "Bob", "Lastname": "Jones", "NbTournaments": 1, "TotalMatchPoints": 6},
        {"Firstname": "Carol", "Lastname": "Li", "NbTournaments": 1, "TotalMatchPoints": 0},
    ],
}

SEASON_META = {
    "id": 39,
    "name": "Tarkir: Dragonstorm",
    "set_code": "tdm",
    "starts_on": "2025-04-04",
    "ends_on": "2025-06-05",
}


def test_normalize_name_title_cases() -> None:
    from migration.importer import _normalize_name

    assert _normalize_name("alexander", "colbert") == "Alexander Colbert"
    assert _normalize_name("Alexander", "Colbert") == "Alexander Colbert"
    assert _normalize_name("JAMES", "GOVER") == "James Gover"


def test_normalize_name_collapses_whitespace() -> None:
    from migration.importer import _normalize_name

    assert _normalize_name("Kyye", "  .") == "Kyye ."
    assert _normalize_name(" Alice ", " Smith ") == "Alice Smith"


def test_normalize_name_deduplicates_case_variants(session: Session) -> None:
    from migration.importer import ensure_player

    p1 = ensure_player(session, "alexander", "colbert")
    p2 = ensure_player(session, "Alexander", "Colbert")
    assert p1.id == p2.id


def test_normalize_name_deduplicates_whitespace_variants(session: Session) -> None:
    from migration.importer import ensure_player

    p1 = ensure_player(session, "Kyye", ".")
    p2 = ensure_player(session, "Kyye", "  .")
    assert p1.id == p2.id


def test_wld_for_9_points(session: Session) -> None:
    from migration.importer import wld_for_points

    w, losses, d = wld_for_points(9)
    assert (w, losses, d) == (3, 0, 0)


def test_wld_for_7_points(session: Session) -> None:
    from migration.importer import wld_for_points

    w, losses, d = wld_for_points(7)
    assert (w, losses, d) == (2, 0, 1)


def test_wld_for_unknown_points_raises(session: Session) -> None:
    from migration.importer import wld_for_points

    with pytest.raises(KeyError):
        wld_for_points(8)


def test_import_tournament_creates_records(session: Session) -> None:
    from migration.importer import ensure_season, import_tournament
    from mm_ladder.models.tournament import Tournament
    from mm_ladder.models.tournament_participant import TournamentParticipant

    season = ensure_season(session, SEASON_META)
    import_tournament(session, season, TOURNAMENT_FILE)
    session.flush()

    tournaments = session.query(Tournament).all()
    assert len(tournaments) == 1
    assert tournaments[0].held_on == date(2025, 4, 7)
    assert tournaments[0].is_migrated is True
    assert tournaments[0].has_match_detail is False

    participants = session.query(TournamentParticipant).all()
    assert len(participants) == 3


def test_import_tournament_wld_mapping(session: Session) -> None:
    from migration.importer import ensure_season, import_tournament
    from mm_ladder.models.tournament_participant import TournamentParticipant

    season = ensure_season(session, SEASON_META)
    import_tournament(session, season, TOURNAMENT_FILE)
    session.flush()

    alice = (
        session.query(TournamentParticipant)
        .join(TournamentParticipant.player)
        .filter_by(display_name="Alice Smith")
        .one()
    )
    assert alice.match_wins == 3
    assert alice.match_losses == 0
    assert alice.match_draws == 0

    bob = (
        session.query(TournamentParticipant)
        .join(TournamentParticipant.player)
        .filter_by(display_name="Bob Jones")
        .one()
    )
    assert bob.match_wins == 2
    assert bob.match_losses == 1
    assert bob.match_draws == 0

    carol = (
        session.query(TournamentParticipant).join(TournamentParticipant.player).filter_by(display_name="Carol Li").one()
    )
    assert carol.match_wins == 0
    assert carol.match_losses == 3
    assert carol.match_draws == 0


def test_reset_migrated_removes_only_migrated(session: Session) -> None:
    from migration.importer import ensure_season, import_tournament, reset_migrated
    from mm_ladder.models.tournament import Tournament

    season = ensure_season(session, SEASON_META)
    import_tournament(session, season, TOURNAMENT_FILE)
    session.flush()

    manual = Tournament(held_on=date(2025, 5, 5), season_id=season.id, is_migrated=False)
    session.add(manual)
    session.flush()

    reset_migrated(session)
    session.flush()

    remaining = session.query(Tournament).all()
    assert len(remaining) == 1
    assert remaining[0].is_migrated is False


def test_ensure_season_sets_qualifier_count(session: Session) -> None:
    from migration.importer import ensure_season

    season = ensure_season(session, {**SEASON_META, "qualifier_count": 3})
    assert season.qualifier_count == 3


def test_ensure_season_defaults_qualifier_count(session: Session) -> None:
    from migration.importer import ensure_season

    season = ensure_season(session, SEASON_META)
    assert season.qualifier_count == 2


def test_ensure_season_updates_qualifier_count_on_existing_season(session: Session) -> None:
    from migration.importer import ensure_season

    ensure_season(session, SEASON_META)
    updated = ensure_season(session, {**SEASON_META, "qualifier_count": 1})
    assert updated.qualifier_count == 1


def test_ensure_season_qualifying_false_sets_qualifier_count_zero(session: Session) -> None:
    from migration.importer import ensure_season

    season = ensure_season(session, {**SEASON_META, "qualifying": False})
    assert season.qualifier_count == 0


def test_import_is_idempotent(session: Session) -> None:
    from migration.importer import ensure_season, import_tournament, reset_migrated
    from mm_ladder.models.tournament import Tournament

    season = ensure_season(session, SEASON_META)
    import_tournament(session, season, TOURNAMENT_FILE)
    session.flush()

    reset_migrated(session)
    session.flush()

    season2 = ensure_season(session, SEASON_META)
    import_tournament(session, season2, TOURNAMENT_FILE)
    session.flush()

    assert session.query(Tournament).filter_by(is_migrated=True).count() == 1
