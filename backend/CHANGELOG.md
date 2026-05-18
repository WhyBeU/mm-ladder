# Changelog

## [0.4.0] - 2026-05-19

### Added

- `migration/` package — one-shot data pipeline to backfill historical tournament results from limitedspoiler.com
  - `seasons.py` — metadata for 39 seasons (Shadows over Innistrad 2016 → Secrets of Strixhaven 2026) with W/L/D lookup table
  - `scraper.py` — per-Monday HTTP scraping with ±2-day windows; saves raw JSON under `migration/data/season_{id}/`
  - `importer.py` — idempotent importer: resets migrated data then re-imports; resolves W/L/D from match points; handles UTF-8/cp1252 encoding and skips corrupted files
  - `verifier.py` — cross-checks DB totals against limitedspoiler.com per-season (re-fetching each Monday with the same windows as the scraper) and all-time; logs per-player point mismatches and player-count mismatches
  - `cli.py` — `migrate` entry point with three commands: `scrape`, `migrate`, `verify`; all support `--set-code` to target a single season
- `is_migrated` column on `Tournament` (Alembic migration `0003`, default `False`)

## [0.3.1] - 2026-05-03

### Added

- `CORSMiddleware` configured to allow the frontend dev server (`http://localhost:3000` by default, overridable via `CORS_ORIGINS` env var) — unblocks browser fetch from the Next.js frontend

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
