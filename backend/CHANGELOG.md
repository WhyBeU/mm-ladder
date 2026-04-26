# Changelog

## [0.2.0] - 2026-04-26

### Added

- SQLAlchemy 2.0 ORM models for all six tables: `Player`, `YearlyCup`, `Season`, `Tournament`, `TournamentParticipant`, `Match`
- `TimestampMixin` with Python-side `created_at`/`updated_at` defaults; `Match` is insert-only and carries only `created_at`
- `TournamentParticipant.points` as a DB-persisted `Computed` column (`match_wins * 3 + match_draws`)
- Alembic configured with `render_as_batch=True` for SQLite ALTER TABLE compatibility
- Migration `0001_initial` — full schema including CHECK constraint on `Match` and all FK/unique constraints
- Pydantic v2 `Create`/`Read` schema pairs for all six models; `MatchRead.outcome` derived via `@computed_field`
- `db.py` with `make_engine` / `make_session_factory` helpers
- In-memory SQLite test fixtures with `PRAGMA foreign_keys=ON`

## [0.1.0] - 2026-04-25

- Initial project scaffold: asdf, Poetry, tox, ruff, pyright, pytest
