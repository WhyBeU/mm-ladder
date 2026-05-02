# mm-ladder

A draft league ladder tracker for Magic Mates Monday.

## Components

| Component | Description |
|-----------|-------------|
| [`backend/`](backend/README.md) | FastAPI async REST API + SQLite database layer |
| [`frontend/`](frontend/README.md) | Next.js 15 leaderboard UI with mana colour themes |

## Dev setup

**Backend** (FastAPI on `localhost:8000`):
```bash
cd backend
poetry install
poetry run uvicorn mm_ladder.main:app --reload
```

**Frontend** (Next.js on `localhost:3000`):
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

API docs available at `http://localhost:8000/docs`.
