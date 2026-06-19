# Changelog

## [0.12.0] - 2026-06-19 — Non-destructive, idempotent migrate

### Changed

- **`migrate migrate` is now non-destructive by default.** It no longer wipes and rebuilds all migrated data on every run. Players are never deleted (so their ids stay stable for champion / POTY / cup-winner / qualification / match FK references), and tournaments already in the database (matched by season + date) are skipped — only missing events are imported. Re-running is a safe no-op.

### Added

- **`migrate migrate --force-re-upload`** — opt-in rebuild of the migrated tournaments in scope (the `-s` set(s), or all if no `-s`): deletes those tournaments and their participants and re-imports them from JSON, recomputing results, while preserving all player rows/ids. Use it to apply corrected source data; pairs with `migrate scrape --force`, which re-fetches and overwrites the JSON on disk.

## [0.11.0] - 2026-06-14 — Admin auth, player merge & audit log

### Added

- **Admin authentication** — `mm_ladder.auth.require_admin` checks an `X-Admin-Token` header against the `ADMIN_TOKEN` env var (constant-time compare) and is applied to **every** mutating route (players, seasons, yearly-cups, tournaments, participants, matches). Fails closed: if `ADMIN_TOKEN` is unset/empty, all writes are rejected with 401. GET endpoints stay public. New `GET /admin/check` validates a token.
- **`POST /players/merge`** (`{keep_id, duplicate_ids}`) — folds duplicate players into a keeper: repoints `tournament_participant` and `match` references, repoints the champion / POTY / cup-winner FKs and `yearly_cup_qualification` rows, folds the duplicates' names/aliases into the keeper, and deletes the duplicates. Rejects (409) a self-merge or a merge that would violate `uq_tp_tournament_player` / `ck_match_different_players`.
- **Audit log** — new `audit_log` table (migration `0009_add_audit_log`) + `AuditLog` model. An `AuditRecorder` writes an append-only entry (action, entity, human label/summary, and a `{field, old, new}` diff) into the same transaction as each admin mutation across all six entities — so the log is atomic with the change and excludes the (sync) migrate pipeline. Served by `GET /admin/audit` (filter by `entity_type`/`action`, `limit`/`offset` pagination, newest first).
- **Champion-award data on standings** — `SeasonStandingRead` now carries `season_championships` (`{set_code, season_name}[]`), `player_of_the_year_years`, and `cup_champion_years` for the leaderboard award icons.
- **Auto-migrate on startup** — `run_db_migrations()` runs `alembic upgrade head` in the app lifespan (derives a sync URL from `DATABASE_URL`); disable with `AUTO_MIGRATE=0`.

### Changed

- **Player aliases over the API** — `PlayerUpdateRequest`/`PlayerPatchRequest` accept `aliases`, and `PlayerRead` exposes it (previously model-only).
- **Participant reassignment** — `TournamentParticipantPatchRequest` accepts `player_id` to move a result to a different player without recreating the row.
- **Season patch** — `SeasonPatchRequest` now also accepts `yearly_cup_id` and `qualifying_type`.
- **Safe deletes** — deleting a player with tournament participations is rejected (409) — merge instead; deleting a tournament cascades its participants and matches.

## [0.10.0] - 2026-06-11

### Added

