# Changelog

## [Unreleased]

## [0.8.0] — 2026-06-19 — Pod-registration board

### Added

- **Pod-registration board (`/board`)** — a shared, always-on, public sign-up board the store can post to
  Discord each week. Players claim themselves from the roster (active live-season players first, then the
  rest, with live search) or add themselves as a free-text **extra**; the organiser marks who's **present**
  (per-player or **Mark all present**); anyone can then **Generate** pods (same client-side `lib/pods.ts`
  seeding as the pod-maker — Random / Average / Best / Total, extras seeded last) and set the **Wizards pod
  code** on each pod card (with **Copy**). The board polls every ~4s so sign-ups and pods appear live across
  devices, shows a collapsible **activity feed**, warns when sign-ups changed since the last generate, and
  has a confirm-guarded **Clear board**. Nothing here touches the official tournament / standings data.
- **Up to two formats** — add a **second format** beside the active season: either pick one of the existing
  seasons (seeded from its standings) or choose **"Other…"** and type a name (seeded Random). Once a second
  format exists the signed-up list **splits into per-format sections** (each with its own present count,
  **Mark all present**, and pod-size preview), every sign-up gets **▲/▼ arrows** to move between formats,
  and **Generate** runs the pod algorithm **within each format** — pods are labelled **"{format} pod N"**
  and grouped by format. Removing the second format folds its players back into the first. With one format
  the board is unchanged.
- **Header navigation** — a new **Board** link sits beside **Pod** (the existing `/pods` quick tool is
  unchanged and still linked).

### Changed

- **Refactor for reuse** — `fmtMetric` moved into `lib/pods.ts` (with Vitest coverage) and the seeding
  selector extracted to a shared `SeedingSelector` component, both now used by `/pods` and `/board`.

### Developer

- New pure helper `lib/boardGenerate.ts` (`buildGenerateGroups`) with Vitest coverage for the per-format
  seeding / payload logic.

## [0.7.0] — 2026-06-14 — Pod-maker

### Added

- **Pod-maker (`/pods`)** — an organiser tool that splits a chosen set of players into draft pods
  of 6–11 (8 ideal, even sizes favoured). Pick players from the roster (active live-season players
  first, then the rest, both alphabetical, with live search), add ad-hoc **Extras** as editable
  rows, choose a **seeding method** (Random / Average / Best / Total), and **Generate** to slice the
  seeded list into pods. Strongest players seed into pod 1; Extras always land in the last pod.
  Results render inline as per-pod cards with **Copy** / **Copy all** plain-text export. Purely
  client-side — nothing is persisted. A live pod-size preview (e.g. `19 → 6 · 6 · 7`) updates as you
  select.
- **Pod-split algorithm** (`lib/pods.ts`) — ported from the LimitedSpoiler `calculatePodStructure`
  (balanced fill-of-8 with steal-2 rebalancing), with a Vitest suite covering the known sizing table
  and the seeding/sort rules.
- **Header navigation** — a shared `HeaderNav` cluster (Ladder / Pod / Admin links beside the mana
  switch) now appears on the leaderboard and the pod-maker headers.

### Developer

- Added **Vitest** and a `test` script (`npm test`) for fast pure-logic unit tests.

## [0.6.0] — 2026-06-14 — Admin portal, champion awards & cup view

### Added

- **Admin portal (`/admin`)** — password-gated dashboard (Cups / Seasons / Tournaments / Players)
  to create, edit, and delete every scope; edit participant W/L/D (points stays DB-computed);
  assign season champion / Player of the Year / cup winner and cup qualification; edit player names
  and aliases; reassign or **merge** duplicate players; and delete duplicate tournaments. Typed-word
  confirmation on every destructive action, Save/Reset dirty-form editors, and a searchable
  `PlayerPicker`. Authenticates with a shared `ADMIN_TOKEN` sent as the `X-Admin-Token` header.
- **Champion award icons** — `AwardsCluster` renders each player's awards beside their name: a
  mythic (amber/red) set symbol for a season championship, a foil trophy for Player of the Year, and
  the foil MM logo for a cup win — with count badges, hover tooltips, and wrapping.
  Award data is derived client-side from cups + seasons (`lib/awards.ts`), so badges appear on the
  season, cup, and all-time scopes.
- **Qualified-for-cup checkmark** — on the season scope, a gold checkmark appears after the name
  (before any awards) for players in that season's cup's qualified list, with a tooltip
  "Qualified for MM Cup &lt;year&gt;".
- **Cup view qualified-player cards** — on the cup scope the podium is replaced by `QualifiedCards`
  (the players an admin marked qualified, each with their awards); hidden entirely when no
  qualifiers are set. The hero leader card becomes the cup's **Player of the Year**.
- **Admin History tab** — an append-only audit log of every admin change, with entity/action
  filters, expandable `field | old | new` diffs, and pagination.

### Changed

