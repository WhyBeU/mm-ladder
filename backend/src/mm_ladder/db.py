from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine


def enable_sqlite_foreign_keys(engine: AsyncEngine) -> None:
    """Enforce foreign keys on SQLite, which defaults them OFF per-connection.

    No-op on other dialects (Postgres always enforces FKs). Without this, deleting a
    parent row silently orphans its children instead of raising.
    """
    if engine.dialect.name != "sqlite":
        return

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_pragma(dbapi_conn: Any, _record: Any) -> None:  # type: ignore[reportUnusedFunction]
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


def make_engine(url: str = "sqlite+aiosqlite:///./mm_ladder.db") -> AsyncEngine:
    engine = create_async_engine(url)
    enable_sqlite_foreign_keys(engine)
    return engine


def make_session_factory(engine: AsyncEngine) -> async_sessionmaker[AsyncSession]:
    return async_sessionmaker(engine, expire_on_commit=False)
