import json
import re
import time
from datetime import date

import requests
from sqlalchemy import text
from sqlalchemy.orm import Session

from migration.scraper import scrape_monday
from migration.seasons import SEASONS, get_mondays
from mm_ladder.logger import get_logger

log = get_logger("migration.verifier")

REQUEST_DELAY = 0.5
SITE_URL = "https://limitedspoiler.com/Team"


def fetch_site_totals(start: str, end: str) -> dict[str, int] | None:
    """POST to limitedspoiler.com and return {display_name: total_points} or None on parse failure."""
    response = requests.post(
        SITE_URL,
        data={
            "leagueId": "8",
            "leagueName": "Magic Mates Monday",
            "StoreName": "Chromatic Games",
            "filterType": "Custom",
            "start": start,
            "end": end,
            "month": "January 2016",
            "seasonId": "45",
        },
        timeout=30,
    )
    match = re.search(r"razor\.players\s*=\s*(\[.*?\]);", response.text, re.DOTALL)
    if not match:
        return None
    players: list[dict] = json.loads(match.group(1))
    return {f"{p['Firstname']} {p['Lastname']}": p["TotalMatchPoints"] for p in players}


def collect_season_site_totals(season_meta: dict) -> dict[str, int]:
    """
    Re-fetch each Monday in the season using the same per-Monday ±2 day windows as the scraper.
    Returns {display_name: total_season_points}.
    """
    starts_on = date.fromisoformat(season_meta["starts_on"])
    ends_on = date.fromisoformat(season_meta["ends_on"])
    mondays = get_mondays(starts_on, ends_on)
    log.debug("fetching site data for season", set_code=season_meta["set_code"], mondays=len(mondays))

    totals: dict[str, int] = {}
    for monday in mondays:
        players = scrape_monday(monday)
        if players:
            for p in players:
                display_name = f"{p['Firstname']} {p['Lastname']}"
                totals[display_name] = totals.get(display_name, 0) + p["TotalMatchPoints"]
        time.sleep(REQUEST_DELAY)

    return totals


def verify_season(session: Session, set_code: str, name: str) -> int:
    """
    Verify one season against limitedspoiler.com using per-Monday requests.
    Returns number of mismatches found (0 = clean).
    """
    log.info("verifying season", set_code=set_code, name=name)

    season_meta = next((s for s in SEASONS if s["set_code"] == set_code), None)
    if season_meta is None:
        log.warning("season not found in SEASONS, skipping", set_code=set_code)
        return 1

    site_totals = collect_season_site_totals(season_meta)

    rows = session.execute(
        text("""
            SELECT p.display_name, SUM(tp.points) as season_points
            FROM player p
            JOIN tournament_participant tp ON tp.player_id = p.id
            JOIN tournament t ON tp.tournament_id = t.id
            JOIN season s ON t.season_id = s.id
            WHERE s.set_code = :set_code AND t.is_migrated = 1
            GROUP BY p.id
        """),
        {"set_code": set_code},
    ).fetchall()
    db_totals = {r[0]: r[1] for r in rows}

    season_mismatches = [
        (player, db_totals.get(player, 0), site_pts)
        for player, site_pts in site_totals.items()
        if db_totals.get(player, 0) != site_pts
    ]
    site_count = len(site_totals)
    db_count = len(db_totals)

    if season_mismatches or site_count != db_count:
        for player, db_pts, site_pts in season_mismatches:
            log.warning(
                "point mismatch",
                set_code=set_code,
                player=player,
                db_pts=db_pts,
                site_pts=site_pts,
                diff=site_pts - db_pts,
            )
        if site_count != db_count:
            log.warning(
                "player count mismatch",
                set_code=set_code,
                db_players=db_count,
                site_players=site_count,
            )
        log.error("season verification failed", set_code=set_code, mismatches=len(season_mismatches))
        return len(season_mismatches) + (1 if site_count != db_count else 0)

    log.info("season verified", set_code=set_code, players=db_count)
    return 0


def run_verify(session: Session, set_code: str | None = None) -> tuple[int, int]:
    """
    Verify all migrated seasons (or just one if set_code given) and all-time totals.
    Returns (seasons_checked, total_mismatches). total_mismatches=-1 means all-time parse failure.
    """
    query = """
        SELECT DISTINCT s.set_code, s.name
        FROM season s
        JOIN tournament t ON t.season_id = s.id
        WHERE t.is_migrated = 1
    """
    params: dict = {}
    if set_code is not None:
        query += " AND s.set_code = :set_code"
        params["set_code"] = set_code
    query += " ORDER BY s.starts_on"

    migrated_seasons = session.execute(text(query), params).fetchall()

    log.info("verifying seasons", count=len(migrated_seasons))
    total_mismatches = 0

    for row in migrated_seasons:
        set_code, name = row
        total_mismatches += verify_season(session, set_code, name)

    log.info("fetching all-time totals from site")
    site_all = fetch_site_totals("01/01/2016", "12/31/2030")
    if site_all is None:
        log.error("could not parse all-time data from site")
        return len(migrated_seasons), -1

    rows = session.execute(
        text("""
            SELECT p.display_name, SUM(tp.points) as total_points
            FROM player p
            JOIN tournament_participant tp ON tp.player_id = p.id
            GROUP BY p.id
        """)
    ).fetchall()
    db_all = {r[0]: r[1] for r in rows}

    log.info("comparing all-time totals", site_players=len(site_all), db_players=len(db_all))
    alltime_mismatches = [
        (name, db_all.get(name, 0), pts)
        for name, pts in site_all.items()
        if db_all.get(name, 0) != pts
    ]
    if alltime_mismatches:
        for name, db_pts, site_pts in alltime_mismatches:
            log.warning("all-time mismatch", player=name, db_pts=db_pts, site_pts=site_pts, diff=site_pts - db_pts)
        total_mismatches += len(alltime_mismatches)

    return len(migrated_seasons), total_mismatches
