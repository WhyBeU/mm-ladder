# Player Consolidation — Design

Date: 2026-06-08

## Problem

The historical migration created 579 `Player` rows from scraped tournament data. Some of these
are duplicates of the same real person under different name spellings — punctuation differences
(`Alex Norton - Smith` / `Alex Norton-Smith`), accent differences, and partial/abbreviated names
(`Damian Cengarle Barilari` / `Damián Cengarle` / `Damian C`). These need to be merged into a
single canonical `Player` record, with the variant spellings preserved as `aliases` so that future
imports recognize them and don't recreate the duplicate.

## Goals

- A one-off CLI command (`migrate consolidate-players`) that finds likely-duplicate player groups,
  lets the operator review/adjust each group interactively, and merges them.
- Add an `aliases: list[str]` field to `Player` to record known alternate spellings for the
  canonical player.
- Prevent the same problem going forward: player creation (both via the API and the migration
  importer) checks existing aliases before creating a new row.
- Support `--dry-run` (show the plan, change nothing) and `--select` (manually pick players to
  merge instead of relying on auto-detection).

## Architecture

- **New module** `migration/consolidation.py`: normalization, fuzzy candidate detection, conflict
  checking, merge planning and execution. Mirrors the structure of `migration/importer.py`
  (`run_import`, `seed_cups`).
- **New CLI command** `consolidate-players` registered on the existing `cli` group in
  `migration/cli.py`, using the existing `_make_session` helper.
- **New Alembic migration** (next revision after `0006`) adding `aliases` (JSON, nullable,
  default `[]`) to the `player` table, via `batch_alter_table` — same pattern as
  `alembic/versions/0003_add_tournament_is_migrated.py`.
- **Shared alias-aware lookup helper**, e.g. `find_player_by_name_or_alias(session, display_name)`,
  used by both `mm_ladder.services.player.PlayerService.create` and
  `migration.importer.ensure_player`, replacing their current exact-`display_name`-only lookups.

## Normalization

A single normalization function used everywhere names are compared:

1. Unicode NFKD-decompose and strip combining marks (accent fold: `Damián` → `Damian`).
2. Lowercase.
3. Strip whitespace and punctuation (collapse `Alex Norton - Smith` and `Alex Norton-Smith` to the
   same token stream).

This produces both a single comparison string (for strict exact matching) and a token list (for
fuzzy grouping).

## Detection (fuzzy candidate groups)

