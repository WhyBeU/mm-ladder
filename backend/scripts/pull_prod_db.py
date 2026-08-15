"""Snapshot the production database into a local copy.

Usage (from backend/):
    poetry run python scripts/pull_prod_db.py                     # -> backend/mm_ladder_prod.db
    poetry run python scripts/pull_prod_db.py --force             # replace an existing snapshot
    poetry run python scripts/pull_prod_db.py --dest logs/2026-08-15.db
    poetry run python scripts/pull_prod_db.py --dest-url postgresql+psycopg://localhost/mm --force

The source is Neon prod ($NEON_DIRECT_URL, falling back to backend/.env) unless --src-url says
otherwise, and it is only ever read from — every write lands on the destination.

The destination gets `alembic upgrade head` first, so `alembic_version` is stamped and the API's
start-up auto-migrate stays a no-op; rows are then copied table by table in FK-safe order, leaving
computed columns (`points`) for the destination to recompute. Snapshot files are `*.db`, which is
gitignored. Note the one wrinkle of `--dest-url --force`: the existing tables there are dropped and
rebuilt from the ORM models rather than by Alembic, since the stamped revision makes `upgrade head`
a no-op. A SQLite destination sidesteps this — the file is deleted and rebuilt from scratch.

Run the API against the snapshot with:
    $env:DATABASE_URL = "sqlite+aiosqlite:///./mm_ladder_prod.db"; poetry run uvicorn mm_ladder.app:app
"""

import argparse
import os
from pathlib import Path

from _db_url import PROD_URL_ENV, mask, prod_url
from sqlalchemy.engine import make_url

from alembic import command
from alembic.config import Config
from migration.copy_to_pg import copy_database
from mm_ladder.db_migrations import _sync_url
from mm_ladder.logger import configure_logging, get_logger

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DEST = BACKEND_DIR / "mm_ladder_prod.db"

configure_logging(dev=True)
log = get_logger("scripts.pull_prod_db")


def sqlite_url(path: Path) -> str:
    return f"sqlite:///{path.as_posix()}"


def clear_sqlite_file(path: Path) -> None:
    """Delete the snapshot and its WAL sidecars, so the copy starts from an empty database."""
    for suffix in ("", "-wal", "-shm"):
        sidecar = path.with_name(path.name + suffix)
        if sidecar.exists():
            sidecar.unlink()


def upgrade_to_head(dest_url: str) -> None:
    """Build the destination schema with Alembic, so alembic_version matches the copied rows.

    alembic/env.py prefers $DATABASE_URL over the config, so the variable is pointed at the
    destination for the duration of the upgrade — otherwise a shell already aimed at Neon would
    migrate prod instead of the snapshot.
    """
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    previous = os.environ.get("DATABASE_URL")
    os.environ["DATABASE_URL"] = dest_url
    try:
        command.upgrade(cfg, "head")
    finally:
        if previous is None:
            del os.environ["DATABASE_URL"]
        else:
            os.environ["DATABASE_URL"] = previous


def identity(url: str) -> tuple[str, ...]:
    """A comparable key for "same database", so the copy can refuse to run onto its own source.

    SQLite URLs are compared as resolved filesystem paths — `sqlite:///./mm_ladder_prod.db` and the
    absolute form of the same file must not look like two different databases, or the destination
    gets truncated before it is read.
    """
    parsed = make_url(url)
    if parsed.get_backend_name() == "sqlite":
        database = parsed.database or ""
        return ("sqlite", os.path.normcase(str(Path(database).resolve())) if database else ":memory:")
    return (parsed.get_backend_name(), str(parsed.host), str(parsed.port), str(parsed.database))


def resolve_destination(dest: str | None, dest_url: str | None) -> tuple[str, Path | None]:
    """Returns (url, file). The file is None for --dest-url — only SQLite snapshots own a path."""
    if dest_url:
        return _sync_url(dest_url), None
    path = Path(dest).resolve() if dest else DEFAULT_DEST
    return sqlite_url(path), path


def main() -> None:
    parser = argparse.ArgumentParser(description="Copy the production database into a local snapshot.")
    parser.add_argument("--dest", help=f"SQLite snapshot file (default: {DEFAULT_DEST})")
    parser.add_argument("--dest-url", help="Explicit destination URL (e.g. a local Postgres); overrides --dest")
    parser.add_argument("--src-url", help=f"Explicit source URL, async form accepted (default: ${PROD_URL_ENV})")
    parser.add_argument("--force", action="store_true", help="Replace an existing destination instead of refusing")
    args = parser.parse_args()

    src_url = _sync_url(args.src_url or prod_url())
    dest_url, dest_file = resolve_destination(args.dest, args.dest_url)

    if identity(src_url) == identity(dest_url):
        log.error("destination is the source — refusing to copy a database onto itself", url=mask(dest_url))
        raise SystemExit(2)

    if dest_file is not None:
        if dest_file.exists() and not args.force:
            log.error("snapshot already exists — pass --force to replace it", dest=str(dest_file))
            raise SystemExit(2)
        dest_file.parent.mkdir(parents=True, exist_ok=True)
        clear_sqlite_file(dest_file)

    log.info("snapshotting database", source=mask(src_url), destination=mask(dest_url))
    upgrade_to_head(dest_url)
    try:
        counts = copy_database(src_url, dest_url, force=args.force and dest_file is None)
    except Exception as e:
        log.error("snapshot failed", error=str(e))
        raise SystemExit(1) from None

    log.info("snapshot complete", tables=len(counts), total_rows=sum(counts.values()), rows_per_table=counts)
    if dest_file is not None:
        log.info("run against it", database_url=f"sqlite+aiosqlite:///{dest_file.as_posix()}")


if __name__ == "__main__":
    main()
