import json
import re
import time
from datetime import date, timedelta
from pathlib import Path

import requests
from migration.seasons import get_mondays
from mm_ladder.logger import get_logger

log = get_logger("migration.scraper")

BASE_URL = "https://limitedspoiler.com/Team"
LEAGUE_ID = 8
DATA_DIR = Path(__file__).parent / "data"
REQUEST_DELAY = 0.5


def parse_players_from_html(html: str) -> list[dict] | None:
    """Extract razor.players array from server-rendered HTML. Returns None if block missing."""
    match = re.search(r"razor\.players\s*=\s*(\[.*?\]);", html, re.DOTALL)
    if not match:
        return None
    return json.loads(match.group(1))  # type: ignore[no-any-return]


def filter_single_tournament_players(players: list[dict]) -> list[dict]:
    """Keep only players who attended exactly one tournament in the query window."""
    return [p for p in players if p["NbTournaments"] == 1]


def scrape_monday(monday: date) -> list[dict] | None:
    """
    POST to limitedspoiler.com with a ±2 day window around the given Monday.
    Returns players with NbTournaments==1 (attended that Monday) or None if no tournament.
    """
    start = monday - timedelta(days=1)  # Sunday
    end = monday + timedelta(days=2)  # Wednesday

    response = requests.post(
        BASE_URL,
        data={
            "leagueId": str(LEAGUE_ID),
            "leagueName": "Magic Mates Monday",
            "StoreName": "Chromatic Games",
            "filterType": "Custom",
            "start": start.strftime("%m/%d/%Y"),
            "end": end.strftime("%m/%d/%Y"),
            "month": monday.strftime("%B %Y"),
            "seasonId": "45",
        },
        timeout=30,
    )
    response.raise_for_status()

    players = parse_players_from_html(response.text)
    if players is None:
        return None

    attendees = filter_single_tournament_players(players)
    return attendees if attendees else None


def scrape_season(season: dict, force: bool = False) -> int:
    """
    Scrape all Mondays for a season. Saves non-empty results to data/season_{id}/YYYY-MM-DD.json.
    Returns count of saved tournament files.
    """


    season_id = season["id"]
    starts_on = date.fromisoformat(season["starts_on"])
    ends_on = date.fromisoformat(season["ends_on"])

    season_dir = DATA_DIR / f"season_{season_id}"
    season_dir.mkdir(parents=True, exist_ok=True)

    mondays = get_mondays(starts_on, ends_on)
    log.info("scraping season mondays", season_id=season_id, total=len(mondays))

    saved = 0
    for monday in mondays:
        file_path = season_dir / f"{monday.isoformat()}.json"
        if file_path.exists() and not force:
            log.debug("skipping (already scraped)", date=monday.isoformat())
            continue

        log.debug("fetching", date=monday.isoformat())
        players = scrape_monday(monday)
        if players:
            payload = {
                "season_id": season_id,
                "tournament_date": monday.isoformat(),
                "players": players,
            }
            file_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
            saved += 1
            log.info("tournament saved", date=monday.isoformat(), players=len(players))
        else:
            log.debug("no tournament found", date=monday.isoformat())

        time.sleep(REQUEST_DELAY)

    return saved
