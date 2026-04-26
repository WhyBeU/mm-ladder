import pytest
from datetime import date
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.yearly_cup import YearlyCup


class TestYearlyCup:
    def _cup(self, year: int = 2024) -> YearlyCup:
        return YearlyCup(
            year=year,
            name=f"{year} Magic Mates Cup",
            starts_on=date(year, 1, 8),
            ends_on=date(year, 12, 30),
        )

    def test_create(self, session):
        cup = self._cup()
        session.add(cup)
        session.commit()
        session.refresh(cup)
        assert cup.id is not None
        assert cup.year == 2024
        assert cup.name == "2024 Magic Mates Cup"

    def test_timestamps_set(self, session):
        cup = self._cup()
        session.add(cup)
        session.commit()
        session.refresh(cup)
        assert cup.created_at is not None
        assert cup.updated_at is not None

    def test_year_unique(self, session):
        session.add(self._cup(2024))
        session.add(self._cup(2024))
        with pytest.raises(IntegrityError):
            session.flush()

    def test_different_years_allowed(self, session):
        session.add(self._cup(2023))
        session.add(self._cup(2024))
        session.commit()  # should not raise
