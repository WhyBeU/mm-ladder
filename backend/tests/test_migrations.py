import sqlite3
from pathlib import Path

import pytest

from mm_ladder.db_migrations import run_db_migrations


def test_run_db_migrations_creates_tables(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "m.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db.as_posix()}")
    monkeypatch.setenv("AUTO_MIGRATE", "1")

    run_db_migrations()

    con = sqlite3.connect(db)
    try:
        tables = {row[0] for row in con.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    finally:
        con.close()
    assert "audit_log" in tables
    assert "player" in tables


def test_run_db_migrations_respects_disable(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    db = tmp_path / "skip.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{db.as_posix()}")
    monkeypatch.setenv("AUTO_MIGRATE", "0")

    run_db_migrations()

    assert not db.exists()
