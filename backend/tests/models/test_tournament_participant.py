from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant


class TestTournamentParticipant:
    def _fixtures(self, session):
        season = Season(
            name="LCI Season", set_code="LCI",
            starts_on=date(2023, 11, 17), ends_on=date(2024, 2, 8),
        )
        session.add(season)
        session.flush()
        tournament = Tournament(held_on=date(2023, 11, 20), season_id=season.id)
        player = Player(display_name="Alice")
        session.add_all([tournament, player])
        session.flush()
        return tournament, player

    def test_create(self, session):
        t, p = self._fixtures(session)
        tp = TournamentParticipant(tournament_id=t.id, player_id=p.id)
        session.add(tp)
        session.commit()
        session.refresh(tp)
        assert tp.id is not None
        assert tp.match_wins == 0
        assert tp.match_losses == 0
        assert tp.match_draws == 0

    def test_points_computed_by_db(self, session):
        t, p = self._fixtures(session)
        tp = TournamentParticipant(tournament_id=t.id, player_id=p.id, match_wins=3, match_draws=1)
        session.add(tp)
        session.commit()
        session.refresh(tp)
        assert tp.points == 10  # 3*3 + 1

    def test_points_zero_for_no_wins(self, session):
        t, p = self._fixtures(session)
        tp = TournamentParticipant(tournament_id=t.id, player_id=p.id, match_losses=3)
        session.add(tp)
        session.commit()
        session.refresh(tp)
        assert tp.points == 0

    def test_unique_constraint(self, session):
        t, p = self._fixtures(session)
        session.add(TournamentParticipant(tournament_id=t.id, player_id=p.id))
        session.add(TournamentParticipant(tournament_id=t.id, player_id=p.id))
        with pytest.raises(IntegrityError):
            session.flush()

    def test_invalid_player_fk(self, session):
        t, _ = self._fixtures(session)
        session.add(TournamentParticipant(tournament_id=t.id, player_id=99999))
        with pytest.raises(IntegrityError):
            session.flush()

    def test_invalid_tournament_fk(self, session):
        _, p = self._fixtures(session)
        session.add(TournamentParticipant(tournament_id=99999, player_id=p.id))
        with pytest.raises(IntegrityError):
            session.flush()
