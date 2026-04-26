import pytest
from datetime import date
from sqlalchemy import inspect as sa_inspect
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.match import Match
from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament


class TestMatch:
    def _fixtures(self, session):
        season = Season(
            name="LCI Season", set_code="LCI",
            starts_on=date(2023, 11, 17), ends_on=date(2024, 2, 8),
        )
        session.add(season)
        session.flush()
        tournament = Tournament(held_on=date(2023, 11, 20), season_id=season.id)
        player_a = Player(display_name="Alice")
        player_b = Player(display_name="Bob")
        session.add_all([tournament, player_a, player_b])
        session.flush()
        return tournament, player_a, player_b

    def test_create(self, session):
        t, a, b = self._fixtures(session)
        m = Match(tournament_id=t.id, player_a_id=a.id, player_b_id=b.id, games_a=2, games_b=1)
        session.add(m)
        session.commit()
        session.refresh(m)
        assert m.id is not None
        assert m.games_a == 2
        assert m.games_b == 1
        assert m.game_draws == 0
        assert m.created_at is not None

    def test_no_updated_at_column(self):
        cols = {c.key for c in sa_inspect(Match).columns}
        assert "updated_at" not in cols

    def test_same_player_check_constraint(self, session):
        t, a, _ = self._fixtures(session)
        session.add(Match(tournament_id=t.id, player_a_id=a.id, player_b_id=a.id, games_a=2, games_b=0))
        with pytest.raises(IntegrityError):
            session.flush()

    def test_player_relationships(self, session):
        t, a, b = self._fixtures(session)
        m = Match(tournament_id=t.id, player_a_id=a.id, player_b_id=b.id, games_a=2, games_b=0)
        session.add(m)
        session.commit()
        session.refresh(m)
        assert m.player_a.display_name == "Alice"
        assert m.player_b.display_name == "Bob"
