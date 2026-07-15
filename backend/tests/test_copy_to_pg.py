from pathlib import Path

from sqlalchemy import create_engine, insert, select

from migration.copy_to_pg import copy_database
from mm_ladder.models import Base, Player


def test_copy_database_moves_rows(tmp_path: Path) -> None:
    src = f"sqlite:///{(tmp_path / 'src.db').as_posix()}"
    dest = f"sqlite:///{(tmp_path / 'dest.db').as_posix()}"
    src_eng = create_engine(src)
    Base.metadata.create_all(src_eng)
    with src_eng.begin() as conn:
        conn.execute(insert(Player).values(id=1, display_name="Yoann", aliases=["Why", "BeU"]))

    counts = copy_database(src, dest)

    assert counts["player"] == 1
    assert all(n == 0 for table, n in counts.items() if table != "player")
    dest_eng = create_engine(dest)
    with dest_eng.connect() as conn:
        row = conn.execute(select(Player.display_name, Player.aliases)).one()
    assert row.display_name == "Yoann"
    assert row.aliases == ["Why", "BeU"]


def test_copy_database_force_recreates_dest(tmp_path: Path) -> None:
    """force=True drops and recreates the destination schema, so re-runs don't collide."""
    src = f"sqlite:///{(tmp_path / 'src.db').as_posix()}"
    dest = f"sqlite:///{(tmp_path / 'dest.db').as_posix()}"
    src_eng = create_engine(src)
    Base.metadata.create_all(src_eng)
    with src_eng.begin() as conn:
        conn.execute(insert(Player).values(id=1, display_name="Yoann", aliases=[]))

    counts_first = copy_database(src, dest)
    counts_second = copy_database(src, dest, force=True)  # without force this would raise on the duplicate PK

    assert counts_first["player"] == 1
    assert counts_second["player"] == 1
    dest_eng = create_engine(dest)
    with dest_eng.connect() as conn:
        names = conn.execute(select(Player.display_name)).scalars().all()
    assert names == ["Yoann"]


def test_copy_database_skips_computed_columns(tmp_path: Path) -> None:
    """tournament_participant.points is GENERATED on Postgres — inserts must not include it."""
    src = f"sqlite:///{(tmp_path / 'src.db').as_posix()}"
    dest = f"sqlite:///{(tmp_path / 'dest.db').as_posix()}"
    create_engine(src).connect().close()  # touch file
    Base.metadata.create_all(create_engine(src))

    copy_database(src, dest)  # empty copy must not raise on any table

    tp = Base.metadata.tables["tournament_participant"]
    plain = [c.name for c in tp.columns if c.computed is None]
    assert "points" not in plain
