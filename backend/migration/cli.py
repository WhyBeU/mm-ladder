import json
import re

import click
import requests
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from migration.importer import run_import
from migration.scraper import scrape_season
from migration.seasons import SEASONS
from mm_ladder.logger import configure_logging, get_logger

configure_logging(dev=True)
log = get_logger("migration.cli")


def _make_session(db_path: str):
    engine = create_engine(f"sqlite:///{db_path}")
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    return factory()


def _find_season(set_code: str) -> dict | None:
    return next((s for s in SEASONS if s["set_code"] == set_code), None)


@click.group()
def cli() -> None:
    """mm-ladder migration tools for limitedspoiler.com data."""


@cli.command()
@click.option("--force", is_flag=True, default=False, help="Re-scrape even if file already exists.")
@click.option("--set-code", default=None, help="Scrape only this season set code (e.g. tdm). Default: all.")
def scrape(force: bool, set_code: str | None) -> None:
    """Fetch tournament data from limitedspoiler.com and save to migration/data/."""
    if set_code is not None:
        season = _find_season(set_code)
        if season is None:
            log.error("season not found", set_code=set_code)
            raise SystemExit(1)
        seasons_to_scrape = [season]
    else:
        seasons_to_scrape = SEASONS

    total_saved = 0
    for season in seasons_to_scrape:
        log.info("scraping season", set_code=season["set_code"], name=season["name"])
        saved = scrape_season(season, force=force)
        log.info("season scraped", set_code=season["set_code"], tournaments_saved=saved)
        total_saved += saved

    log.info("scrape complete", total_saved=total_saved)


@cli.command()
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
@click.option("--set-code", default=None, help="Re-migrate only this season set code (e.g. tdm). Default: all.")
def migrate(db: str, set_code: str | None) -> None:
    """Import all scraped data from migration/data/ into the database (idempotent)."""
    if set_code is not None and _find_season(set_code) is None:
        log.error("season not found", set_code=set_code)
        raise SystemExit(1)

    session = _make_session(db)
    try:
        seasons, tournaments, players = run_import(session, set_code=set_code)
        log.info(
            "migration complete",
            seasons_processed=seasons,
            tournaments_created=tournaments,
            players_created=players,
        )
    except Exception as e:
        session.rollback()
        log.error("migration failed", error=str(e))
        raise SystemExit(1)
    finally:
        session.close()


@cli.command()
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
def verify(db: str) -> None:
    """
    Compare per-player lifetime points in the DB against limitedspoiler.com all-time data.
    Logs any mismatches. Exit code 1 if any mismatch found.
    """
    log.info("fetching all-time data from limitedspoiler.com")
    response = requests.post(
        "https://limitedspoiler.com/Team",
        data={
            "leagueId": "8",
            "leagueName": "Magic Mates Monday",
            "StoreName": "Chromatic Games",
            "filterType": "Custom",
            "start": "01/01/2016",
            "end": "12/31/2030",
            "month": "January 2016",
            "seasonId": "45",
        },
        timeout=30,
    )
    match = re.search(r"razor\.players\s*=\s*(\[.*?\]);", response.text, re.DOTALL)
    if not match:
        log.error("could not parse all-time data from site")
        raise SystemExit(1)

    site_players: list[dict] = json.loads(match.group(1))
    site_totals = {f"{p['Firstname']} {p['Lastname']}": p["TotalMatchPoints"] for p in site_players}

    session = _make_session(db)
    try:
        rows = session.execute(
            text("""
                SELECT p.display_name, SUM(tp.points) as total_points
                FROM player p
                JOIN tournament_participant tp ON tp.player_id = p.id
                GROUP BY p.id
            """)
        ).fetchall()
        db_totals = {row[0]: row[1] for row in rows}
    finally:
        session.close()

    mismatches = []
    for name, site_pts in site_totals.items():
        db_pts = db_totals.get(name, 0)
        if db_pts != site_pts:
            mismatches.append((name, db_pts, site_pts))

    if mismatches:
        for name, db_pts, site_pts in mismatches:
            log.warning("point mismatch", player=name, db_pts=db_pts, site_pts=site_pts, diff=site_pts - db_pts)
        log.error("verification failed", mismatches=len(mismatches))
        raise SystemExit(1)
    else:
        log.info("verification passed", players_checked=len(site_totals))


if __name__ == "__main__":
    cli()
