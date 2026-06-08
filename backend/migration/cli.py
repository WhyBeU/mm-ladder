from datetime import datetime
from pathlib import Path

import click
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from migration.consolidation import run_auto_consolidation, run_select_consolidation
from migration.importer import run_import, seed_cups
from migration.scraper import ScrapeSummary, scrape_season
from migration.seasons import SEASONS
from migration.verifier import run_verify
from mm_ladder.logger import configure_logging, get_logger
from mm_ladder.models import Base  # registers all models with metadata

_LOGS_DIR = Path(__file__).parent.parent / "logs"


def _log_file(command: str) -> Path:
    ts = datetime.now().strftime("%Y-%m-%dT%H-%M-%S")
    return _LOGS_DIR / f"{command}_{ts}.log"


configure_logging(dev=True, log_file=_log_file("scraper"))
log = get_logger("migration.cli")


def _make_session(db_path: str, recreate: bool = False):
    engine = create_engine(f"sqlite:///{db_path}")
    if recreate:
        Base.metadata.drop_all(engine)
        log.info("database tables dropped")
    Base.metadata.create_all(engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    return factory()


def _find_season(set_code: str) -> dict | None:
    return next((s for s in SEASONS if s["set_code"] == set_code), None)


def _print_scrape_summary(summaries: list[ScrapeSummary]) -> None:
    if not summaries:
        return
    name_w = max(len(s.name) for s in summaries)
    hdr = (
        f"  {'Set':<6}  {'Season':<{name_w}}  {'Mondays':>7}  {'On Disk':>7}"
        f"  {'Saved':>5}  {'Skipped':>7}  {'Empty':>5}  {'Future':>6}  Warnings"
    )
    sep = "  " + "-" * (len(hdr) - 2)
    print()
    print("=== Scrape Summary ===")
    print(hdr)
    print(sep)
    for s in summaries:
        warnings: list[str] = []
        if s.future_count:
            warnings.append(f"future:{s.future_count}")
        for gap in s.consecutive_gaps:
            warnings.append(f"gap:{len(gap)}wk@{gap[0].isoformat()}")
        for d in s.multi_event_dates:
            warnings.append(f"multi@{d.isoformat()}")
        for d, n in s.low_count:
            warnings.append(f"low:{n}@{d.isoformat()}")
        warn_str = "  ".join(warnings)
        print(
            f"  {s.set_code:<6}  {s.name:<{name_w}}  {s.total_mondays:>7}  {s.events_on_disk:>7}"
            f"  {s.newly_saved:>5}  {s.skipped_existing:>7}  {len(s.empty_dates):>5}  {s.future_count:>6}  {warn_str}"
        )
    # totals row
    print(sep)
    print(
        f"  {'TOTAL':<6}  {'':<{name_w}}  {sum(s.total_mondays for s in summaries):>7}"
        f"  {sum(s.events_on_disk for s in summaries):>7}"
        f"  {sum(s.newly_saved for s in summaries):>5}"
        f"  {sum(s.skipped_existing for s in summaries):>7}"
        f"  {sum(len(s.empty_dates) for s in summaries):>5}"
        f"  {sum(s.future_count for s in summaries):>6}"
    )

    # Missing Monday detail
    all_empty = [(s.set_code, d) for s in summaries for d in s.empty_dates]
    if all_empty:
        print()
        print("  Missing Mondays (no tournament data):")
        for set_code, d in all_empty:
            print(f"    {set_code}  {d.isoformat()}")


@click.group()
def cli() -> None:
    """mm-ladder migration tools for limitedspoiler.com data."""


@cli.command()
@click.option("--force", is_flag=True, default=False, help="Re-scrape even if file already exists.")
@click.option("--set-code", "-s", multiple=True, help="Season set code to scrape (repeatable: -s tdm -s dft). Default: all.")
def scrape(force: bool, set_code: tuple[str, ...]) -> None:
    """Fetch tournament data from limitedspoiler.com and save to migration/data/."""
    if set_code:
        seasons_to_scrape = []
        for sc in set_code:
            season = _find_season(sc)
            if season is None:
                log.error("season not found", set_code=sc)
                raise SystemExit(1)
            seasons_to_scrape.append(season)
    else:
        seasons_to_scrape = SEASONS

    summaries: list[ScrapeSummary] = []
    for season in seasons_to_scrape:
        log.info("scraping season", set_code=season["set_code"], name=season["name"])
        summary = scrape_season(season, force=force)
        summaries.append(summary)

    log.info("scrape complete", total_saved=sum(s.newly_saved for s in summaries))
    _print_scrape_summary(summaries)


@cli.command()
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
@click.option("--set-code", "-s", multiple=True, help="Season set code to migrate (repeatable: -s tdm -s dft). Default: all.")
@click.option("--recreate-db", is_flag=True, default=False, help="Drop and recreate all tables before migrating.")
def migrate(db: str, set_code: tuple[str, ...], recreate_db: bool) -> None:
    """Import all scraped data from migration/data/ into the database (idempotent)."""
    set_codes: list[str | None] = list(set_code) or [None]
    for sc in set_codes:
        if sc is not None and _find_season(sc) is None:
            log.error("season not found", set_code=sc)
            raise SystemExit(1)

    total_seasons = total_tournaments = total_players = 0
    for i, sc in enumerate(set_codes):
        log.info("starting migration", db=db, set_code=sc or "all", recreate_db=(recreate_db and i == 0))
        session = _make_session(db, recreate=(recreate_db and i == 0))
        try:
            seasons, tournaments, players = run_import(session, set_code=sc)
            total_seasons += seasons
            total_tournaments += tournaments
            total_players += players
        except Exception as e:
            session.rollback()
            log.error("migration failed", error=str(e))
            raise SystemExit(1) from None
        finally:
            session.close()

    log.info(
        "migration complete",
        seasons_processed=total_seasons,
        tournaments_created=total_tournaments,
        players_created=total_players,
    )


@cli.command()
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
@click.option("--set-code", "-s", multiple=True, help="Season set code to verify (repeatable: -s tdm -s dft). Default: all.")
def verify(db: str, set_code: tuple[str, ...]) -> None:
    """Verify the migration per season and all-time against limitedspoiler.com. Exit code 1 if any mismatch."""
    set_codes: list[str | None] = list(set_code) or [None]
    for sc in set_codes:
        if sc is not None and _find_season(sc) is None:
            log.error("season not found", set_code=sc)
            raise SystemExit(1)

    total_mismatches = 0
    seasons_checked = 0
    for sc in set_codes:
        session = _make_session(db)
        try:
            checked, mismatches = run_verify(session, set_code=sc)
            seasons_checked += checked
            total_mismatches += max(mismatches, 0)
        finally:
            session.close()

    if total_mismatches < 0:
        log.error("could not parse all-time data from site")
        raise SystemExit(1)
    if total_mismatches:
        log.error("verification failed", total_mismatches=total_mismatches)
        raise SystemExit(1)
    log.info("all verification passed", seasons=seasons_checked)


@cli.command("seed-cups")
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
def seed_cups_cmd(db: str) -> None:
    """Create all yearly cups and link existing seasons to their cup (idempotent)."""
    session = _make_session(db)
    try:
        count = seed_cups(session)
        log.info("seed-cups complete", cups_upserted=count)
    except Exception as e:
        session.rollback()
        log.error("seed-cups failed", error=str(e))
        raise SystemExit(1) from None
    finally:
        session.close()


@cli.command("consolidate-players")
@click.option("--db", default="mm_ladder.db", show_default=True, help="Path to SQLite database file.")
@click.option("--dry-run", is_flag=True, default=False, help="Print planned merges without writing to the database.")
@click.option(
    "--select",
    "select_mode",
    is_flag=True,
    default=False,
    help="Manually pick players to merge from a browsable list instead of auto-detecting groups.",
)
@click.option(
    "--select-filter",
    default=None,
    help='With --select, only list players whose name starts with this string (case/accent-insensitive, e.g. "dam").',
)
def consolidate_players_cmd(db: str, dry_run: bool, select_mode: bool, select_filter: str | None) -> None:
    """Find and interactively merge duplicate player records, recording alternate spellings as aliases."""
    session = _make_session(db)
    try:
        if select_mode:
            run_select_consolidation(session, select_filter=select_filter, dry_run=dry_run)
        else:
            run_auto_consolidation(session, dry_run=dry_run)
    except Exception as e:
        session.rollback()
        log.error("consolidate-players failed", error=str(e))
        raise SystemExit(1) from None
    finally:
        session.close()


if __name__ == "__main__":
    cli()
