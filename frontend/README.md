# MM Ladder — Frontend

Next.js 15 (App Router) frontend for the MM Ladder API. Displays a live draft-league leaderboard with a 5-way Magic: The Gathering mana colour theme switcher.

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
│   ├── layout.tsx          # Root HTML shell — fonts, ManaThemeProvider, data-mana default
│   ├── page.tsx            # "/" route — renders <LeaderboardPage />
│   └── globals.css         # Tailwind v4 @theme tokens + @utility sheen classes
├── components/
│   ├── LeaderboardPage.tsx # Top-level page: layout, filter state, data hook
│   ├── Leaderboard.tsx     # Sortable ranked table with medal treatment
│   ├── NavSidebar.tsx      # Season selector + tournament list
│   └── ManaSwitcher.tsx    # 5-button mana theme radio group
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
