# Changelog

All notable changes to this project will be documented in this file.

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
