from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.yearly_cup import YearlyCup


class TestSeason:
    def _cup(self, session) -> YearlyCup:
        cup = YearlyCup(
            year=2024,
            name="2024 Cup",
            starts_on=date(2024, 1, 1),
            ends_on=date(2024, 12, 31),
        )
        session.add(cup)
        session.flush()
        return cup

    def _season(self, set_code: str = "LCI", yearly_cup_id: int | None = None) -> Season:
        return Season(
            name="Lost Caverns of Ixalan",
            set_code=set_code,
            starts_on=date(2023, 11, 17),
            ends_on=date(2024, 2, 8),
            yearly_cup_id=yearly_cup_id,
        )

    def test_standalone_season(self, session):
        s = self._season()
        session.add(s)
        session.commit()
        session.refresh(s)
        assert s.yearly_cup_id is None
        assert s.qualifier_count == 2

    def test_qualifying_season(self, session):
        cup = self._cup(session)
        s = self._season(yearly_cup_id=cup.id)
        session.add(s)
        session.commit()
        session.refresh(s)
        assert s.yearly_cup_id == cup.id

    def test_set_code_unique(self, session):
        session.add(self._season("LCI"))
        session.add(self._season("LCI"))
        with pytest.raises(IntegrityError):
            session.flush()

    def test_invalid_yearly_cup_fk(self, session):
        session.add(self._season(yearly_cup_id=99999))
        with pytest.raises(IntegrityError):
            session.flush()

    def test_champion_relationship_and_name(self, session):
        player = Player(display_name="Jim Bandas")
        session.add(player)
        session.flush()

        s = self._season()
        s.champion_player_id = player.id
        session.add(s)
        session.commit()
        session.refresh(s)

        assert s.champion is not None
        assert s.champion.display_name == "Jim Bandas"
        assert s.champion_name == "Jim Bandas"

    def test_champion_name_none_without_champion(self, session):
        s = self._season()
        session.add(s)
        session.commit()
        session.refresh(s)

        assert s.champion is None
        assert s.champion_name is None

    def test_invalid_champion_player_fk(self, session):
        s = self._season()
        s.champion_player_id = 99999
        session.add(s)
        with pytest.raises(IntegrityError):
            session.flush()
