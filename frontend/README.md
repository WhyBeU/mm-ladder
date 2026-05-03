# MM Ladder — Frontend

Next.js 16 (App Router) frontend for the MM Ladder API. Displays a live draft-league leaderboard with hierarchical scope navigation (All-time → Yearly Cup → Season → Event → Pod) and a 5-way Magic: The Gathering mana colour theme switcher.

## Setup

```bash
cd frontend
npm install
cp .env.local.example .env.local   # then edit if needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the FastAPI backend |

Copy `.env.local.example` to `.env.local` and adjust for your environment. `.env.local` is gitignored.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript check (`tsc --noEmit`) |

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root HTML shell — fonts (Inter, Cinzel), Keyrune CDN, ManaThemeProvider
│   ├── page.tsx            # "/" route — renders <LeaderboardPage />
│   └── globals.css         # Tailwind v4 @theme tokens + @utility classes (eyebrow, pulse-soft, set-placard)
├── components/
│   ├── LeaderboardPage.tsx # Top-level page: scope state, layout, mobile drawer, breadcrumb
│   ├── Leaderboard.tsx     # Sortable ranked table — rank delta, streak chips, sparkline, expandable rows
│   ├── NavSidebar.tsx      # Hierarchical scope tree (All-time → Cup → Season → Event → Pod)
│   ├── SeasonHero.tsx      # Title card (set symbol watermark, cup progress) + leader card + StatsStrip
│   ├── Podium.tsx          # Top-3 gold/silver/bronze cards
│   ├── ManaSwitcher.tsx    # 5-button mana theme radio group
│   └── bits.tsx            # Shared UI atoms: PlayerAvatar, RankDelta, StreakChips, Sparkline, PointsByEventChart
├── lib/
│   ├── types.ts            # TypeScript types: Scope, YearlyCup, Season, MMLEvent, StandingEntry, SeasonStats
│   └── mockData.ts         # Typed mock dataset — 30 players, 5 seasons, 6 events; computed standings
├── context/
│   └── ManaThemeContext.tsx # Runtime theme state — reads/writes localStorage
└── styles/
    └── themes.css          # CSS variable palettes for W/U/B/R/G mana themes
```

### Mana theme system

Themes are driven by a `data-mana` attribute on `<html>` (values: `W` `U` `B` `R` `G`). `themes.css` defines CSS custom properties (`--ink-*`, `--primary-*`, `--bg-radial-*`) for each value. Tailwind utilities like `bg-ink-950` and `text-primary-300` reference these vars via `@theme` in `globals.css`, so switching the attribute instantly repaints every themed surface.

`ManaThemeContext` manages the attribute and persists the selection to `localStorage` under `mm-ladder:mana-theme`.

### Server vs client components

`layout.tsx` and `page.tsx` are server components (no directive). Every interactive component (`"use client"`) opts in explicitly — `ManaThemeProvider`, `ManaSwitcher`, `NavSidebar`, `Leaderboard`, `LeaderboardPage`.

## Connecting to the backend

Start the FastAPI backend:

```bash
cd backend
poetry run uvicorn mm_ladder.main:app --reload
# API docs at http://localhost:8000/docs
```

The frontend reads `NEXT_PUBLIC_API_URL` for all fetch calls. With the default `.env.local`, requests go to `http://localhost:8000`.
