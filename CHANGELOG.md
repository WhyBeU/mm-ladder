# Changelog

All notable changes to this project will be documented in this file.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

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

---

## [0.1.0] — 2026-04-28 — Frontend: Base Setup

### Added
- Next.js 16 App Router scaffold with TypeScript, Tailwind CSS v4, ESLint.
- Mana theme system (5 MTG color themes: W/U/B/R/G) with CSS variable switching and `localStorage` persistence.
- `NavSidebar` + `NavLayout` with season selector and tournament list.
- `Leaderboard` table: sortable by points/name/record/tournaments, gold/silver/bronze medal treatment, mobile card layout.
- `ManaSwitcher` component with custom SVG mana symbols.
- `ManaThemeContext` for global theme state.
- `LeaderboardPage` orchestrating sidebar, header, table, and footer with a stub data hook ready for TanStack Query.

---

## [0.3.1] — Backend (current)

See `backend/pyproject.toml` for backend version history.