Single-tier detection — every candidate is surfaced for human review, including likely
false-positives (the operator deselects what doesn't belong):

1. Group all players by their normalized **first-name token**.
2. Within each first-name group, pair up players whose remaining (surname) tokens overlap, OR
   where one player's remaining tokens are a prefix/subset of the other's. This catches:
   - `Alex Norton - Smith` / `Alex Norton-Smith` (punctuation-only — identical tokens)
   - `Damian Cengarle Barilari` / `Damián Cengarle` / `Damian C` (accent fold + partial names —
     overlapping/prefix surname tokens)
   - It will also surface likely-unrelated pairs like `Solomon Smith` / `Solomon Nivison-Smith`
     (shared surname token only) — left to the operator to reject.
3. Merge overlapping pairs into connected groups (so a 3-way match like the Damian trio forms one
   group, not three separate pairs).

## Survivor selection

Within a confirmed group, the player with the **longest `display_name`** (by character count,
since longer names are generally more complete/unique — e.g. `Damian Cengarle Barilari` over
`Damián Cengarle` over `Damian C`) is kept as the canonical record. Ties are broken by earliest
`created_at`. The other members' `display_name`s are appended to the survivor's `aliases` list
(deduplicated, original ordering preserved).

## Conflict pre-check

Before presenting a group for confirmation, check whether merging it would violate DB constraints:

- **Same-tournament participation**: two members of the group both have a
  `TournamentParticipant` row for the same `tournament_id` → would violate
  `uq_tp_tournament_player`.
- **Head-to-head match**: two members of the group faced each other in a `Match`
  (`player_a_id`/`player_b_id`) → would violate `ck_match_different_players`.

If either is found, the **entire group is skipped** with a printed explanation naming the
conflicting members and the specific tournament/match — no partial merge is attempted. (The
operator can still merge the non-conflicting subset later via `--select`.)

## Interactive flow — auto-detected groups (default)

For each candidate group that passes the conflict check:

```
Group 3:
  [1] Damian Cengarle Barilari   (12 events, created 2026-06-04)  <- proposed survivor
  [2] Damián Cengarle             (3 events, created 2026-06-04)
  [3] Damian C                    (1 event,  created 2026-06-04)

Exclude any from this merge? (comma-separated numbers, blank = merge all, 's' = skip group):
```

1. Operator excludes members or skips the group.
2. If 2+ members remain, print the resulting plan: survivor, the `aliases` it will gain, and the
   exact rows to be repointed (`tournament_participant.player_id` and
   `match.player_a_id`/`player_b_id`, with counts and tournament/date detail for each).
3. Final y/n confirmation before executing. In `--dry-run`, the plan is printed and the loop moves
   to the next group without writing anything.

## `--select` mode (manual merge)

`migrate consolidate-players --select [--select-filter STR]`:

- Skips auto-detection. Prints the full player roster (id, display_name, event count), narrowed to
  players whose normalized `display_name` starts with the normalized `--select-filter` string when
  given (e.g. `--select-filter "dam"` matches `Damian ...`, `Damián ...`, case/accent-insensitive).
- Operator enters 2+ numbers to build a manual group.
- Same conflict-check → plan-preview → confirm → execute flow as the auto-detected path, with the
  same survivor-selection rule (longest name).
- Loops so multiple manual groups can be built in one run (blank/`q` to stop). `--dry-run` applies
  the same way.

## Merge execution

For a confirmed group with survivor `S` and merged-away members `M1..Mn`:

1. `S.aliases = dedupe(S.aliases + [m.display_name for m in M1..Mn])`
2. `UPDATE tournament_participant SET player_id = S.id WHERE player_id IN (M1.id..Mn.id)`
3. `UPDATE match SET player_a_id = S.id WHERE player_a_id IN (...)` and same for `player_b_id`
4. Delete `M1..Mn` player rows
5. Commit (or roll back and just print, in `--dry-run`)

## Player-creation alias check

`find_player_by_name_or_alias(session, display_name)`:

- Normalizes the incoming name (same normalization as above) and looks for a player whose
  normalized `display_name` **or** any normalized entry in `aliases` matches exactly — strict
  match only, no fuzzy matching (fuzzy matching at creation time risks silently merging distinct
  people, e.g. `Solomon Smith` vs `Solomon Nivison-Smith`).
- If a match is found: return that player. If the incoming spelling isn't already present in its
  `aliases` (normalized comparison), append the new spelling to `aliases`.
- If no match: return `None` (caller creates a new player as today).

This replaces the exact-`display_name`-only lookups in `PlayerService.create` and
`migration.importer.ensure_player`.

## Data model

```python
aliases: Mapped[list[str] | None] = mapped_column(JSON, nullable=True, default=list)
```

Alembic migration adds the column with `server_default=sa.text("'[]'")` so existing rows get an
empty list, matching the `0003` batch-alter-table pattern.

## Testing

- Unit tests for the normalization function (accents, punctuation, casing) and the fuzzy grouping
  (the three known real-world groups: Norton-Smith, Damian/Damián/Damian C, plus a
  should-not-group case like Solomon Smith/Nivison-Smith).
- Unit tests for conflict detection (same-tournament participation, head-to-head match).
- Unit tests for `find_player_by_name_or_alias` (exact match, alias match, no match, alias
  auto-append).
- Integration-style test for the merge execution (aliases set, references repointed, rows deleted)
  using the existing migration test patterns in `tests/migration/`.
- The interactive CLI loop itself is exercised via `click.testing.CliRunner` with scripted input,
  similar to how other commands in `migration/cli.py` would be tested (or manually, given it's a
  one-off operational tool — final call left to implementation).
