import os
from pathlib import Path

from mm_ladder.logger import get_logger

log = get_logger("mm_ladder.migrations")


def _sync_url(database_url: str) -> str:
    """Alembic runs synchronously, so strip async driver suffixes from the app's DATABASE_URL."""
    return database_url.replace("+aiosqlite", "")


def run_db_migrations() -> None:
    """Upgrade the configured database to the latest Alembic revision.

    Called on app startup so a fresh checkout / new column is never missing its table. Disable by
    setting AUTO_MIGRATE to 0/false/no (e.g. when migrations are managed out-of-band in production).
    """
    if os.getenv("AUTO_MIGRATE", "1").strip().lower() in {"0", "false", "no"}:
        log.info("auto-migrate disabled via AUTO_MIGRATE")
        return

    from alembic import command
    from alembic.config import Config

    backend_dir = Path(__file__).resolve().parents[2]  # .../backend
    cfg = Config(str(backend_dir / "alembic.ini"))
    cfg.set_main_option("script_location", str(backend_dir / "alembic"))
    cfg.set_main_option("sqlalchemy.url", _sync_url(os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./mm_ladder.db")))

    log.info("applying database migrations")
    command.upgrade(cfg, "head")
    log.info("database migrations up to date")
