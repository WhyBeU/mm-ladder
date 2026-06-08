from mm_ladder.models.player import Player
from mm_ladder.services.player_matching import (
    find_matching_player,
    name_tokens,
    normalize_player_name,
    register_alias_if_new,
)


def test_normalize_lowercases() -> None:
    assert normalize_player_name("Alice Smith") == normalize_player_name("alice smith")


def test_normalize_folds_accents() -> None:
    assert normalize_player_name("Damián Cengarle") == normalize_player_name("Damian Cengarle")


def test_normalize_strips_punctuation_and_whitespace_differences() -> None:
    assert normalize_player_name("Alex Norton - Smith") == normalize_player_name("Alex Norton-Smith")


def test_normalize_distinguishes_different_names() -> None:
    assert normalize_player_name("Alice Smith") != normalize_player_name("Alice Smyth")


def test_name_tokens_splits_on_whitespace_and_punctuation() -> None:
    assert name_tokens("Alex Norton - Smith") == ["alex", "norton", "smith"]
    assert name_tokens("Alex Norton-Smith") == ["alex", "norton", "smith"]


def test_name_tokens_folds_accents() -> None:
    assert name_tokens("Damián Cengarle") == ["damian", "cengarle"]


def test_find_matching_player_matches_on_normalized_display_name() -> None:
    alice = Player(display_name="Alice Smith")
    bob = Player(display_name="Bob Jones")
    assert find_matching_player([alice, bob], "alice  smith") is alice


def test_find_matching_player_matches_on_normalized_alias() -> None:
    damian = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    assert find_matching_player([damian], "Damian Cengarle") is damian


def test_find_matching_player_returns_none_when_no_match() -> None:
    alice = Player(display_name="Alice Smith")
    assert find_matching_player([alice], "Carol Lee") is None


def test_register_alias_if_new_appends_unseen_spelling() -> None:
    player = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    register_alias_if_new(player, "Damian C")
    assert player.aliases == ["Damián Cengarle", "Damian C"]


def test_register_alias_if_new_ignores_known_spelling() -> None:
    player = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    register_alias_if_new(player, "Damián Cengarle")
    assert player.aliases == ["Damián Cengarle"]


def test_register_alias_if_new_ignores_canonical_display_name() -> None:
    player = Player(display_name="Damian Cengarle Barilari", aliases=[])
    register_alias_if_new(player, "Damian Cengarle Barilari")
    assert player.aliases == []
