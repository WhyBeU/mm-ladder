from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.player import Player
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

    def test_player_of_the_year_relationship_and_name(self, session):
        player = Player(display_name="Jim Bandas")
        session.add(player)
        session.flush()

        cup = self._cup()
        cup.player_of_the_year_id = player.id
        session.add(cup)
        session.commit()
        session.refresh(cup)

        assert cup.player_of_the_year is not None
        assert cup.player_of_the_year.display_name == "Jim Bandas"
        assert cup.player_of_the_year_name == "Jim Bandas"

    def test_player_of_the_year_name_none_without_poty(self, session):
        cup = self._cup()
        session.add(cup)
        session.commit()
        session.refresh(cup)

        assert cup.player_of_the_year is None
        assert cup.player_of_the_year_name is None

    def test_invalid_player_of_the_year_fk(self, session):
        cup = self._cup()
        cup.player_of_the_year_id = 99999
        session.add(cup)
        with pytest.raises(IntegrityError):
            session.flush()

    def test_cup_winner_relationship_and_name(self, session):
        player = Player(display_name="Jim Bandas")
        session.add(player)
        session.flush()

        cup = self._cup()
        cup.cup_winner_id = player.id
        session.add(cup)
        session.commit()
        session.refresh(cup)

        assert cup.cup_winner is not None
        assert cup.cup_winner.display_name == "Jim Bandas"
        assert cup.cup_winner_name == "Jim Bandas"

    def test_cup_winner_name_none_without_winner(self, session):
        cup = self._cup()
        session.add(cup)
        session.commit()
        session.refresh(cup)

        assert cup.cup_winner is None
        assert cup.cup_winner_name is None

    def test_invalid_cup_winner_fk(self, session):
        cup = self._cup()
        cup.cup_winner_id = 99999
        session.add(cup)
        with pytest.raises(IntegrityError):
            session.flush()

    def test_qualified_players_empty_by_default(self, session):
        cup = self._cup()
        session.add(cup)
        session.commit()
        session.refresh(cup)

        assert cup.qualified_players == []
        assert cup.qualified_player_ids == []

    def test_qualified_players_m2m(self, session):
        alice = Player(display_name="Alice")
        bob = Player(display_name="Bob")
        session.add_all([alice, bob])
        session.flush()

        cup = self._cup()
        cup.qualified_players = [alice, bob]
        session.add(cup)
        session.commit()
        session.refresh(cup)

        assert sorted(cup.qualified_player_ids) == sorted([alice.id, bob.id])