- **Header logo** now uses the transparent `mm-logo-svg.svg` silhouette (crisp on the parchment
  chip); the cup **and all-time** heroes show a faint MM-logo watermark behind the title.
- **Award icons** — Player of the Year is now a foil **trophy** (was a star); the cup-winner foil
  **MM logo** renders reliably (the logo SVG gained explicit dimensions for CSS masking).
- **Admin child lists** — "Seasons in this cup" and "Tournaments in this season" are now clickable
  and jump to that child's editor (in-app navigation via a small admin nav context).
- **Admin season selector** lists each season as `SET — Name` over its `start – end` date range.

## [0.5.1] — 2026-06-08

### Fixed

- **All-time and cup attendance grid** — `AttendanceGrid` now filters to only the events a player attended when shown at all-time or cup scope (`onlyAttended`), instead of showing the last 18 chronological events including ones the player missed.

## [0.5.0] — 2026-06-07 — Qualifying Types, Veteran Badges & Polish

### Added

- **Veteran laurel wreath** — `VeteranLaurel` in `bits.tsx` renders a Byzantine purple/gold leaf ring around `PlayerAvatar` when `is_veteran` is true (>52 all-time events played). Wired through `Leaderboard`, `Podium`, and `SeasonHero`.
- **`qualifying_type`** (`"POINTS" | "BEST"`) on `Season` — drives the season's default sort and qualification ranking. Displayed in the cup-qualification line and as a "Best = total of your top N event scores" note in `SeasonHero` whenever the Best column is shown.
- **Sparkline value labels** — `Sparkline` now accepts `showLabels`; `ExpandedDetail` shows per-event point labels above the line when a player has fewer than 15 events.
- **Local Keyrune assets** — MTG set-symbol font/CSS copied to `public/fonts` / `public/css` (replacing the CDN link in `layout.tsx`); README documents how to update them.

### Changed

- **Cup standings** now always sort by trophies (tiebreak: points, then win rate); **season standings** sort by `qualifying_type` (`POINTS` → points, `BEST` → comp-avg total), both tiebreaking on trophies then win rate. All-time standings remain points-only.
- **"Best" / Comp Avg column** now displays the *total* of a player's top-N event scores (`comp_avg * comp_avg_n`, rounded) instead of the average, across the table, podium, and leader card.
- **Podium** bottom strip shows Best-or-Points / Win % / Trophies.
- **Cup qualifier separator** repositioned to sit below the player row (and its expanded detail) instead of above it.
- **`SeasonHero`** — replaced the cup-progress bar with a single qualification summary line; uppercased the set code in the subtitle; muted the keyrune watermark (8% → 5% opacity); added clickable cup-season set-icon chips for navigating between a cup's seasons.
- Reverted the per-event sub-label back to the simple `"N events"` form.
- Increased leaderboard table header padding for breathing room; header cells no longer wrap.

## [0.4.0] — 2026-05-31 — Frontend: Leaderboard UX Improvements

### Added

- **`ScopeBar`** (`ScopeBar.tsx`) — horizontal cascading chip dropdown scope selector replacing the left sidebar. Layout: `All-time › [Cup ▾ ×] › [Season ▾ ×] › [MMM #N ▾ ×]`. Chips open a dropdown (outside-click or Escape to close), `×` dismisses back to parent scope. Full-width, horizontal scroll on overflow.
- **Trophies column** — visible at all-time, cup, and season scope. Shows count of tournaments where a player scored 9 points; zero displayed as `—`. For season scope, backend-computed; for other scopes, client-side from fetched participants.
- **Comp Avg column** — visible at season scope only. Shows average of a player's top `comp_avg_n` scores to 1 decimal place (`—` if none). Column header tooltip shows the formula. Sortable.
- **`fetchSeasonStandings(seasonId)`** — new API function calling `GET /seasons/{id}/standings`.
- **`ApiSeasonStanding`** interface in `api.ts` mirroring the backend response.
- **`comp_avg_n` subtitle** in `SeasonHero` — shows *"Comp Avg = avg of your best N events"* at season scope.

### Changed

- **`LeaderboardPage`** — `NavSidebar` and mobile drawer/top bar removed. `ScopeBar` added below the sticky header. Season scope now fetches standings from `GET /seasons/{id}/standings` instead of aggregating client-side. Participant fetching skipped at season scope.
- **`SeasonHero`** — cup-qualifying progress bar now uses `season.event_count` instead of the hardcoded `~12`.
- **`Season` type** — added `event_count: number` and `comp_avg_n: number` fields.
- **`StandingEntry` type** — added optional `comp_avg?: number | null` and `comp_avg_n?: number` for season scope data.
- **`ApiSeason`** — added `event_count` and `comp_avg_n` fields.

### Removed

- **`NavSidebar.tsx`** — replaced by `ScopeBar`.
- Duplicate `<ManaSwitcher size="sm" />` from the (now-removed) mobile top bar.

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
