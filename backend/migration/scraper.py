import hashlib
import json
import re
import time
from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import requests

from migration.seasons import get_mondays, season_dir_name
from mm_ladder.logger import get_logger

log = get_logger("migration.scraper")

BASE_URL = "https://limitedspoiler.com/Team"
LEAGUE_ID = 8
DATA_DIR = Path(__file__).parent / "data"
HASH_FILE = DATA_DIR / "tournament_hashes.json"
REQUEST_DELAY = 0.5
MIN_PLAYERS = 4  # warn if an event has fewer than this many players


# ── Tournament hash registry ──────────────────────────────────────────────────


def _load_hashes() -> dict[str, str]:
    """Load {relative_path: hash} from the central hash registry."""
    if HASH_FILE.exists():
        return json.loads(HASH_FILE.read_text(encoding="utf-8"))
    return {}


def _save_hashes(hashes: dict[str, str]) -> None:
    HASH_FILE.write_text(json.dumps(hashes, indent=2, sort_keys=True, ensure_ascii=False), encoding="utf-8")


def _tournament_hash(set_code: str, monday: date, players: list[dict]) -> str:
    """
    Stable SHA-256 of: <set_code>|<monday>|<FirstLastPts>|...
    Players sorted alphabetically; trophies and all other fields are excluded.
    """
    player_parts = sorted(
        f"{p['Firstname']}{p['Lastname']}{p['TotalMatchPoints']}"
        for p in players
    )
    raw = "|".join([set_code, monday.isoformat()] + player_parts)
    log.debug("tournament hash input", raw=raw)
    return hashlib.sha256(raw.encode()).hexdigest()


@dataclass
class MondayResult:
    attendees: list[dict]   # players with NbTournaments == 1 (or NbT==2 halved)
    multi_event: bool       # True when NbTournaments > 2 players were excluded
    actual_date: date       # the date the tournament data lives on (may be probe_day+1)


@dataclass
class ScrapeSummary:
    set_code: str
    name: str
    total_mondays: int           # Mondays in season up to today
    events_on_disk: int          # JSON files present after scrape
    newly_saved: int             # files written this run
    skipped_existing: int        # files skipped (already existed, force=False)
    empty_dates: list[date]      # Mondays queried with no players returned
    future_count: int            # Mondays skipped as future
    multi_event_dates: list[date] = field(default_factory=list)  # weeks with NbT>1 players (possible double events)
    low_count: list[tuple[date, int]] = field(default_factory=list)  # (date, n) where n < MIN_PLAYERS

    @property
    def consecutive_gaps(self) -> list[list[date]]:
        """Groups of 2+ consecutive empty Mondays."""
        if len(self.empty_dates) < 2:
            return []
        groups: list[list[date]] = []
        current: list[date] = [self.empty_dates[0]]
        for i in range(1, len(self.empty_dates)):
            if (self.empty_dates[i] - self.empty_dates[i - 1]).days == 7:
                current.append(self.empty_dates[i])
            else:
                if len(current) >= 2:
                    groups.append(current)
                current = [self.empty_dates[i]]
        if len(current) >= 2:
            groups.append(current)
        return groups

    @property
    def has_warnings(self) -> bool:
        return bool(self.consecutive_gaps or self.low_count)


def parse_players_from_html(html: str) -> list[dict] | None:
    """Extract razor.players array from server-rendered HTML. Returns None if block missing."""
    match = re.search(r"razor\.players\s*=\s*(\[.*?\]);", html, re.DOTALL)
    if not match:
        return None
    return json.loads(match.group(1))  # type: ignore[no-any-return]


def normalize_attendees(players: list[dict]) -> tuple[list[dict], bool]:
    """
    Partition a raw player list into (attendees, multi_event):
    - NbTournaments == 1: included as-is.
    - NbTournaments == 2: included with TotalMatchPoints // 2 (double-entry; split evenly).
    - NbTournaments  > 2: excluded; multi_event=True signals the caller to flag the day.
    """
    attendees: list[dict] = []
    multi_event = False
    for p in players:
        nbt = p["NbTournaments"]
        if nbt == 1:
            attendees.append(p)
        elif nbt == 2:
            entry = dict(p)
            entry["TotalMatchPoints"] = p["TotalMatchPoints"] // 2
            attendees.append(entry)
        else:
            multi_event = True
    return attendees, multi_event


def _fetch_players(day: date, extra_days: int) -> list[dict] | None:
    """Raw POST for [day, day + extra_days]. Returns player list or None on parse failure."""
    response = requests.post(
        BASE_URL,
        data={
            "leagueId": str(LEAGUE_ID),
            "leagueName": "Magic Mates Monday",
            "StoreName": "Chromatic Games",
            "filterType": "Custom",
            "start": day.strftime("%d/%m/%Y"),
            "end": (day + timedelta(days=extra_days)).strftime("%d/%m/%Y"),
            "month": day.strftime("%B %Y"),
            "seasonId": "45",
        },
        timeout=30,
    )
    response.raise_for_status()
    return parse_players_from_html(response.text)


def scrape_day(day: date) -> MondayResult | None:
    """
    Query a single day. Tries [day, day] first; if no players are returned,
    retries [day, day+1] to catch events entered a day late.
    actual_date is set to day+1 when the fallback fires, so callers save the
    file under the date the tournament actually lives on — preventing double-counting
    when the next iteration probes day+1 directly.
    """
    for extra_days in (0, 1):
        players = _fetch_players(day, extra_days)
        if not players:
            continue
        attendees, multi_event = normalize_attendees(players)
        if attendees or multi_event:
            actual = day + timedelta(days=extra_days)
            if extra_days == 1:
                log.debug("found data with +1 day fallback", probe=day.isoformat(), actual_date=actual.isoformat())
            return MondayResult(attendees=attendees, multi_event=multi_event, actual_date=actual)
    return None


