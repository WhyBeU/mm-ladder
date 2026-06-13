# mm-ladder — API Reference

## Running the server

```bash
# From backend/ — the server auto-applies migrations on startup (AUTO_MIGRATE=1 by default)
poetry run uvicorn mm_ladder.app:app --reload --port 8000
```

| URL | Description |
|-----|-------------|
| `http://localhost:8000/docs` | Swagger UI |
| `http://localhost:8000/redoc` | ReDoc |
| `http://localhost:8000/openapi.json` | OpenAPI JSON |
| `http://localhost:8000/health` | Health check |

### Environment variables

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./mm_ladder.db` | Any SQLAlchemy async URL |
| `ENV` | `development` | `development` → coloured logs; else JSON |
| `ADMIN_TOKEN` | _(unset)_ | Shared secret required on all writes (see Authentication). Unset → every write 401s. |
| `AUTO_MIGRATE` | `1` | Apply Alembic migrations on startup. `0`/`false`/`no` to disable. |
| `CORS_ORIGINS` | `http://localhost:3000` | Comma-separated allowed frontend origins |

---

## Architecture

```
Request → Route → Service → AsyncSession → SQLite / Postgres
```

- **Routes** (`routes/`) — parse requests, call service, return `*Read` schema
- **Services** (`services/`) — class per resource, injected with `AsyncSession` via FastAPI `Depends`
- **Interface schemas** (`interface/`) — `*CreateRequest`, `*UpdateRequest`, `*PatchRequest` per resource
- **Response schemas** (`schemas/`) — existing `*Read` schemas reused as response models

---

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | Missing/invalid `X-Admin-Token` on a write endpoint (see Authentication) |
| 404 | Resource not found, or nested resource belongs to a different parent |
| 409 | Unique constraint violation, or a guarded conflict (deleting a player with participations; an un-mergeable merge) |
| 422 | Request body validation failure (Pydantic) |

---

## Authentication

All **mutating** endpoints (`POST`/`PUT`/`PATCH`/`DELETE`) require the shared admin secret in an
`X-Admin-Token` header matching the backend's `ADMIN_TOKEN` env var. `GET` endpoints are public so
the leaderboard works unauthenticated. If `ADMIN_TOKEN` is unset/empty the API fails closed (all
writes 401).

```bash
curl -X POST http://localhost:8000/players/ \
  -H "X-Admin-Token: $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"display_name": "Alice"}'
```

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/admin/check` | — | `{"status":"ok"}` (401 if token invalid) — validates a token |
| GET | `/admin/audit` | — (query: `entity_type?`, `action?`, `limit=50`, `offset=0`) | `{ items: AuditLogRead[], total: int }` — append-only audit log, newest first |

---

## Endpoints

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}` |

---

### Players

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/players/` | — | `PlayerRead[]` |
| POST | `/players/` | `PlayerCreateRequest` | `PlayerRead` (201) |
| POST | `/players/merge` | `{ keep_id, duplicate_ids }` | `PlayerRead` — fold duplicates into the keeper |
| GET | `/players/{id}` | — | `PlayerRead` |
| PUT | `/players/{id}` | `PlayerUpdateRequest` | `PlayerRead` |
| PATCH | `/players/{id}` | `PlayerPatchRequest` | `PlayerRead` |
| DELETE | `/players/{id}` | — | 204 |

**`PlayerCreateRequest`**
```json
{ "display_name": "Alice", "is_hidden": false }
```

> If `display_name` normalises (accent/punctuation/case-insensitive token match) to an existing player's `display_name` or a known alias, the existing player is returned and the new spelling is recorded as an alias instead of creating a duplicate row.

**`PlayerPatchRequest`** — all fields optional (`display_name`, `is_hidden`, `aliases`); omit to leave unchanged
```json
{ "is_hidden": true, "aliases": ["Alyce", "a.smith"] }
```

> `PlayerRead` exposes `aliases` (editable) and the read-only `is_veteran` (computed; `true` once a player has played more than 52 events all-time).

**`/players/merge`** — reassigns every duplicate's participations and match references to `keep_id`, folds the duplicates' names/aliases into the keeper's aliases, repoints any champion/POTY/cup-winner/qualification records, and deletes the duplicates. 409 if `keep_id` is also a duplicate, or if the players share a tournament or faced each other (an impossible merged record).
```json
{ "keep_id": 7, "duplicate_ids": [12, 31] }
```

---

### Yearly Cups

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/yearly-cups/` | — | `YearlyCupRead[]` |
| POST | `/yearly-cups/` | `YearlyCupCreateRequest` | `YearlyCupRead` (201) |
| GET | `/yearly-cups/{id}` | — | `YearlyCupRead` |
| PUT | `/yearly-cups/{id}` | `YearlyCupUpdateRequest` | `YearlyCupRead` |
| PATCH | `/yearly-cups/{id}` | `YearlyCupPatchRequest` | `YearlyCupRead` |
| DELETE | `/yearly-cups/{id}` | — | 204 |

**`YearlyCupCreateRequest`**
```json
{ "year": 2024, "name": "2024 Magic Mates Cup", "starts_on": "2024-01-01", "ends_on": "2024-12-31" }
```

---

