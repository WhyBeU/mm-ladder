from datetime import date

import pytest
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.yearly_cup import YearlyCup


class TestPlayer:
    def test_create(self, session):
        player = Player(display_name="Alice")
        session.add(player)
        session.commit()
        session.refresh(player)
        assert player.id is not None
        assert player.display_name == "Alice"
        assert player.is_hidden is False

    def test_timestamps_set_on_insert(self, session):
        player = Player(display_name="Bob")
        session.add(player)
        session.commit()
        session.refresh(player)
        assert player.created_at is not None
        assert player.updated_at is not None

    def test_display_name_not_null(self, session):
        session.add(Player(display_name=None))  # type: ignore[arg-type]
        with pytest.raises(IntegrityError):
            session.flush()

    def test_no_unique_constraint_on_display_name(self, session):
        session.add(Player(display_name="Dave"))
        session.add(Player(display_name="Dave"))
        session.commit()  # two players with same name is allowed

    def test_aliases_defaults_to_empty_list(self, session):
        player = Player(display_name="Grace")
        session.add(player)
        session.commit()
        session.refresh(player)
        assert player.aliases == []

    def test_aliases_stores_list_of_strings(self, session):
        player = Player(display_name="Henry", aliases=["Hank", "H. Smith"])
        session.add(player)
        session.commit()
        session.refresh(player)
        assert player.aliases == ["Hank", "H. Smith"]

    def test_season_championships_and_set_codes(self, session):
        player = Player(display_name="Jim Bandas")
        session.add(player)
        session.flush()

        season = Season(
            name="Core Set 2021",
            set_code="m21",
            starts_on=date(2020, 6, 26),
            ends_on=date(2020, 9, 18),
            champion_player_id=player.id,
        )
        session.add(season)
        session.commit()
        session.refresh(player)

        assert season in player.season_championships
        assert player.season_champion_set_codes == ["m21"]

    def test_season_champion_set_codes_empty_when_no_championships(self, session):
        player = Player(display_name="Nobody")
        session.add(player)
        session.commit()
        session.refresh(player)

        assert player.season_championships == []
        assert player.season_champion_set_codes == []

    def test_player_of_the_year_cup_names(self, session):
        player = Player(display_name="Jim Bandas")
        session.add(player)
        session.flush()

        cup = YearlyCup(
            year=2024,
            name="2024 Magic Mates Cup",
            starts_on=date(2024, 1, 8),
            ends_on=date(2024, 12, 30),
            player_of_the_year_id=player.id,
        )
        session.add(cup)
        session.commit()
        session.refresh(player)

        assert cup in player.poty_cups
        assert player.player_of_the_year_cup_names == ["2024 Magic Mates Cup"]

    def test_cup_champion_cup_names(self, session):
        player = Player(display_name="Jim Bandas")
        session.add(player)
        session.flush()

        cup = YearlyCup(
            year=2024,
            name="2024 Magic Mates Cup",
            starts_on=date(2024, 1, 8),
            ends_on=date(2024, 12, 30),
            cup_winner_id=player.id,
        )
        session.add(cup)
        session.commit()
        session.refresh(player)

        assert cup in player.cup_championships
        assert player.cup_champion_cup_names == ["2024 Magic Mates Cup"]

    def test_trophy_cup_lists_empty_when_none(self, session):
        player = Player(display_name="Nobody")
        session.add(player)
        session.commit()
        session.refresh(player)

        assert player.poty_cups == []
        assert player.player_of_the_year_cup_names == []
        assert player.cup_championships == []
        assert player.cup_champion_cup_names == []
