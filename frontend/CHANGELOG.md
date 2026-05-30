# Changelog

## [Unreleased]

## [0.3.0] — 2026-05-30 — Frontend: Live API Data

### Added

- **TanStack Query** (`@tanstack/react-query` + devtools) — data fetching, caching, and cache-inspection devtools (floating button, bottom-right).
- **`api.ts`** — typed fetch functions for all backend endpoints: `fetchYearlyCups`, `fetchSeasons`, `fetchTournaments`, `fetchPlayers`, `fetchTournamentParticipants`.
- **`QueryProvider`** (`src/providers/QueryProvider.tsx`) — wraps the app with `QueryClientProvider`; 1-minute stale time, no window-focus refetch.

### Changed

- **`LeaderboardPage`** — all mock data replaced with live API calls. Navigation data (cups, seasons, tournaments) fetched on mount. Participants fetched in parallel for every tournament in the current scope; standings aggregated client-side from real data. Current season auto-detected from `starts_on`/`ends_on` date ranges (reactive derivation, no `useEffect` setState).
- **`ManaThemeContext`** — fixed SSR hydration mismatch: initialise with default theme, read `localStorage` after mount.
- **`Season.yearly_cup_id`** type widened to `number | null` to match the backend schema.
- **`layout.tsx`** — wrapped with `QueryProvider`.
- **README** — added curl smoke-test commands, DevTools verification steps, correct uvicorn command (`mm_ladder.app:app`).

## [0.2.0] — 2026-05-03 — Frontend: Design System Implementation

### Added (frontend)

- **Hierarchical scope navigation** in the sidebar: All-time → Yearly Cup → Season → Event (one per Monday) → Pod. Each level scopes the leaderboard independently.
- **Keyrune MTG set symbols** — CDN stylesheet loaded globally; each season shows its set symbol icon (BLB, DSK, STX, EOE, LCI).
- **Magic Mates logo** in the sidebar brand block.
- **SeasonHero** component: title card with set-symbol watermark, Live badge, and cup progress bar for qualifying seasons; adjacent leader card showing name, points, and a per-event sparkline.
- **StatsStrip**: four summary stat blocks (events held, active players, matches played, avg attendance).
- **Podium** component: top-3 cards in gold/silver/bronze sheen, with W–L–D records and win rates.
- **Scope breadcrumb** in the sticky header — clickable chain showing current drill-down path.
- **Inter** Google Font replacing Open Sans as the primary body font.
- **`eyebrow`, `pulse-soft`, `set-placard`** CSS utility classes added to `globals.css`.
- **`bits.tsx`**: shared utility components — `PlayerAvatar` (gold/silver/bronze medal treatment), `RankDelta` (▲▼), `StreakChips` (W/L/D chips), `Sparkline` (SVG line chart), `PointsByEventChart`.
- **`types.ts`**: full TypeScript type definitions — `Scope`, `YearlyCup`, `Season`, `MMLEvent`, `Pod`, `StandingEntry`, `SeasonStats`.
- **`mockData.ts`**: typed mock dataset — 30 players, 5 seasons across 2 yearly cups, 6 events with full standings, cup and all-time aggregates.

### Changed (frontend)

- **Leaderboard** (`Leaderboard.tsx`) fully rewritten: rank-delta column, streak chips, per-event sparkline, avg pts column, expandable rows (points-by-event bar chart, attendance grid, round breakdown), cup-qualifier dashed divider, comfy/compact density support.
- **NavSidebar** (`NavSidebar.tsx`) fully rewritten: hierarchical scope tree replaces flat season dropdown + tournament list.
- **LeaderboardPage** (`LeaderboardPage.tsx`) rewritten around a `scope: Scope` state; wires all new components; mobile drawer preserved.
- `layout.tsx`: Inter font added, Keyrune CDN `<link>` injected.
- `frontend/package.json`: bumped to `0.2.0`.


## [0.1.0] - 2026-05-03

### Added

- Next.js 16 App Router scaffold (TypeScript, Tailwind v4, ESLint, React Compiler)
- Mana theme system: 5 CSS variable palettes (W/U/B/R/G) swapped via `[data-mana]` on `<html>`, persisted in `localStorage` under `mm-ladder:mana-theme`
- `ManaThemeContext` — React Context providing `theme` / `setTheme`, SSR-safe hydration (default `U` on server, corrected on client mount)
- `ManaSwitcher` — 5-button mana symbol radio group wired to `ManaThemeContext`
- `NavSidebar` — season selector + tournament list with loading skeleton and mobile close button
- `Leaderboard` — sortable ranked table with gold/silver/bronze medal treatment, search, and collapsed mobile layout
- `LeaderboardPage` — top-level page composing all components; `useLeaderboardData` stub returns empty arrays pending TanStack Query wiring (Step 5)
- Tailwind v4 design tokens in `src/app/globals.css` via `@theme`: ink/primary (runtime-themed via CSS vars), accent/silver/bronze/win/loss/draw (static), sheen gradients via `@utility`, custom shadows and border radius
- `src/styles/themes.css` — CSS variable palettes for all 5 mana themes + body background gradient and grain overlay
- Google Fonts: Cinzel (display) and Open Sans (body) via `next/font/google`
