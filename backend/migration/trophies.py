import json
import sys
from dataclasses import dataclass, field

from migration.importer import DATA_DIR, _normalize_name
from migration.seasons import season_dir_name
from mm_ladder.logger import get_logger

log = get_logger("migration.trophies")

# The css classes limitedspoiler.com uses for the draft awards we track.
TROPHY_CSS = frozenset({"fa fa-trophy ss-uncommon", "fa fa-star ss-uncommon"})


@dataclass
class PlayerTrophies:
    """One player's draft-trophy tally for a season, combined across all snapshots."""

    name: str
    # trophy display name -> count (max seen across snapshots)
    by_name: dict[str, int] = field(default_factory=dict)

    @property
    def total(self) -> int:
        return sum(self.by_name.values())


def _read_json(path) -> dict:
    """Read a saved tournament JSON, falling back to cp1252 like the importer does."""
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        log.warning("falling back to cp1252 encoding", file=path.name)
        text = path.read_text(encoding="cp1252")
    return json.loads(text)


def compute_trophy_leaderboard(season_meta: dict) -> list[PlayerTrophies]:
    """Combine every snapshot in a season's data dir into one draft-trophy leaderboard.

    Trophy lists are an all-time, per-player collection that repeats unchanged across a
    season's snapshots, so counts are taken as the max per (player, trophy name) rather
    than summed across files. A player's total is the sum of their distinct trophy counts.
    Players are keyed by normalized name to merge spelling variants. Sorted by total
    descending, then name ascending.
    """
    season_dir = DATA_DIR / season_dir_name(season_meta)
    if not season_dir.exists():
        log.warning("no data dir for season", set_code=season_meta["set_code"])
        return []

    players: dict[str, PlayerTrophies] = {}
    for json_file in sorted(season_dir.glob("*.json")):
        data = _read_json(json_file)
        for p in data.get("players", []):
            uncommon = [t for t in p.get("Trophies", []) if t.get("Css") in TROPHY_CSS]
            if not uncommon:
                continue
            name = _normalize_name(p["Firstname"], p["Lastname"])
            entry = players.setdefault(name, PlayerTrophies(name=name))
            for t in uncommon:
                # Stable across snapshots; max guards against any partial snapshot.
                entry.by_name[t["Name"]] = max(entry.by_name.get(t["Name"], 0), int(t["Count"]))

    return sorted(players.values(), key=lambda e: (-e.total, e.name))


def _safe_print(text: str = "") -> None:
    """Print, downgrading any char the console encoding can't render to '?'.

    Player names may contain emoji that a cp1252 Windows console cannot encode.
    """
    enc = sys.stdout.encoding or "utf-8"
    print(text.encode(enc, errors="replace").decode(enc))


def print_trophy_table(season_meta: dict, rows: list[PlayerTrophies]) -> None:
    """Print the ranked draft-trophy leaderboard with a per-name breakdown column."""
    title = f"Draft Trophies - {season_meta['name']} ({season_meta['set_code']})"
    _safe_print()
    _safe_print(title)
    _safe_print("=" * len(title))

    if not rows:
        _safe_print("No draft trophies found for this season.")
        return

    name_w = max(len("Player"), max(len(r.name) for r in rows))
    rank_w = len(str(len(rows)))
    hdr = f"  {'#':>{rank_w}}  {'Player':<{name_w}}  {'Total':>5}  Breakdown"
    _safe_print(hdr)
    _safe_print("  " + "-" * (len(hdr) - 2))
    # Width of everything left of the Breakdown column, so trailing trophy
    # lines align under the first one.
    indent = " " * (2 + rank_w + 2 + name_w + 2 + 5 + 2)
    for i, r in enumerate(rows, start=1):
        lines = [f"{n} x{c}" for n, c in sorted(r.by_name.items(), key=lambda kv: (-kv[1], kv[0]))]
        _safe_print(f"  {i:>{rank_w}}  {r.name:<{name_w}}  {r.total:>5}  {lines[0]}")
        for line in lines[1:]:
            _safe_print(f"{indent}{line}")

    _safe_print("  " + "-" * (len(hdr) - 2))
    _safe_print(f"  {'':>{rank_w}}  {'TOTAL':<{name_w}}  {sum(r.total for r in rows):>5}  {len(rows)} players")
