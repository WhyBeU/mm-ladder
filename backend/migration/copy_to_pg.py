"""One-time data copy between databases (SQLite prod file -> Neon Postgres).

Copies every table in FK-safe order, skipping computed columns (Postgres refuses inserts
into GENERATED columns), then resets PG sequences so future inserts get fresh ids.
"""

from sqlalchemy import create_engine, insert, select, text

from mm_ladder.logger import get_logger
from mm_ladder.models import Base

log = get_logger("migration.copy_to_pg")


def copy_database(src_url: str, dest_url: str, force: bool = False) -> dict[str, int]:
    """Copy all rows of every model table from src to dest. Returns {table_name: rows_copied}.

    With force=True the destination tables are dropped and recreated first, so the copy can be
    re-run from scratch (otherwise re-copying existing rows fails on primary-key conflicts).
    """
    src = create_engine(src_url)
    dest = create_engine(dest_url)
    if force:
        log.warning("force: dropping all destination tables", dest_dialect=dest.dialect.name)
        Base.metadata.drop_all(dest)
    Base.metadata.create_all(dest)  # no-op when Alembic already built the schema
    counts: dict[str, int] = {}

    with src.connect() as read, dest.begin() as write:
        for table in Base.metadata.sorted_tables:
            plain_cols = [c for c in table.columns if c.computed is None]
            rows = read.execute(select(*plain_cols)).mappings().all()
            if rows:
                write.execute(insert(table), [dict(r) for r in rows])
            counts[table.name] = len(rows)
            log.info("table copied", table=table.name, rows=len(rows))

        if dest.dialect.name == "postgresql":
            for table in Base.metadata.sorted_tables:
                for col in table.primary_key.columns:
                    if col.autoincrement is not True:
                        continue
                    write.execute(
                        text(
                            f"SELECT setval(pg_get_serial_sequence('{table.name}', '{col.name}'), "
                            f"(SELECT COALESCE(MAX({col.name}), 0) + 1 FROM {table.name}), false)"
                        )
                    )
    return counts
