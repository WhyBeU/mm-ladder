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
│   ├── layout.tsx          # Root HTML shell — fonts (Inter, Cinzel), Keyrune + Mana (local), ManaThemeProvider
│   ├── page.tsx            # "/" route — renders <LeaderboardPage />
│   └── globals.css         # Tailwind v4 @theme tokens + @utility classes (eyebrow, pulse-soft, set-placard)
├── components/
│   ├── LeaderboardPage.tsx # Top-level page: scope state, layout, data fetching/adapters
│   ├── Leaderboard.tsx     # Sortable ranked table — rank delta, streak chips, sparkline, expandable rows
│   ├── ScopeBar.tsx        # Scope selector bar (All-time → Cup → Season → Event → Pod)
│   ├── SeasonHero.tsx      # Title card (set symbol watermark, cup progress) + leader card + StatsStrip
│   ├── Podium.tsx          # Top-3 gold/silver/bronze cards
│   ├── ManaSwitcher.tsx    # 5-button mana theme radio group
│   ├── RegistrationBoard.tsx # Public pod-registration board (/board)
│   ├── PodMaker.tsx        # Draft pod-splitter (/pods)
│   ├── admin/              # Admin portal (/admin): cups, seasons, tournaments, players, merge, history, docs
│   └── bits.tsx            # Shared UI atoms: PlayerAvatar, RankDelta, StreakChips, Sparkline, PointsByEventChart
├── lib/
│   ├── types.ts            # TypeScript types: Scope, YearlyCup, Season, MMLEvent, StandingEntry, SeasonStats
│   ├── api.ts              # Public read API client
│   ├── adminApi.ts         # Token-guarded admin write client
│   └── boardApi.ts         # Public pod-board client
├── context/
│   └── ManaThemeContext.tsx # Runtime theme state — reads/writes localStorage
└── styles/
    └── themes.css          # CSS variable palettes for W/U/B/R/G mana themes
```

### Mana theme system

Themes are driven by a `data-mana` attribute on `<html>` (values: `W` `U` `B` `R` `G`). `themes.css` defines CSS custom properties (`--ink-*`, `--primary-*`, `--bg-radial-*`) for each value. Tailwind utilities like `bg-ink-950` and `text-primary-300` reference these vars via `@theme` in `globals.css`, so switching the attribute instantly repaints every themed surface.

`ManaThemeContext` manages the attribute and persists the selection to `localStorage` under `mm-ladder:mana-theme`.

### Server vs client components

`layout.tsx` and `page.tsx` are server components (no directive). Every interactive component (`"use client"`) opts in explicitly — `ManaThemeProvider`, `ManaSwitcher`, `ScopeBar`, `Leaderboard`, `LeaderboardPage`.

## Updating the MTG icon fonts (set symbols & mana pips)

Two icon fonts are **vendored locally** (copied into `public/`, not loaded from a CDN and
not listed in `package.json`) so the app works offline and the version is pinned:

| Font | Purpose | Markup | Loaded by |
|---|---|---|---|
| **Keyrune** | Set / expansion symbols | `<i class="ss ss-{setcode}" />` | `public/css/keyrune.min.css` |
| **Mana** | Mana pips (W/U/B/R/G…) | `<i class="ms ms-{w\|u\|b\|r\|g}" />` (add `ms-cost` for the coloured disc) | `public/css/mana.min.css` |

Both stylesheets are linked from `src/app/layout.tsx` and reference their font files via
relative `../fonts/` URLs, so **no code changes are needed when you update them** — you only
replace files in `public/`.

### When you need this

A set symbol `ss-{setcode}` only exists once Keyrune ships support for that set. So **when a
new MTG set releases** and you want its symbol on a season, you must bump the vendored Keyrune
to a version that includes the new set, then use the new code. (The app already renders
`<i class="ss ss-{set_code}">` from a season's `set_code`, lowercased — so once the font knows
the code, simply creating/editing the season with that `set_code` shows its symbol; see the
admin **Docs → Start a new season** how-to.)

### Update Keyrune (set symbols)

Recommended — pull a pinned version via npm, copy the dist files into `public/`, then drop the
package (it stays vendored, never a dependency):

```bash
cd frontend
npm install --no-save keyrune@latest          # or @3.20.0 etc — pin a specific version
cp node_modules/keyrune/fonts/keyrune.woff2 public/fonts/
cp node_modules/keyrune/fonts/keyrune.woff  public/fonts/
cp node_modules/keyrune/css/keyrune.min.css public/css/
rm -rf node_modules/keyrune                    # vendored only — keep it out of package.json
```

> The `.min.css` also references `keyrune.eot/.ttf/.svg` relatively; we only ship `.woff2`
> (+ `.woff` fallback) because every supported browser uses those — the others 404 harmlessly
> and are never requested. Copy them too if you want a clean network tab.

Alternative: download the release zip from
[github.com/andrewgioia/keyrune/releases](https://github.com/andrewgioia/keyrune/releases) and
copy the same three files.

### Update Mana (mana pips) — same procedure

```bash
cd frontend
npm install --no-save mana-font@latest         # or pin a version
cp node_modules/mana-font/css/mana.min.css   public/css/
cp node_modules/mana-font/fonts/mana.*       public/fonts/
cp node_modules/mana-font/fonts/mplantin.*   public/fonts/   # referenced by the css; vendored to avoid 404s
rm -rf node_modules/mana-font
```

### Verify after either update

1. `npm run build` (must compile).
2. `npm run dev`, open a page that uses the icon, and confirm it renders — e.g. a season with
   the new `set_code` (Keyrune), or the header mana roundel (Mana).
3. Find available codes: the [Keyrune cheatsheet](https://keyrune.andrewgioia.com/cheatsheet.html)
   and [Mana cheatsheet](https://mana.andrewgioia.com/), or grep the vendored CSS, e.g.
   `grep "ss-{newcode}" public/css/keyrune.min.css`.

**Usage note:** set codes are lowercase in markup (`ss-blb`) but shown uppercase in the UI
(`BLB`).

## Connecting to the backend

Start the FastAPI backend:

```bash
cd backend
poetry run uvicorn mm_ladder.app:app --reload
# API docs at http://localhost:8000/docs
```

The frontend reads `NEXT_PUBLIC_API_URL` for all fetch calls. With the default `.env.local`, requests go to `http://localhost:8000`.
