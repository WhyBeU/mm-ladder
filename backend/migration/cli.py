import click
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from migration.importer import run_import
from migration.scraper import scrape_season
from migration.seasons import SEASONS
from migration.verifier import run_verify
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

    log.info("starting migration", db=db, set_code=set_code or "all")
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
@click.option("--set-code", default=None, help="Verify only this season set code (e.g. tdm). Default: all.")
def verify(db: str, set_code: str | None) -> None:
    """Verify the migration per season and all-time against limitedspoiler.com. Exit code 1 if any mismatch."""
    if set_code is not None and _find_season(set_code) is None:
        log.error("season not found", set_code=set_code)
        raise SystemExit(1)

    session = _make_session(db)
    try:
        seasons_checked, total_mismatches = run_verify(session, set_code=set_code)
    finally:
        session.close()

    if total_mismatches < 0:
        log.error("could not parse all-time data from site")
        raise SystemExit(1)
    if total_mismatches:
        log.error("verification failed", total_mismatches=total_mismatches)
        raise SystemExit(1)
    log.info("all verification passed", seasons=seasons_checked)


if __name__ == "__main__":
    cli()
