# mm-ladder — Backend

Python service layer for the mm-ladder mono-repo.

## Prerequisites

**Python version manager** — pick one:

| Tool | Platforms | Notes |
|------|-----------|-------|
| [mise](https://mise.jdx.dev/) | Windows, macOS, Linux | Recommended — reads `.tool-versions` natively |
| [asdf](https://asdf-vm.com/) | macOS, Linux | Add the `python` plugin |
| [pyenv-win](https://github.com/pyenv-win/pyenv-win) | Windows | Python only, set version manually |

**Package manager:** [Poetry](https://python-poetry.org/docs/#installation) (official installer or `pipx`)

## Setup

### macOS / Linux (asdf)

```bash
asdf install
poetry env use $(asdf which python)
poetry install
```

### Windows (mise)

```powershell
mise install          
poetry env use $(mise which python)
poetry install
```

## Database migrations (Alembic)

All commands must be run from the `backend/` directory.

```bash
# Apply all pending migrations (creates mm_ladder.db on first run)
poetry run alembic upgrade head

# Roll back to a specific revision (or 'base' to undo everything)
poetry run alembic downgrade base

# Show current migration state
poetry run alembic current

# Show migration history
poetry run alembic history --verbose

# Generate a new auto-detected migration after changing a model
poetry run alembic revision --autogenerate -m "describe the change"
# ⚠ Always review generated files in alembic/versions/ before applying
```

The database file (`mm_ladder.db`) is gitignored. Each developer runs `alembic upgrade head` locally. Tests use an in-memory SQLite instance via `Base.metadata.create_all` — Alembic is not involved in test setup.

## Production database (Neon Postgres)

Production runs on [Neon](https://neon.tech) (Postgres 18, region AWS ap-southeast-2 Sydney) instead
of SQLite; local development keeps using SQLite. See `docs/DEPLOYMENT.md` for the full architecture.

On the Neon project dashboard → **Connect**, use the **"Connect your app manually"** path (the
AI-guided / MCP setup is not needed for this repo). Neon shows one connection string; you need
**both variants** — toggle **Connection pooling** to get each — and they must be adapted for
SQLAlchemy before use:

1. Add an explicit driver: `postgresql://` → `postgresql+psycopg://` (sync: Alembic, seed CLI) or
   `postgresql+asyncpg://` (async: the API server).
2. Fix the TLS parameter: psycopg keeps `?sslmode=require`; asyncpg needs `?ssl=require` instead.
3. Delete any `channel_binding=require` parameter — asyncpg rejects it.

Store them in `backend/.env` (gitignored — never commit these; the password is in the URL):

```dotenv
# Direct endpoint (host WITHOUT -pooler) — Alembic migrations & one-time seed
NEON_DIRECT_URL=postgresql+psycopg://<user>:<password>@ep-xxxx.ap-southeast-2.aws.neon.tech/neondb?sslmode=require
# Pooled endpoint (host WITH -pooler) — the running API
NEON_POOLED_URL=postgresql+asyncpg://<user>:<password>@ep-xxxx-pooler.ap-southeast-2.aws.neon.tech/neondb?ssl=require
```

Nothing auto-loads this file — it's a scratchpad for the values. To run against Neon, export the
one you need as `DATABASE_URL`:

```powershell
# Apply migrations to Neon (PowerShell; use the DIRECT url, with +asyncpg — the app converts for Alembic)
$env:DATABASE_URL = "<NEON_DIRECT_URL with +asyncpg and ?ssl=require>"; poetry run alembic upgrade head

# Run the API against Neon (POOLED url)
$env:DATABASE_URL = "<NEON_POOLED_URL>"; poetry run uvicorn mm_ladder.app:app --port 8000
```

Rules of thumb: **direct** URL for anything schema- or bulk-related (Alembic, `migrate copy-to-pg`
seed); **pooled** URL for serving requests. The engine factory detects the `-pooler` host and
disables client-side pooling/statement caching automatically (PgBouncer handles it).

## Data migration (limitedspoiler.com)

Backfills historical tournament results from limitedspoiler.com into the local database.
All commands must be run from the `backend/` directory and require `poetry install` with the migration group:

```bash
poetry install  # installs migration extras (click, requests) automatically
```

The pipeline has three steps — run them in order:

### 1. Scrape

Fetches tournament data from limitedspoiler.com and saves raw JSON files under `migration/data/`.

```bash
poetry run migrate scrape               # all seasons
poetry run migrate scrape --set-code tdm  # one season only
poetry run migrate scrape --force       # re-scrape even if files already exist
```

Files are saved to `migration/data/season_{id}/YYYY-MM-DD.json` and are gitignored. This step is safe to re-run — existing files are skipped unless `--force` is passed.

### 2. Migrate

Imports scraped JSON files into the database. The default run is idempotent and
non-destructive: tournaments already imported (matched by season + date) are skipped, only
missing events are added, and existing player rows/ids are always preserved.

```bash
# Apply DB schema first if not already done
poetry run alembic upgrade head

poetry run migrate migrate               # all seasons
poetry run migrate migrate --set-code tdm --db mm_ladder.db
```

Two opt-in flags change this behaviour:

| Flag | Effect |
|------|--------|
| `--force-re-upload` | Delete and rebuild the migrated tournaments **in scope** (the `-s` set(s), or all if no `-s`) from JSON, recomputing results. Player rows/ids are preserved. Use it to apply corrected source data — pairs with `migrate scrape --force`, which re-fetches and overwrites the JSON on disk. |
| `--recreate-db` | Drop and recreate **all** tables before migrating (a full from-scratch rebuild, including players). Applied once, before the first season in the run. |

```bash
# Re-import one season's tournaments after re-scraping corrected data
poetry run migrate scrape --set-code tdm --force
poetry run migrate migrate --set-code tdm --force-re-upload

# Wipe everything and rebuild the database from scratch
poetry run migrate migrate --recreate-db
```

### 3. Verify

Cross-checks per-season player counts and points totals against limitedspoiler.com, then performs an all-time cross-check. Exits with code 1 if any mismatch is found.

```bash
poetry run migrate verify               # all seasons
poetry run migrate verify --set-code tdm
```

> **Note:** `verify` re-fetches each Monday from the site using the same windows as the scraper, so it makes roughly one HTTP request per tournament. For a full history (~200+ tournaments) this takes a few minutes.

### Player consolidation

One-off interactive tool for merging duplicate player records (e.g. the same person imported under
slightly different name spellings — accents, initials, punctuation). It records every merged-away
spelling as an alias on the surviving player, so future imports and player creation reuse the
existing record automatically instead of creating a new duplicate.

```bash
# Auto-detect candidate duplicate groups and review them one by one
poetry run migrate consolidate-players --dry-run
poetry run migrate consolidate-players

# Manually browse and pick players to merge (optionally narrowed by a name prefix)
poetry run migrate consolidate-players --select --select-filter dam --dry-run
poetry run migrate consolidate-players --select --select-filter dam
```

For each candidate group, the survivor (the player with the longest display name) is proposed; you
can exclude members, skip the whole group, or accept the proposed merge plan before it's applied.
Groups where merging would violate a database constraint (shared tournament participation or a
head-to-head match between members) are skipped automatically with an explanation. Always run with
`--dry-run` first, and against a copy of the database — merges delete player rows and repoint
`tournament_participant`/`match` references, and cannot be undone.

### Season trophy leaderboard

Read-only report that ranks players by the draft awards they hold during a season — currently the
`fa fa-trophy ss-uncommon` (draft trophies) and `fa fa-star ss-uncommon` (e.g. Cube) css classes
listed in `TROPHY_CSS` in `migration/trophies.py`. It reads the season's scraped JSON directly (no
database needed) and combines every dated snapshot: a player's award collection repeats unchanged
across snapshots, so each award is counted once (max per name, not summed across files), and players
are keyed by normalised name so spelling variants merge.

```bash
poetry run migrate trophies --set-code ecl
poetry run migrate trophies -s ecl
```

It prints a ranked table — each player's total (sum of their distinct award counts) plus a
breakdown listing one award per line — ordered by total descending, then name:

```
   #  Player           Total  Breakdown
  -------------------------------------
   1  Player A            10  Cube x5
                              Draft Trophy TDM x2
                              Draft Trophy TLA x1
                              ...
   2  Player B             8  Draft Trophy ECL x3
                              EOE Draft Trophy x2
                              ...
```

## Running the API server

All commands must be run from the `backend/` directory.

```bash
# The server applies pending migrations on startup (AUTO_MIGRATE=1 by default),
# so a fresh checkout just needs:
poetry run uvicorn mm_ladder.app:app --reload --port 8000

# To apply migrations manually instead (e.g. with AUTO_MIGRATE=0):
poetry run alembic upgrade head
```

| URL | Description |
|-----|-------------|
| `http://localhost:8000/docs` | Swagger UI — interactive endpoint explorer |
| `http://localhost:8000/redoc` | ReDoc — alternative API docs |
| `http://localhost:8000/openapi.json` | Raw OpenAPI schema |
| `http://localhost:8000/health` | Health check |

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./mm_ladder.db` | SQLAlchemy async DB URL |
| `ENV` | `development` | `development` = coloured logs; anything else = JSON logs |
| `AUTO_MIGRATE` | `1` | Apply Alembic migrations (`upgrade head`) automatically on app startup. Set to `0`/`false`/`no` to manage migrations out-of-band. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated list of allowed frontend origins |
| `ADMIN_TOKEN` | _(unset)_ | Shared secret for the admin portal. **Required** to perform any write — all `POST`/`PUT`/`PATCH`/`DELETE` endpoints check the `X-Admin-Token` header against it. Fails closed: if unset, every write is rejected with 401. GET endpoints stay public. |

### Admin API & audit log

All mutating endpoints are guarded by `ADMIN_TOKEN` (see above). `GET /admin/check` validates a
token, and `GET /admin/audit` returns the append-only audit log (every admin create/update/delete,
with a field-level diff) — filterable by `entity_type`/`action` and paginated via `limit`/`offset`.
The admin UI lives at the frontend's `/admin` route; see [`docs/ADMIN.md`](../docs/ADMIN.md) for the
operator guide.

## Running the toolchain

```bash
poetry run tox                    # lint + typecheck + test (full suite)
poetry run pytest -v              # tests only
poetry run ruff check src tests   # lint only
poetry run pyright src            # type-check only
```

## CHANGELOG

This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

- All unreleased changes go under `## [Unreleased]`.
- On release, rename `[Unreleased]` to `[M.m.p] - YYYY-MM-DD` and add a fresh `## [Unreleased]` section above it.