### Seasons

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/seasons/` | — | `SeasonRead[]` |
| POST | `/seasons/` | `SeasonCreateRequest` | `SeasonRead` (201) |
| GET | `/seasons/{id}` | — | `SeasonRead` |
| PUT | `/seasons/{id}` | `SeasonUpdateRequest` | `SeasonRead` |
| PATCH | `/seasons/{id}` | `SeasonPatchRequest` | `SeasonRead` |
| DELETE | `/seasons/{id}` | — | 204 |
| GET | `/seasons/{id}/standings` | — | `SeasonStandingRead[]` |

**`SeasonCreateRequest`**
```json
{
  "name": "Lorwyn Eclipsed", "set_code": "LCI",
  "starts_on": "2024-01-01", "ends_on": "2024-06-30",
  "yearly_cup_id": 1, "qualifier_count": 2, "event_count": 12,
  "qualifying_type": "POINTS"
}
```

> `yearly_cup_id` is optional (null = standalone season). `qualifier_count` defaults to 2. `event_count` defaults to 12 (number of scheduled events in the season). `qualifying_type` is `"POINTS"` or `"BEST"` and defaults to `"POINTS"`.
> PUT requires `qualifier_count` and `event_count` explicitly (no defaults).
> `SeasonPatchRequest` also accepts `yearly_cup_id`, `qualifying_type`, and `champion_player_id` (set-only — passing null/omitting leaves the field unchanged; use PUT to clear).

**`SeasonRead`** includes `event_count: int`, `comp_avg_n: int` (= `ceil(event_count × 0.66)`), and `qualifying_type: str`.

**`SeasonStandingRead`** — response of `GET /seasons/{id}/standings`, sorted by `qualifying_type`: `"BEST"` ranks by `comp_avg` desc, `"POINTS"` ranks by `points` desc; both tiebreak on `trophies` desc then `win_pct` desc:

```json
{
  "rank": 1,
  "player_id": 7,
  "display_name": "Alice",
  "tournaments_played": 10,
  "points": 87,
  "match_wins": 29,
  "match_losses": 1,
  "match_draws": 0,
  "win_pct": 0.967,
  "avg_pts": 8.7,
  "comp_avg": 8.875,
  "comp_avg_n": 8,
  "trophies": 3,
  "per_event_scores": [9, 6, null, 9, 8, null, 9, 7, 6, null, null, 9],
  "is_veteran": false,
  "season_championships": [{ "set_code": "BLB", "season_name": "Bloomburrow" }],
  "player_of_the_year_years": [2025],
  "cup_champion_years": [2025]
}
```

> `comp_avg` is the mean of the player's top `comp_avg_n` scores (= `ceil(event_count × 0.66)`). `null` if the player has played zero events.
> `per_event_scores` has length `event_count`; entries are `null` for events the player missed.
> `trophies` is the count of events where the player scored 9 points.
> `is_veteran` mirrors `PlayerRead.is_veteran` (true once a player has played more than 52 events all-time).
> `season_championships` / `player_of_the_year_years` / `cup_champion_years` carry the player's awards (lifetime), driving the leaderboard award icons.

---

### Tournaments

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/tournaments/` | — | `TournamentRead[]` |
| POST | `/tournaments/` | `TournamentCreateRequest` | `TournamentRead` (201) |
| GET | `/tournaments/{id}` | — | `TournamentRead` |
| PUT | `/tournaments/{id}` | `TournamentUpdateRequest` | `TournamentRead` |
| PATCH | `/tournaments/{id}` | `TournamentPatchRequest` | `TournamentRead` |
| DELETE | `/tournaments/{id}` | — | 204 |

**`TournamentCreateRequest`**
```json
{ "held_on": "2024-03-04", "season_id": 1, "name": "MMM #143", "notes": null }
```

> `has_match_detail` is read-only — managed automatically when matches are created/deleted.

---

### Tournament Participants

Nested under `/tournaments/{tournament_id}/participants`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/tournaments/{tid}/participants/` | — | `TournamentParticipantRead[]` |
| POST | `/tournaments/{tid}/participants/` | `TournamentParticipantCreateRequest` | `TournamentParticipantRead` (201) |
| GET | `/tournaments/{tid}/participants/{id}` | — | `TournamentParticipantRead` |
| PUT | `/tournaments/{tid}/participants/{id}` | `TournamentParticipantUpdateRequest` | `TournamentParticipantRead` |
| PATCH | `/tournaments/{tid}/participants/{id}` | `TournamentParticipantPatchRequest` | `TournamentParticipantRead` |
| DELETE | `/tournaments/{tid}/participants/{id}` | — | 204 |

**`TournamentParticipantCreateRequest`**
```json
{ "player_id": 1, "match_wins": 3, "match_losses": 1, "match_draws": 0 }
```

> `points` is DB-computed (`match_wins × 3 + match_draws`) and read-only.
> `tournament_id` comes from the URL path, not the request body.
> Unique constraint: one participant row per `(tournament_id, player_id)` pair.
> `TournamentParticipantPatchRequest` accepts `player_id` (in addition to W/L/D) to reassign a result to a different player.

---

### Matches

Nested under `/tournaments/{tournament_id}/matches`.

| Method | Path | Body | Response |
|--------|------|------|----------|
| GET | `/tournaments/{tid}/matches/` | — | `MatchRead[]` |
| POST | `/tournaments/{tid}/matches/` | `MatchCreateRequest` | `MatchRead` (201) |
| GET | `/tournaments/{tid}/matches/{id}` | — | `MatchRead` |
| PUT | `/tournaments/{tid}/matches/{id}` | `MatchUpdateRequest` | `MatchRead` |
| PATCH | `/tournaments/{tid}/matches/{id}` | `MatchPatchRequest` | `MatchRead` |
| DELETE | `/tournaments/{tid}/matches/{id}` | — | 204 |

**`MatchCreateRequest`**
```json
{ "player_a_id": 1, "player_b_id": 2, "games_a": 2, "games_b": 1, "game_draws": 0 }
```

> `outcome` is a Pydantic computed field in `MatchRead`: `A_WINS` / `B_WINS` / `DRAW`.
> `tournament_id` comes from the URL path, not the request body.
> Creating the first match for a tournament automatically sets `has_match_detail = true`.
> Deleting the last match automatically sets `has_match_detail = false`.