def scrape_season(season: dict, force: bool = False) -> ScrapeSummary:
    """
    Scrape every calendar day in the season using a single-day window (start=day, end=day).
    This avoids NbTournaments>1 noise from manual corrections entered on adjacent days.
    Gap analysis is still performed against expected Mondays.
    Returns a ScrapeSummary with counts and any inline warnings.
    """
    season_id = season["id"]
    set_code = season["set_code"]
    name = season["name"]
    starts_on = date.fromisoformat(season["starts_on"])
    ends_on = date.fromisoformat(season["ends_on"])

    season_dir = DATA_DIR / season_dir_name(season)
    season_dir.mkdir(parents=True, exist_ok=True)

    today = date.today()
    all_mondays = get_mondays(starts_on, ends_on)
    past_mondays = [m for m in all_mondays if m <= today]
    future_count = len(all_mondays) - len(past_mondays)

    log.info(
        "scraping season days",
        season_id=season_id,
        start=starts_on.isoformat(),
        end=min(ends_on, today).isoformat(),
        future_mondays_skipped=future_count,
    )

    hashes = _load_hashes()
    # Build reverse map for O(1) duplicate detection: hash_value → relative_path
    hash_to_path: dict[str, str] = {v: k for k, v in hashes.items()}

    newly_saved = 0
    skipped_existing = 0
    multi_event_dates: list[date] = []

    day = starts_on
    while day <= min(ends_on, today):
        file_path = season_dir / f"{day.isoformat()}.json"
        if file_path.exists() and not force:
            log.debug("skipping (already scraped)", date=day.isoformat())
            skipped_existing += 1
            day += timedelta(days=1)
            continue

        result = scrape_day(day)
        if result is not None:
            if result.multi_event:
                multi_event_dates.append(result.actual_date)
                log.warning(
                    "multiple events on same day — NbT>2 players excluded",
                    date=result.actual_date.isoformat(),
                    set_code=set_code,
                )
            if result.attendees:
                # Save under actual_date (may be day+1 when fallback fired)
                actual_path = season_dir / f"{result.actual_date.isoformat()}.json"
                rel_path = str(actual_path.relative_to(DATA_DIR))
                monday = result.actual_date - timedelta(days=result.actual_date.weekday())
                h = _tournament_hash(set_code, monday, result.attendees)

                existing_for_hash = hash_to_path.get(h)
                if existing_for_hash is not None and existing_for_hash != rel_path:
                    log.info(
                        "duplicate tournament skipped",
                        date=result.actual_date.isoformat(),
                        set_code=set_code,
                        already_saved_as=existing_for_hash,
                    )
                elif not actual_path.exists() or force:
                    is_new = not actual_path.exists()
                    payload = {
                        "season_id": season_id,
                        "tournament_date": result.actual_date.isoformat(),
                        "players": result.attendees,
                    }
                    actual_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
                    if is_new:
                        newly_saved += 1
                    hashes[rel_path] = h
                    hash_to_path[h] = rel_path
                    log.info("tournament saved", date=result.actual_date.isoformat(), players=len(result.attendees), new=is_new)
            else:
                log.debug("no single-event players found", date=day.isoformat())

        day += timedelta(days=1)
        time.sleep(REQUEST_DELAY)

    _save_hashes(hashes)

    # Scan the season dir for all existing JSON files for post-scrape health check
    existing_files = sorted(season_dir.glob("*.json"))
    events_on_disk = len(existing_files)

    found_dates = {date.fromisoformat(f.stem) for f in existing_files}
    # Map each found date back to its Monday (Mon=0 … Sun=6)
    covered_mondays = {d - timedelta(days=d.weekday()) for d in found_dates}
    # Mondays with no tournament in their entire week = missing events
    empty_dates = sorted(m for m in past_mondays if m not in covered_mondays)
    # Log any tournament found on a non-Monday so it's visible in the log
    non_monday = sorted(d for d in found_dates if d.weekday() != 0)
    if non_monday:
        log.info(
            "tournaments found on non-Monday dates (mapped to their Monday)",
            set_code=set_code,
            dates=[d.isoformat() for d in non_monday],
        )

    low_count: list[tuple[date, int]] = []
    for f in existing_files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, UnicodeDecodeError):
            continue
        n = len(data.get("players", []))
        if n < MIN_PLAYERS:
            low_count.append((date.fromisoformat(data["tournament_date"]), n))

    summary = ScrapeSummary(
        set_code=set_code,
        name=name,
        total_mondays=len(past_mondays),
        events_on_disk=events_on_disk,
        newly_saved=newly_saved,
        skipped_existing=skipped_existing,
        empty_dates=empty_dates,
        future_count=future_count,
        multi_event_dates=multi_event_dates,
        low_count=low_count,
    )

    # Inline warnings
    for gap in summary.consecutive_gaps:
        log.warning(
            "consecutive empty Mondays",
            set_code=set_code,
            dates=[d.isoformat() for d in gap],
            count=len(gap),
        )
    for d, n in low_count:
        log.warning("low player count", set_code=set_code, date=d.isoformat(), players=n, threshold=MIN_PLAYERS)

    log.info(
        "season scrape complete",
        set_code=set_code,
        events_on_disk=events_on_disk,
        newly_saved=newly_saved,
        skipped_existing=skipped_existing,
        empty=len(empty_dates),
        future_skipped=future_count,
    )
    return summary
