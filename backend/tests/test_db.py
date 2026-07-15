from sqlalchemy.pool import NullPool

from mm_ladder.db import make_engine


def test_sqlite_engine_uses_default_pool() -> None:
    eng = make_engine("sqlite+aiosqlite:///:memory:")
    assert not isinstance(eng.sync_engine.pool, NullPool)


def test_neon_pooled_url_gets_nullpool() -> None:
    eng = make_engine("postgresql+asyncpg://u:p@ep-x-pooler.ap-southeast-2.aws.neon.tech/db?ssl=require")
    assert isinstance(eng.sync_engine.pool, NullPool)


def test_direct_postgres_url_keeps_default_pool() -> None:
    eng = make_engine("postgresql+asyncpg://u:p@ep-x.ap-southeast-2.aws.neon.tech/db?ssl=require")
    assert not isinstance(eng.sync_engine.pool, NullPool)
