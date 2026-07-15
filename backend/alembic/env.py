import os
import sys
from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src"))

from mm_ladder.db_migrations import _sync_url  # noqa: E402 — must come after sys.path insert
from mm_ladder.models import Base  # noqa: E402 — must come after sys.path insert

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Prefer DATABASE_URL when set, so `alembic upgrade head` targets the same database as the app
# (CI Postgres service, Neon in the deploy pipeline). Falls back to alembic.ini's sqlite URL.
# `%` must be doubled — set_main_option values go through ConfigParser interpolation.
_env_url = os.getenv("DATABASE_URL")
if _env_url:
    config.set_main_option("sqlalchemy.url", _sync_url(_env_url).replace("%", "%%"))

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        render_as_batch=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            render_as_batch=True,
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
