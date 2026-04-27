from collections.abc import AsyncGenerator, Generator
from typing import Any

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session, sessionmaker

from mm_ladder.app import create_app
from mm_ladder.models.base import Base

# ── Sync fixtures (kept for test_imports.py and any future sync tests) ────────


@pytest.fixture(scope="function")
def engine() -> Generator[Engine]:
    eng = create_engine("sqlite:///:memory:")

    @event.listens_for(eng, "connect")
    def _fk_pragma(dbapi_conn: Any, _record: Any) -> None:  # type: ignore[reportUnusedFunction]
        cursor = dbapi_conn.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()


@pytest.fixture(scope="function")
def session(engine: Engine) -> Generator[Session]:
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    with factory() as s:
        yield s


# ── Async fixtures (for API tests) ───────────────────────────────────────────


@pytest_asyncio.fixture  # type: ignore[misc]
async def async_engine() -> AsyncGenerator[AsyncEngine]:
    eng = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield eng
    async with eng.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await eng.dispose()


@pytest_asyncio.fixture  # type: ignore[misc]
async def async_session(async_engine: AsyncEngine) -> AsyncGenerator[AsyncSession]:
    factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with factory() as s:
        yield s


@pytest_asyncio.fixture  # type: ignore[misc]
async def client(async_engine: AsyncEngine) -> AsyncGenerator[AsyncClient]:
    app = create_app()
    app.state.session_factory = async_sessionmaker(async_engine, expire_on_commit=False)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
