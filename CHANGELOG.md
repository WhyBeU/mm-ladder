# Changelog

## [0.6.0] - 2026-06-04

### Added — Migration pipeline overhaul

**Data**
- Full historical dataset: 506 tournament files across all 45 seasons (soi 2016 → sos 2026)
- Season data directories renamed to `season_{id}_{set_code}_{start}_{end}` convention
- `migration/data/tournament_hashes.json` — central SHA-256 registry preventing duplicate tournaments across probe dates
- Cup year mapping for all seasons; `qualifying` flag and `qualifier_count` overrides in `SEASONS` config

**Scraper**
- Fixed critical date format bug: was sending `MM/DD/YYYY` (US), server expects `DD/MM/YYYY` — all historical queries were silently returning "last 30 days" defaults
- Day-by-day scraping with strict `[day, day]` window, automatic `[day, day+1]` fallback when no data found
- `NbTournaments == 2` players now included with `TotalMatchPoints // 2` (double-entry split); `NbT > 2` still excluded and flagged
- Future dates skipped automatically
- `-s / --set-code` option is now repeatable on all three CLI commands (`scrape`, `migrate`, `verify`)
- `--recreate-db` flag on `migrate` drops and recreates all tables; `migrate` also auto-creates tables on a fresh DB

**Logging & reporting**
- All CLI output tee'd to `logs/scraper_<timestamp>.log`
- Scrape summary table: per-season event count, missing Mondays, consecutive gaps, multi-event weeks, low-attendance events
- Verification summary tables: per-season and all-time player totals (points + event counts), site vs DB comparison
- Duplicate detection logged at info level with the existing file path

**Importer**
- Player name normalisation: title-case + whitespace collapse (collapses `alexander colbert` / `Alexander Colbert` etc.)
- `event_count` set automatically from scraped file count; `qualifier_count` read from SEASONS config
- `ensure_season` updates `qualifier_count` on re-import; `qualifying: False` → `qualifier_count = 0`
- `_find_cup` uses explicit `cup_year` from SEASONS config instead of guessing from `starts_on.year`

**Verifier**
- Per-season verification uses a single full-season range query (was: re-running per-Monday queries against itself)
- All-time verification uses `DD/MM/YYYY` date format (was: broken)
- Duplicate player names (same person, two accounts) merged before comparison: points summed, events take `max`
- `-s` restricts the all-time player table to players from the specified seasons only

### Fixed
- Season folders `season_33` and `season_39` renamed to include set code and dates
- `backend/.gitignore` no longer excludes `migration/data/`

## [0.5.0] - 2025-05-01

### Added
- Leaderboard UX improvements: scope bar, trophies, comp avg, mana fix

## [0.4.0] - 2024-11-01

### Added
- Frontend: wire real API data with TanStack Query

## [0.3.0] - 2024-10-01

### Added
- Migration pipeline: limitedspoiler.com data scraper and importer

## [0.2.0] - 2024-09-01

### Added
- Frontend design system implementation

## [0.1.0] - 2024-08-01

### Added
- Initial frontend setup
