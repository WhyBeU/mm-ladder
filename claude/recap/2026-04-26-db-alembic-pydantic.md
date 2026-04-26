# Session Recap — DB Layer: Alembic + Pydantic (2026-04-26)

**Branch:** `feat/db-alembic-pydantic`

## What was built

Full database layer for mm-ladder: SQLAlchemy 2.0 models, Alembic migrations (schema + seed data), and Pydantic v2 read/create schemas — all aligned to `docs/SCHEMA.md`.

---

## Commits (in order)

1. `chore: add pydantic 2 dependency`
2. `feat: add DeclarativeBase, TimestampMixin, and test fixtures`
3. `feat: add Player model with tests`
4. `feat: add YearlyCup model with tests`
5. `feat: add Season model with tests`
6. `feat: add Tournament model with tests`
7. `feat: add TournamentParticipant model with tests`
8. `feat: add Match model with tests (dual FK, CHECK constraint)`
9. `feat: add engine and session factory`
10. `chore: configure alembic with Base metadata`
11. `feat: add initial schema migration`
12. `feat: seed MTG seasons DMU through FDN`
13. `feat: add Pydantic v2 schemas and clean up model layer`

---

## Key design decisions

### Schema authority
`docs/SCHEMA.md` is the canonical source (not the older `phase-1-read-only-fancy-tiger.md`). Notable differences: no `email`/`full_name` on Player (PII deferred), no `yearly_cup_id` on Tournament (affiliation is transitive via Season), no `seat_number` on TournamentParticipant.

### `points` as a DB-persisted Computed column
`TournamentParticipant.points` uses `Computed("match_wins * 3 + match_draws", persisted=True)` — the DB owns the calculation. The Pydantic `TournamentParticipantRead` schema exposes it as a plain `int` field (not `@computed_field`).

### `MatchRead.outcome` as a Python computed field
`outcome` (`A_WINS` / `B_WINS` / `DRAW`) is not stored — it's derived in `MatchRead` via `@computed_field` comparing `games_a` vs `games_b`.

### `yearly_cup_id` is nullable
A `Season` can exist without belonging to a `YearlyCup` (standalone season). `yearly_cup_id` is `nullable=True`.

### `Match` has no `updated_at`
`Match` is insert-only — it doesn't inherit `TimestampMixin`. Only `created_at` is present.

### Circular import handling
- `TYPE_CHECKING` guards prevent runtime circular imports while keeping type annotations correct.
- `Match.player_a` / `player_b` use `foreign_keys=[player_a_id]` (column object, same file).
- `Player.matches_as_a` / `matches_as_b` use `foreign_keys="[Match.player_a_id]"` (string, cross-file).

### `models/__init__.py` exports classes directly
Originally used side-effect module imports (`from mm_ladder.models import player  # noqa: F401`). Changed to direct class imports (`from mm_ladder.models.player import Player`) so pyright doesn't flag them as unused and so the public API is explicit.

### `utc_now` naming
The timestamp default helper was initially named `_now` (private by convention). Renamed to `utc_now` so `match.py` can import it across module boundaries without a pyright `reportPrivateUsage` error.

### `render_as_batch=True` in Alembic env.py
Required for SQLite: future `ALTER TABLE`-based migrations (column renames, constraint changes) won't hit SQLite's limited DDL support.

### CHECK constraint placement
SQLite doesn't support `ALTER TABLE ADD CONSTRAINT`. The `ck_match_different_players` check must live inside `op.create_table()` in the migration — not as a separate `op.create_check_constraint()` call.

---

## File map

```
backend/
├── alembic.ini
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       ├── 0001_initial.py        — all 6 tables
│       └── 0002_seed_seasons.py   — 12 MTG sets, DMU → FDN
├── src/mm_ladder/
│   ├── db.py                      — make_engine / make_session_factory
│   ├── models/
│   │   ├── __init__.py            — re-exports all 6 model classes + Base
│   │   ├── base.py                — Base, TimestampMixin, utc_now
│   │   ├── player.py
│   │   ├── yearly_cup.py
│   │   ├── season.py
│   │   ├── tournament.py
│   │   ├── tournament_participant.py
│   │   └── match.py
│   └── schemas/
│       ├── __init__.py            — re-exports all Create/Read pairs
│       ├── base.py                — BaseReadSchema (from_attributes=True)
│       ├── player.py
│       ├── yearly_cup.py
│       ├── season.py
│       ├── tournament.py
│       ├── tournament_participant.py
│       └── match.py
└── tests/
    ├── conftest.py                — in-memory SQLite engine + session fixtures
    ├── models/
    │   ├── test_player.py
    │   ├── test_yearly_cup.py
    │   ├── test_season.py
    │   ├── test_tournament.py
    │   ├── test_tournament_participant.py
    │   └── test_match.py
    └── test_schemas.py
```

---

## Final state

| Check | Result |
|-------|--------|
| `poetry run pytest -v` | 43 passed |
| `poetry run pyright src/` | 0 errors |
| `poetry run ruff check src/ tests/` | 0 issues |
| `alembic upgrade head` | 12 seasons seeded |