- `Season.champion_player_id` (nullable FK to `player.id`) — the season champion. Exposed on `SeasonRead` as `champion_player_id` and `champion_name` (the player's display name, or `null`).
- `YearlyCup.player_of_the_year_id` / `YearlyCup.cup_winner_id` (nullable FKs to `player.id`) — the cup's Player of the Year and cup champion. Exposed on `YearlyCupRead` as `player_of_the_year_id`/`player_of_the_year_name` and `cup_winner_id`/`cup_winner_name`.
- `YearlyCup.qualified_players` — many-to-many relationship (new `yearly_cup_qualification` table) tracking players qualified for a cup's playoff. Exposed on `YearlyCupRead` as `qualified_player_ids`.
- `Player.season_champion_set_codes`, `Player.player_of_the_year_cup_names`, `Player.cup_champion_cup_names` — reverse-lookup properties assembling a player's "trophy case" from the relationships above. Exposed on `PlayerRead` (only populated by `GET /players/{id}`, default `[]` on the leaderboard list).
- `SeasonCreateRequest`/`SeasonUpdateRequest`/`SeasonPatchRequest` accept `champion_player_id`. `YearlyCupCreateRequest`/`YearlyCupUpdateRequest`/`YearlyCupPatchRequest` accept `player_of_the_year_id`, `cup_winner_id`, and `qualified_player_ids`.
- Migration `0008_add_champions_and_cup_qualification` — adds the new FK columns and the `yearly_cup_qualification` association table.

## [0.9.0] - 2026-06-08

### Added

- `Player.aliases` (`list[str]`, default `[]`) — records alternate spellings of a player's name (accents, initials, punctuation variants) discovered during import or consolidation.
- Migration `0007_add_aliases_to_player` — adds the `aliases` JSON column (`server_default='[]'`).
- `mm_ladder.services.player_matching` — shared `name_tokens` / `normalize_player_name` / `find_matching_player` / `register_alias_if_new` helpers for accent/punctuation-insensitive name comparison and alias bookkeeping, used by both the importer and the player-creation API.
- `migrate consolidate-players` command — interactive one-off tool for merging duplicate player records: auto-detects likely duplicate groups (or lets the operator browse-and-pick via `--select`/`--select-filter`), screens out groups that would violate database constraints (shared tournament participation or head-to-head matches), previews the merge plan, and on confirmation repoints `tournament_participant`/`match` references to the survivor, records merged-away names as aliases, and deletes the duplicate rows. Supports `--dry-run`.

### Changed

- `migration.importer.ensure_player` and `PlayerService.create` now reuse an existing player when the requested name normalizes to an existing `display_name` or known `alias` (instead of creating a new duplicate record), and record the new spelling as an alias.

## [0.8.0] - 2026-06-07

### Added

- `Season.qualifying_type` (`"POINTS" | "BEST"`, default `"POINTS"`) — drives how cup-qualification standings are ranked: `POINTS` sorts by total points, `BEST` sorts by the total of a player's top `comp_avg_n` event scores. Both tiebreak on trophies, then win rate.
- `Player.is_veteran` / `SeasonStandingRead.is_veteran` — `true` once a player has played more than 52 events all-time, computed via a correlated subquery in `PlayerService.list` / `StandingsService`.
- Migration `0005_add_qualifying_type_to_season` — adds the `qualifying_type` column (`server_default='POINTS'`).
- Migration `0006_backfill_qualifying_type_war` — backfills existing qualifying seasons starting on/after War of the Spark (2019-04-27, `migration.seasons.BEST_QUALIFYING_FROM`) to `qualifying_type = 'BEST'`.

### Changed

- `migration.importer.ensure_season` now derives and persists `qualifying_type` from each season's start date (`BEST` from War of the Spark onward, `POINTS` before, `POINTS` for non-qualifying seasons).
- `StandingsService` standings sort branches on `qualifying_type`: `BEST` ranks by `comp_avg` (then trophies, then win rate); `POINTS` ranks by `points` (then trophies, then win rate).

## [0.7.0] - 2026-06-06

### Added

- `migrate seed-cups` command — creates one `YearlyCup` row per cup year (derived from `SEASONS` config) and links all existing `Season` rows to their cup via `yearly_cup_id`. Idempotent: safe to run multiple times.

## [0.6.0] - 2026-06-04

### Added

**Data**

- 506 tournament JSON files across all 45 seasons (soi 2016 → sos 2026) committed to the repository
- Season data directories renamed: `season_{id}_{set_code}_{YY-MM-DD}_{YY-MM-DD}`
- `migration/data/tournament_hashes.json` — SHA-256 registry preventing duplicate tournaments saved under different probe dates
- Cup year mapping for all seasons; `qualifying` flag and `qualifier_count` overrides in `SEASONS` config

**Scraper (`migrate scrape`)**

- Fixed critical date format bug: server expects `DD/MM/YYYY`, scraper was sending `MM/DD/YYYY` — all historical queries were silently returning "last 30 days" defaults
- Day-by-day querying with strict `[day, day]` window, automatic `[day, day+1]` fallback when empty
- `NbTournaments == 2` players included at `TotalMatchPoints // 2` (double-entry split); `NbT > 2` excluded and flagged
- Future dates skipped automatically
- `-s / --set-code` option now repeatable on all three CLI commands (`scrape`, `migrate`, `verify`)
- `--recreate-db` flag on `migrate` — drops and recreates all tables before importing
- `migrate` now auto-creates tables on a fresh database (no Alembic required for clean runs)
- All CLI output tee'd to `logs/scraper_<timestamp>.log`
- Scrape summary table: per-season event count, missing Mondays, consecutive gaps, multi-event weeks, low-attendance warnings

**Importer (`migrate migrate`)**

- Player name normalisation: title-case + whitespace collapse (collapses e.g. `alexander colbert` / `Alexander Colbert`)
- `event_count` set automatically from scraped file count
- `qualifier_count` read from SEASONS config; `qualifying: False` → `qualifier_count = 0`
- `_find_cup` uses explicit `cup_year` from SEASONS config instead of guessing from `starts_on.year`

**Verifier (`migrate verify`)**

- Per-season check now uses a single full-season range query (was: re-running the same broken per-Monday queries against itself)
- Duplicate player names (same person, two accounts) merged before comparison: points summed, events take `max`
- Verification summary tables: per-season and all-time player totals (points + event counts, DB vs site)
- `-s` restricts the all-time player table to players from the specified seasons only

### Fixed

- `backend/.gitignore` no longer excludes `migration/data/`
- `logs/` added to root `.gitignore`

## [0.5.0] - 2026-05-31

### Added

- `event_count: int` column on `Season` (default `12`) — number of scheduled events in a season.
- `comp_avg_n: int` Python property on `Season` model — `ceil(event_count * 0.66)`, exposed in `SeasonRead`.
- Alembic migration `0004` — adds `event_count` column and backfills from actual tournament count per season.
- `GET /seasons/{id}/standings` endpoint — returns `SeasonStandingRead[]` sorted by `comp_avg` desc, `points` desc.
  - Fields: `rank`, `player_id`, `display_name`, `tournaments_played`, `points`, `match_wins`, `match_losses`, `match_draws`, `win_pct`, `avg_pts`, `comp_avg` (avg of top `comp_avg_n` scores; `None` if none played), `comp_avg_n`, `trophies` (count of 9-point events), `per_event_scores` (list of length `event_count`, `None` for missed events).
- `StandingsService` (`services/standings.py`) — encapsulates standings computation logic.
- `StandingsServiceDep` in `deps.py`.
- `SeasonStandingRead` schema (`schemas/standings.py`).

### Changed

- `SeasonCreateRequest` / `SeasonUpdateRequest` / `SeasonPatchRequest` — all include `event_count` field.
- `SeasonRead` — includes `event_count` and `comp_avg_n`.
- `SeasonService` — `create`, `update`, `patch` propagate `event_count`.

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
