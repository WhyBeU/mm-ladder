from datetime import UTC, date, datetime

from mm_ladder.schemas.match import MatchCreate, MatchRead
from mm_ladder.schemas.player import PlayerCreate, PlayerRead
from mm_ladder.schemas.season import SeasonCreate, SeasonRead
from mm_ladder.schemas.tournament import TournamentCreate, TournamentRead
from mm_ladder.schemas.tournament_participant import (
    TournamentParticipantCreate,
    TournamentParticipantRead,
)
from mm_ladder.schemas.yearly_cup import YearlyCupCreate, YearlyCupRead

_NOW = datetime.now(UTC)


class TestPlayerSchemas:
    def test_create_defaults(self):
        s = PlayerCreate(display_name="Alice")
        assert s.display_name == "Alice"
        assert s.is_hidden is False

    def test_read_from_dict(self):
        s = PlayerRead.model_validate(
            {
                "id": 1,
                "display_name": "Alice",
                "is_hidden": False,
                "created_at": _NOW,
                "updated_at": _NOW,
            }
        )
        assert s.id == 1

    def test_read_from_orm(self, session):
        from mm_ladder.models.player import Player

        player = Player(display_name="Bob")
        session.add(player)
        session.commit()
        session.refresh(player)
        s = PlayerRead.model_validate(player)
        assert s.display_name == "Bob"
        assert isinstance(s.created_at, datetime)


class TestYearlyCupSchemas:
    def test_create(self):
        s = YearlyCupCreate(
            year=2024,
            name="2024 Cup",
            starts_on=date(2024, 1, 1),
            ends_on=date(2024, 12, 31),
        )
        assert s.year == 2024

    def test_read(self):
        s = YearlyCupRead.model_validate(
            {
                "id": 1,
                "year": 2024,
                "name": "2024 Cup",
                "starts_on": date(2024, 1, 1),
                "ends_on": date(2024, 12, 31),
                "created_at": _NOW,
                "updated_at": _NOW,
            }
        )
        assert s.year == 2024


class TestSeasonSchemas:
    def test_create_standalone(self):
        s = SeasonCreate(
            name="LCI",
            set_code="LCI",
            starts_on=date(2023, 11, 17),
            ends_on=date(2024, 2, 8),
        )
        assert s.yearly_cup_id is None
        assert s.qualifier_count == 2

    def test_read(self):
        s = SeasonRead.model_validate(
            {
                "id": 1,
                "name": "LCI",
                "set_code": "LCI",
                "starts_on": date(2023, 11, 17),
                "ends_on": date(2024, 2, 8),
                "yearly_cup_id": None,
                "qualifier_count": 2,
                "event_count": 12,
                "comp_avg_n": 8,
                "created_at": _NOW,
                "updated_at": _NOW,
            }
        )
        assert s.yearly_cup_id is None
        assert s.event_count == 12
        assert s.comp_avg_n == 8


class TestTournamentSchemas:
    def test_create(self):
        s = TournamentCreate(held_on=date(2023, 11, 20), season_id=1)
        assert s.name is None
        assert s.notes is None

    def test_read(self):
        s = TournamentRead.model_validate(
            {
                "id": 1,
                "held_on": date(2023, 11, 20),
                "season_id": 1,
                "name": None,
                "notes": None,
                "has_match_detail": False,
                "created_at": _NOW,
                "updated_at": _NOW,
            }
        )
        assert s.has_match_detail is False


class TestTournamentParticipantSchemas:
    def test_create_defaults(self):
        s = TournamentParticipantCreate(tournament_id=1, player_id=1)
        assert s.match_wins == 0

    def test_points_from_db(self):
        s = TournamentParticipantRead.model_validate(
            {
                "id": 1,
                "tournament_id": 1,
                "player_id": 1,
                "match_wins": 3,
                "match_losses": 1,
                "match_draws": 1,
                "points": 10,
                "created_at": _NOW,
                "updated_at": _NOW,
            }
        )
        assert s.points == 10

    def test_points_zero(self):
        s = TournamentParticipantRead.model_validate(
            {
                "id": 1,
                "tournament_id": 1,
                "player_id": 1,
                "match_wins": 0,
                "match_losses": 3,
                "match_draws": 0,
                "points": 0,
                "created_at": _NOW,
                "updated_at": _NOW,
            }
        )
        assert s.points == 0


class TestMatchSchemas:
    def _base(self, games_a: int, games_b: int) -> dict:
        return {
            "id": 1,
            "tournament_id": 1,
            "player_a_id": 1,
            "player_b_id": 2,
            "games_a": games_a,
            "games_b": games_b,
            "game_draws": 0,
            "created_at": _NOW,
        }

    def test_create_defaults(self):
        s = MatchCreate(tournament_id=1, player_a_id=1, player_b_id=2)
        assert s.games_a == 0

    def test_outcome_a_wins(self):
        s = MatchRead.model_validate(self._base(2, 0))
        assert s.outcome == "A_WINS"

    def test_outcome_b_wins(self):
        s = MatchRead.model_validate(self._base(0, 2))
        assert s.outcome == "B_WINS"

    def test_outcome_draw(self):
        s = MatchRead.model_validate(self._base(1, 1))
        assert s.outcome == "DRAW"
