# mm-ladder

A draft league ladder tracker for Magic Mates Monday.

## Components

| Component | Description |
|-----------|-------------|
| [`backend/`](backend/README.md) | FastAPI async REST API + SQLite database layer |
| [`frontend/`](frontend/README.md) | Next.js 16 leaderboard UI with mana colour themes |

## Dev setup

Run both services in separate terminals:

**Terminal 1 — Backend** (FastAPI on `localhost:8000`):
```bash
cd backend
poetry install
poetry run uvicorn mm_ladder.app:app --reload --port 8000
```

**Terminal 2 — Frontend** (Next.js on `localhost:3000`):
```bash
cd frontend
npm install
cp .env.local.example .env.local   # only needed once
npm run dev
```

Open `http://localhost:3000` — the leaderboard loads data live from the API.

## Testing the API connection

### Quick smoke test (curl)
```bash
# Health check
curl http://localhost:8000/health

# List seasons (should return JSON array)
curl http://localhost:8000/seasons/

# List yearly cups
curl http://localhost:8000/yearly-cups/

# List all tournaments
curl http://localhost:8000/tournaments/

# Participants for tournament ID 1
curl http://localhost:8000/tournaments/1/participants
```

### Interactive docs
Open `http://localhost:8000/docs` for the full Swagger UI — try any endpoint live.

### Browser DevTools verification
1. Open `http://localhost:3000`
2. Open DevTools → **Network** tab → filter by `localhost:8000`
3. You should see requests to `/yearly-cups/`, `/seasons/`, `/tournaments/`, `/players/`
4. Click a season in the sidebar → a `/tournaments/{id}/participants` request fires for each tournament in scope
5. Open DevTools → **Network** → look for the floating **TanStack Query Devtools** button (bottom-right) to inspect cache state

### Environment variable
The frontend reads `NEXT_PUBLIC_API_URL` from `frontend/.env.local`:
```
NEXT_PUBLIC_API_URL=http://localhost:8000
```
Change this to point at a deployed backend (e.g. `https://api.example.com`) without rebuilding.
