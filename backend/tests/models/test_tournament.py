from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament


class TestTournament:
    def _season(self, session) -> Season:
        s = Season(
            name="LCI Season", set_code="LCI",
            starts_on=date(2023, 11, 17), ends_on=date(2024, 2, 8),
        )
        session.add(s)
        session.flush()
        return s

    def test_create(self, session):
        season = self._season(session)
        t = Tournament(held_on=date(2023, 11, 20), season_id=season.id)
        session.add(t)
        session.commit()
        session.refresh(t)
        assert t.id is not None
        assert t.has_match_detail is False
        assert t.name is None
        assert t.notes is None

    def test_two_pods_same_date_allowed(self, session):
        season = self._season(session)
        t1 = Tournament(held_on=date(2023, 11, 20), season_id=season.id)
        t2 = Tournament(held_on=date(2023, 11, 20), season_id=season.id)
        session.add_all([t1, t2])
        session.commit()
        assert t1.id != t2.id

    def test_season_id_not_null(self, session):
        t = Tournament(held_on=date(2023, 11, 20))  # no season_id
        session.add(t)
        with pytest.raises(IntegrityError):
            session.flush()

    def test_invalid_season_fk(self, session):
        t = Tournament(held_on=date(2023, 11, 20), season_id=99999)
        session.add(t)
        with pytest.raises(IntegrityError):
            session.flush()
