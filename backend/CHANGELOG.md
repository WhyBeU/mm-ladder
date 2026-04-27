# Changelog

## [0.3.0] - 2026-04-27

### Added

- FastAPI async HTTP layer: `app.py` with `create_app()` factory and lifespan (engine setup/teardown)
- `logger.py` — structlog with `ConsoleRenderer` (dev/colours) and `JSONRenderer` (prod), controlled by `ENV` env var
- `errors.py` — `NotFoundError` (404) and `ConflictError` (409) with FastAPI exception handlers; `IntegrityError` mapped to 409
- `deps.py` — `SessionDep` + per-service dependency aliases (`PlayerServiceDep`, `MatchServiceDep`, etc.)
- `interface/` package — request-only schemas (`*CreateRequest`, `*UpdateRequest`, `*PatchRequest`) for all 6 resources
- `services/` package — class-based services (`PlayerService`, `YearlyCupService`, `SeasonService`, `TournamentService`, `TournamentParticipantService`, `MatchService`) injected with `AsyncSession`
- `MatchService` auto-toggles `Tournament.has_match_detail` on first/last match create/delete
- `routes/` package — 4 router files covering 37 endpoints; `routes/tournament.py` bundles participants and matches under `/tournaments/{id}/`
- `GET /health` endpoint returning `{"status": "ok"}`
- `main.py` — uvicorn entry point for `python -m mm_ladder.main`
- `db.py` rewritten to async (`AsyncEngine` / `async_sessionmaker` / `aiosqlite`)
- 74 API smoke tests with per-function in-memory SQLite isolation via `ASGITransport`
- `docs/API.md` — full endpoint reference

### Changed

- `db.py` engine and session factory switched from sync SQLAlchemy to async (`aiosqlite` driver)

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
