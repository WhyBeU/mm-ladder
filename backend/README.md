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

## Running the API server

All commands must be run from the `backend/` directory.

```bash
# 1. Apply migrations (creates mm_ladder.db on first run)
poetry run alembic upgrade head

# 2. Start the development server (hot reload)
poetry run uvicorn mm_ladder.app:app --reload --port 8000
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
