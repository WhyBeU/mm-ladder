# Changelog

## [0.1.0] - 2026-05-03

### Added

- Next.js 15 App Router scaffold (TypeScript, Tailwind v4, ESLint, React Compiler)
- Mana theme system: 5 CSS variable palettes (W/U/B/R/G) swapped via `[data-mana]` on `<html>`, persisted in `localStorage` under `mm-ladder:mana-theme`
- `ManaThemeContext` — React Context providing `theme` / `setTheme`, SSR-safe hydration (default `U` on server, corrected on client mount)
- `ManaSwitcher` — 5-button mana symbol radio group wired to `ManaThemeContext`
- `NavSidebar` — season selector + tournament list with loading skeleton and mobile close button
- `Leaderboard` — sortable ranked table with gold/silver/bronze medal treatment, search, and collapsed mobile layout
- `LeaderboardPage` — top-level page composing all components; `useLeaderboardData` stub returns empty arrays pending TanStack Query wiring (Step 5)
- Tailwind v4 design tokens in `src/app/globals.css` via `@theme`: ink/primary (runtime-themed via CSS vars), accent/silver/bronze/win/loss/draw (static), sheen gradients via `@utility`, custom shadows and border radius
- `src/styles/themes.css` — CSS variable palettes for all 5 mana themes + body background gradient and grain overlay
- Google Fonts: Cinzel (display) and Open Sans (body) via `next/font/google`
