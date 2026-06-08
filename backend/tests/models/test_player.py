import pytest
from sqlalchemy.exc import IntegrityError

from mm_ladder.models.player import Player


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
