import re
import unicodedata
from collections.abc import Iterable

from mm_ladder.models.player import Player


def name_tokens(name: str) -> list[str]:
    """Split a name into lowercase, accent-folded, alphanumeric tokens.

    Folds accents to ASCII and splits on whitespace/punctuation, so
    "Damián Cengarle" -> ["damian", "cengarle"] and both "Alex Norton - Smith"
    and "Alex Norton-Smith" -> ["alex", "norton", "smith"].
    """
    folded = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    return re.findall(r"[a-z0-9]+", folded.lower())


def normalize_player_name(name: str) -> str:
    """Collapse a name to a single comparison string, ignoring case, accents,
    whitespace, and punctuation differences."""
    return "".join(name_tokens(name))


def find_matching_player(players: Iterable[Player], display_name: str) -> Player | None:
    """Find a player whose display_name or any alias normalizes to the same name.

    Strict normalized-exact matching only — no fuzzy matching — so this is safe to
    use automatically at player-creation time without risking merging distinct people.
    """
    target = normalize_player_name(display_name)
    for player in players:
        if normalize_player_name(player.display_name) == target:
            return player
        if any(normalize_player_name(alias) == target for alias in player.aliases or []):
            return player
    return None


def register_alias_if_new(player: Player, display_name: str) -> None:
    """Record a new spelling of player's name as an alias, if it isn't already known."""
    aliases = player.aliases or []
    known = {player.display_name, *aliases}
    if display_name not in known:
        player.aliases = [*aliases, display_name]
