# DEPLOYMENT

Options and trade-offs for taking mm-ladder live. This is a **decision document** — nothing here is
implemented yet. Prices and limits checked July 2026; re-verify before committing to a platform.

> **Revision 2 (2026-07-14):** two requirement changes — Postgres migration is now *accepted* work,
> and the SpeedyImport Chrome extension (ThornyBlueCactus) will post results directly to an
> mm-ladder endpoint. This flips the recommendation: see §9 at the bottom.
> Sections 2–8 are kept as the original analysis; superseded verdicts are marked.

---

## 1. What we're deploying

| Piece | Stack | Deployment shape |
| --- | --- | --- |
| Backend | FastAPI (async) + SQLAlchemy 2 + **SQLite** (`aiosqlite`), Alembic migrations, Python 3.13 / Poetry | Long-running ASGI process (uvicorn) **or** serverless functions |
| Frontend | Next.js 16 (React Compiler), data fetched client-side via TanStack Query | Static/SSR hosting, reads `NEXT_PUBLIC_API_URL` at build time |
| Database | Single SQLite file (`mm_ladder.db`), currently ~small MBs | Needs to survive restarts + get backed up |

The backend is already 12-factor ready — everything needed for deployment is an env var:

- `DATABASE_URL` (defaults to `sqlite+aiosqlite:///./mm_ladder.db`)
- `CORS_ORIGINS` (comma-separated allowed origins)
- `ADMIN_TOKEN` (fails closed — writes rejected if unset)
- `AUTO_MIGRATE` (Alembic runs on boot by default; idempotent)
- `ENV` (structlog dev vs prod rendering)

### Workload profile

A weekly draft league for one playgroup: traffic is tens of users, bursty on Monday nights,
essentially zero the rest of the week. Writes happen only through the admin portal and the
migration CLI. This means:

- **Scale-to-zero is desirable** — the app is idle >95% of the time.
- **A single instance is fine** — and with SQLite, a single writer is *required*.
- **Free/near-free tiers are realistic**, not a compromise.

### Requirements

1. Public HTTPS API + public frontend, low cost (target: **< $5/month + domain**).
2. Data durability: the SQLite file (or its replacement) must survive deploys/restarts and be backed up.
3. Deploys triggered from CI/CD on PR merge to `main`, **with a manual approval gate**.
4. Optional custom domain (e.g. `magic-mates.com`).

---

## 2. The database question (decide this first)

Everything else hangs off this choice. SQLite is embedded — "serverless DB" and "SQLite" pull in
opposite directions, so there are three coherent paths:

### Path 1 — Keep SQLite, host it on a persistent volume ✅ recommended

The app runs as a single container with the `.db` file on an attached volume (Fly.io volume,
Railway volume). **Zero code changes.** Backups via provider volume snapshots (Fly does daily
snapshots, 5-day retention) plus optionally [Litestream](https://litestream.io/) streaming
replication to free object storage (Cloudflare R2 free tier: 10 GB).

- ✅ No migration risk — prod runs exactly what dev and tests run
- ✅ Simplest mental model; `AUTO_MIGRATE` on boot just works
- ❌ Pins you to "one container with a disk" hosts (rules out pure serverless)
- ❌ Hard cap of one instance (irrelevant at our scale)

### Path 2 — Migrate to managed Postgres (Neon)

[Neon](https://neon.com/pricing) free tier: 0.5 GB storage, 100 compute-hours/month,
scale-to-zero after 5 min idle, resume in ~hundreds of ms. Plenty for this workload, $0/month.
SQLAlchemy makes the swap mostly `DATABASE_URL = postgresql+asyncpg://...` + adding `asyncpg`,
**but**: every Alembic migration was written against SQLite, tests run on SQLite, and subtle
dialect differences (type affinity, `INSERT ... RETURNING` behaviours, batch-alter workarounds)
mean a real porting + re-testing effort.

- ✅ Unlocks genuinely serverless backends (Vercel functions, Lambda) and $0 hosting
- ✅ "Real" managed DB: point-in-time restore, connection from anywhere
- ❌ Migration + dual-dialect testing effort; dev/prod parity lost unless dev moves to Postgres too
- ❌ Free-tier cold resume adds latency to the first Monday-night request

### Path 3 — Turso (libSQL, "SQLite over the network")

[Turso](https://turso.tech/pricing) free tier is generous (5 GB, 500 M row reads/month). Keeps the
SQLite dialect, but the app uses `aiosqlite`; Turso needs the `libsql` driver + SQLAlchemy dialect,
whose async support is less mature than `asyncpg`/`aiosqlite`. You take on a niche dependency to
avoid a migration that Path 1 avoids entirely.

- ✅ SQLite semantics, free tier, DB reachable from serverless hosts
- ❌ Immature SQLAlchemy async story; niche failure modes; still a code change
- ❌ Solves a scaling problem we don't have

**Verdict (rev 1, superseded):** ~~Path 1 now. Path 2 is the documented escape hatch.~~
**Rev 2: Path 2 (Neon Postgres) is chosen** — the migration cost is accepted in exchange for a
stateless backend. See §9.

---

## 3. Backend hosting options

| | Fly.io | Railway | Render | Vercel (Python fns) | VPS (Hetzner) |
| --- | --- | --- | --- | --- | --- |
| Model | Pay-as-you-go container (Machines) | Container, $5/mo plan + usage | Container | Serverless ASGI | Raw box |
| SQLite-on-volume | ✅ Volumes, $0.15/GB/mo | ✅ Volumes, $0.15/GB/mo | Paid only ($0.25/GB/mo; free tier has **no disk**) | ❌ needs Path 2/3 | ✅ local disk |
| Scale-to-zero | ✅ `auto_stop_machines` + `min_machines_running = 0` | ⚠️ App sleeping (usage-based savings) | Free tier sleeps after 15 min (~1 min cold start) | ✅ inherent | ❌ always on |
| Est. cost/month | **~$2–3** (shared-cpu-1x 256 MB ≈ $2.02 always-on, less with auto-stop, + volume) | **$5 min** (subscription incl. $5 usage credit) | $0 (unusable: no disk) or **$7+** | **$0** (Hobby) | **~€4.5** |
| Deploy from CI | `flyctl deploy` + `FLY_API_TOKEN` — clean | CLI or GitHub trigger | Git-push or deploy hook | Git integration / `vercel` CLI | DIY (ssh + systemd/docker) |
| Prior experience | — | ✅ DischordLeaderboard bot runs here | — | — | — |

### Fly.io ✅ recommended

One `shared-cpu-1x` Machine + 1 GB volume in `syd` (close to the playgroup). With
auto-stop/auto-start the machine sleeps when idle and Fly's proxy wakes it on request (cold start:
a few seconds — uvicorn boot + Alembic no-op check). Dockerfile needed (straightforward for
Poetry). Daily volume snapshots included. No monthly minimum — realistic bill **$1–3/month**.
Note: Fly has **no free tier** anymore ([pricing](https://fly.io/docs/about/pricing/)); a shared
IPv4 is free, dedicated IPv4 is $2/mo (not needed).

- ✅ Cheapest volume-backed container hosting; excellent CLI/CI story; EU regions
- ✅ Scale-to-zero fits the "idle 6 days a week" profile
- ❌ New platform to learn (though `fly.toml` is small); occasional platform-reliability grumbles in community
- ❌ Costs are usage-metered — need a billing alert, not a surprise

### Railway

Familiar from DischordLeaderboard (`railway.json`, Nixpacks — no Dockerfile needed). Volumes
supported. Flat **$5/month minimum** which the app's actual usage will sit well inside.
Choose this if operational familiarity is worth ~$3/month over Fly.

- ✅ You already operate a Railway service; least new learning
- ✅ Nixpacks auto-detects Poetry — possibly zero build config
- ❌ ~2× the cost of Fly for this workload; volume backups are more manual (no automatic snapshots on Hobby)

### Render

Free tier spins down after 15 min **and has no persistent disk** — SQLite data would vanish on
every restart, so free Render is a non-starter for Path 1. Paid ($7/mo) + disk ($0.25/GB) is
strictly worse than Fly/Railway here. Not recommended.

### Vercel Python functions (+ Neon) — the $0 path

FastAPI runs as a Vercel serverless function ([officially documented](https://vercel.com/docs/frameworks/backend/fastapi),
Fluid compute, Python 3.12–3.14), frontend and backend both on Vercel Hobby, DB on Neon free tier. Total: **$0/month**. Requires Path 2 (Postgres migration),
monorepo build config, and accepting Hobby-plan limits (non-commercial use, 1 M invocations/mo —
both fine for a hobby league). `AUTO_MIGRATE` on boot doesn't fit serverless (every cold start
would run Alembic) — migrations move into the CI pipeline instead.

- ✅ Genuinely $0; one platform for everything; zero servers to think about
- ❌ Blocked on the Postgres migration effort; double cold start (function + Neon resume)
- ❌ More moving parts in build config; harder local-parity story

### VPS (Hetzner CX22 ~€4.5/mo)

Full control, always-on, SQLite on local disk, Caddy for TLS. But you own OS patching, TLS,
backups, and deploy tooling. The "gate on PR merge" pipeline becomes ssh scripts. More ops than
this project deserves.

---

## 4. Frontend hosting options

| | Vercel Hobby | Cloudflare Workers (OpenNext) | Netlify Free |
| --- | --- | --- | --- |
| Next.js support | First-class (they make Next.js) | Good — [OpenNext adapter hit 1.0 GA Feb 2026](https://opennext.js.org/cloudflare), 3 MiB worker limit on free | Good (runtime adapter) |
| Cost | $0 (100 GB bandwidth, 1 M invocations/mo) | $0 (100 K requests/day) | $0 (100 GB bandwidth) |
| Caveats | **Non-commercial use only** on Hobby (fine — hobby league); commercial ⇒ $20/mo Pro | Adapter adds build complexity; you already run CF Pages (DischordLeaderboard) | Slower innovation on Next.js features |
| Custom domain | ✅ free, auto-TLS | ✅ free, auto-TLS | ✅ free |
| Gated deploys | Git integration auto-deploys (gate = PR review), or CLI deploy from gated Actions job | CI-driven (`wrangler deploy`) — gates naturally | Similar to Vercel |

**Recommendation: Vercel Hobby.** Zero-config for Next.js 16, free at this scale, and
`NEXT_PUBLIC_API_URL` is just a project env var. Cloudflare Workers is the fallback if Vercel's
non-commercial clause ever becomes a problem (e.g. league fees flow through the site) — the app
has no SSR-critical paths (data loads client-side from the API), so it ports easily; a fully
static `output: "export"` build on CF Pages is even plausible.

---

## 5. Domain

**✅ Done (2026-07-18): `mtg-magic-mates.com`** — registered at Porkbun, 5 years (~$11/yr, WHOIS
privacy + auto-renew on). Vercel's own registrar was tried first but its buy flow failed
repeatedly (dashboard "Search stream stuck" + generic CLI purchase error), so Porkbun it is.

Live configuration:

- Porkbun nameservers → `ns1.vercel-dns.com` / `ns2.vercel-dns.com` — Vercel manages all DNS
  records and TLS; nothing is configured at Porkbun beyond the nameservers.
- `mtg-magic-mates.com` → `mm-ladder` frontend project; `www.mtg-magic-mates.com` → 308 redirect
  to the apex.
- Backend env: `CORS_ORIGINS` includes `https://mtg-magic-mates.com` and `https://www.mtg-magic-mates.com`
  (plus the `*.vercel.app` origins and localhost as fallbacks).
- Frontend keeps `NEXT_PUBLIC_API_URL=https://mm-ladder-api.vercel.app` — the API stays on its
  `.vercel.app` URL; an `api.mtg-magic-mates.com` subdomain can be layered on later by adding the
  domain to the backend project and updating the frontend env var.

---

## 6. CI/CD with a deployment gate

Target flow, using **GitHub Actions + a protected `production` environment** (the gate =
required-reviewer approval on the environment — free on public repos; private repos would need
GitHub Pro/Team for environment protection rules. **Verified: this repo is public**, so the gate
is free):

```text
PR merged to main
      │
      ▼
GitHub Actions: CI (tox + frontend build)     ← already the quality bar
      │
      ▼
deploy-backend job  (environment: production) ── waits for manual approval  ← THE GATE
      │  flyctl deploy --remote-only  (FLY_API_TOKEN secret)
      │  Alembic runs on boot via AUTO_MIGRATE=1
      ▼
deploy-frontend job (environment: production)
      │  Vercel: either git-integration auto-deploy (no extra gate; gate = PR merge itself)
      │  or `vercel deploy --prebuilt --prod` from this gated job (single gate for both)
      ▼
smoke test: curl https://api.../health + check frontend 200
```

Design choices:

1. **Gate mechanism:** GitHub *environment protection rules* (required reviewers) make the deploy
   job pause until someone clicks "Approve" in the Actions UI. Alternative if environments aren't
   available: `workflow_dispatch` manual trigger (deploys are a button press, merge does nothing).
2. **One gate or two:** simplest is to gate both deploys behind the same `production` environment
   approval. Letting Vercel auto-deploy on merge is even simpler but means frontend ships ungated.
3. **Migrations:** keep `AUTO_MIGRATE=1` (boot-time, idempotent, single instance ⇒ no race).
   If we ever move to Path 2/serverless, migrations become an explicit CI step before deploy.
4. **Rollback:** `flyctl releases rollback` / Vercel "promote previous deployment" — both one-liners; document them in a runbook section once live.
5. **Secrets:** `FLY_API_TOKEN`, `VERCEL_TOKEN` (if CLI-deploying) as repo secrets; `ADMIN_TOKEN`, `CORS_ORIGINS` as Fly app secrets (`fly secrets set`), `NEXT_PUBLIC_API_URL` as a Vercel env var.

---

## 7. The bundles, compared

| | **A — Fly + Vercel** ✅ | **B — Railway + Vercel** | **C — All-Vercel + Neon ($0)** | **D — VPS** |
| --- | --- | --- | --- | --- |
| Backend | Fly Machine + volume | Railway + volume | Vercel Python functions | Hetzner + Caddy |
| Database | SQLite on volume (no code change) | SQLite on volume (no code change) | Neon Postgres (**migration required**) | SQLite on disk |
| Frontend | Vercel Hobby | Vercel Hobby | Vercel Hobby | Same box or Vercel |
| Cost/month | **~$2–3** | **~$5** | **$0** | ~€4.5 |
| Code changes | None | None | Postgres port + serverless adaptation | None |
| New platform learning | fly.toml + Dockerfile | ~None (Railway known) | Vercel functions + Neon | Everything (ops) |
| Backups | Volume snapshots (daily, built-in) + optional Litestream→R2 | Manual/scripted | Neon PITR built-in | DIY |
| Scale-to-zero | ✅ | Partial | ✅ | ❌ |
| Main risk | Usage billing surprises (mitigate: billing alert) | Slightly higher floor cost | Migration effort + dual cold starts | Ops time sink |

Plus `magic-mates.com` at **$10.44/yr** (Cloudflare Registrar) for any bundle.

## 8. Recommendation (rev 1 — superseded by §9)

**Bundle A — Fly.io backend (SQLite on a volume, scale-to-zero) + Vercel Hobby frontend +
Cloudflare for domain/DNS.** Roughly $2–3/month + $10/year, zero code changes, and every piece has
a documented escape hatch (Railway if Fly annoys, Cloudflare Workers if Vercel's ToS bites, Neon
if SQLite ever constrains us).

**Bundle B (Railway)** is the "boring is good" runner-up: you already operate Railway, and the
premium is ~$3/month for familiarity. **Bundle C** is the only $0 option but buys that with a
Postgres migration — worth revisiting only if the migration becomes desirable for its own sake.

### Implementation order (once a bundle is chosen)

1. Backend Dockerfile + `fly.toml` (or `railway.json`), deploy manually, verify `/health` + volume persistence across restart
2. Set `ADMIN_TOKEN` / `CORS_ORIGINS` secrets; smoke-test admin writes
3. Vercel project for `frontend/`, `NEXT_PUBLIC_API_URL` pointed at the deployed API
4. GitHub Actions deploy workflow + `production` environment with required reviewer
5. (Optional) Buy domain, wire DNS + certs, update CORS/API-URL env vars
6. (Optional) Litestream → Cloudflare R2 off-site backup; billing alerts
7. Runbook section in this doc: rollback, secret rotation, restoring from snapshot

### Open questions

- **Domain name** — `magic-mates.com` and `magicmates.com` are **taken** (RDAP, checked 2026-07-13).
  Available: `mm-ladder.com`, `mmladder.com`, `magicmatesmonday.com`, `magic-mates-monday.com`,
  `magicmates-mtg.com`. Or skip the domain for v1 (`*.fly.dev` + `*.vercel.app`).
  **Resolved 2026-07-18:** bought `mtg-magic-mates.com` (Porkbun, 5 yr) — see §5.
- Where does the prod SQLite file get seeded from — run the migration CLI against prod once, or upload the current `mm_ladder.db`?
- Does anything commercial ever touch the site (league fees)? Determines Vercel Hobby eligibility long-term.

### Resolved

- ~~Repo visibility~~ — verified **public** (`WhyBeU/mm-ladder`), so environment protection rules (the deploy gate) are free.
- ~~Fly.io billing minimum~~ — no enforced monthly minimum; pure pay-as-you-go after the trial.
- ~~Vercel Python viability~~ — FastAPI is [officially documented](https://vercel.com/docs/frameworks/backend/fastapi) on Vercel (Fluid compute, Python 3.12–3.14), strengthening Bundle C as a future option.

---

## 9. Revision 2: Postgres accepted + extension ingest

**What changed (2026-07-14):** Postgres is acceptable if it eases maintenance and deployment, the
existing SQLite data gets migrated at first deploy, and the SpeedyImport Chrome extension
(ThornyBlueCactus / limitedspoiler.com) will POST tournament results directly to an mm-ladder
endpoint going forward.

### 9.1 What this changes — and what it doesn't

Moving to managed Postgres makes the backend **stateless**: no volume, no snapshot story, no
single-instance constraint, `DATABASE_URL` is just a secret. That dissolves the constraint that
drove rev 1's ranking ("needs a container with a disk"), so:

- **Bundle C (all-Vercel + Neon) is unblocked** and becomes the front-runner at **$0/month** —
  its only real cost was the migration, which is now accepted work.
- **Fly stays relevant as "A′"** — Fly + Neon + Vercel (~$2/mo): a plain always-the-same uvicorn
  process, no serverless adaptation, `AUTO_MIGRATE` keeps working. The fallback if serverless
  friction shows up.
- **Railway loses its edge** — its familiarity premium was about operating a stateful container;
  with no state to manage anywhere, there's little left to pay $5/mo for.
- **The extension requirement is host-agnostic** — one POST per tournament, weekly. It changes the
  API surface and auth design, not the hosting economics.

### 9.2 Sizing the Postgres port (verified against the code)

Smaller than rev 1 assumed:

- `alembic/env.py` already runs `render_as_batch=True`, and the migration files use
  `op.batch_alter_table` — **batch mode is a pass-through on Postgres** (plain `ALTER TABLE`),
  so the existing chain should replay on PG with at most minor fixes.
- `TournamentParticipant.points` is `Computed("match_wins * 3 + match_draws", persisted=True)` →
  PG 12+ `GENERATED ALWAYS AS ... STORED`. Supported; just skip this column when copying data.
- `enable_sqlite_foreign_keys` already branches on dialect — no-op on PG (FKs always enforced).
- Work items: add `asyncpg`; replay the migration chain against a local PG (Docker) and fix
  breakage; add a CI job running the test suite against a Postgres service container (keep the
  fast SQLite in-memory suite for local dev); use a Neon **branch** as the dev database if full
  parity is wanted.
- Serverless detail (Bundle C only): use Neon's **pooled** connection string with
  `poolclass=NullPool` and asyncpg's `statement_cache_size=0` (PgBouncer + prepared statements
  don't mix); keep the direct URL for migrations. `AUTO_MIGRATE=0` — migrations move into the
  deploy pipeline as an explicit `alembic upgrade head` step.

### 9.3 Seeding prod — copy, don't re-scrape

The migrate CLI (`migration/cli.py`) **scrapes limitedspoiler.com and writes directly into a local
SQLite file** — it does not go through the API. Re-scraping into Neon would rebuild tournament
data but **lose everything curated through the admin portal** (player merges, aliases, champion /
POTY / cup-winner awards, qualification flags), which exists only in `mm_ladder.db`.

**Plan:** one-time copy script `mm_ladder.db` → Neon — iterate `Base.metadata.sorted_tables`,
bulk-insert (skipping the generated `points` column), reset PG sequences, verify row counts per
table. The scraper stays available for historical re-imports but is no longer the ongoing feed.

### 9.4 The ingest endpoint (new API surface)

> **Superseded (2026-07-21).** Results ingest shipped as an **admin PDF upload**, not a browser
> extension: the admin uploads EventLink "Standings by Rank" PDF exports at
> `POST /upload/tournament-results-from-pdf` (admin-auth via `X-Admin-Token`, no separate
> `INGEST_TOKEN`), with a dry-run preview and a unique `tournament.eventlink_id` for idempotency.
> See the admin how-to (`frontend/public/docs/upload-results.md`). The extension design below is
> kept for historical context.

EventLink → SpeedyImport extension → `POST /import/tournament-results` → mm-ladder.

| Concern | Design | Lesson from ThornyBlueCactus docs |
| --- | --- | --- |
| Auth | Separate `INGEST_TOKEN` env var (same fail-closed pattern as `ADMIN_TOKEN`), sent as a header. Rotate independently of admin access. | `LeagueToken` had no rotation story — build it in from day one |
| CORS | **None needed if done right:** MV3 extensions fetching from the *background service worker* with the API domain in `host_permissions` bypass CORS entirely. Avoid whitelisting `chrome-extension://<id>` origins. | limitedspoiler whitelists a hardcoded extension ID that's only stable for one packing key — a documented sharp edge; don't recreate it |
| API base URL | Build-time env in the extension (webpack `DefinePlugin`), not a hardcoded constant. | `apiService.ts` hardcodes the prod URL; every local test requires editing source |
| Idempotency | Upsert keyed on (season, date/round identity) — re-submitting a tournament must not duplicate rows. The importer's consolidation logic is reusable. | `Handy Scripts/` bare-INSERT culture is the cautionary tale |
| Cold start | Extension should tolerate a 1–3 s first-request delay (function spin-up + Neon resume) and retry on timeout. | — |

The extension work itself lives in the ThornyBlueCactus repo (or a fork) and is a separate
project; mm-ladder's side is just the endpoint + token.

### 9.5 Re-ranked bundles

| | **C — All-Vercel + Neon** ✅ | **A′ — Fly + Neon + Vercel** | **B — Railway (+ its PG)** | **D — VPS** |
| --- | --- | --- | --- | --- |
| Backend | Vercel Python functions ([officially supported](https://vercel.com/docs/frameworks/backend/fastapi), Fluid compute) | Fly Machine, stateless, no volume | Railway container + Railway Postgres | Hetzner + local PG or SQLite |
| Cost/month | **$0** | **~$2** | **$5** floor | ~€4.5 |
| Platforms to operate | 2 (Vercel + Neon) | 3 (Fly + Neon + Vercel) | 2–3 | 1 + everything DIY |
| Deploy story | git push (or gated CLI) — no Docker | Dockerfile + flyctl | Nixpacks | ssh scripts |
| Migrations | explicit CI step | `AUTO_MIGRATE` on boot still fine | either | manual |
| Marginal effort after the shared PG port | ~2 d (functions entrypoint, pooling config, monorepo setup) | ~1.5 d (Dockerfile, fly.toml) | ~1 d | ~3 d + ongoing |
| Residual risk | serverless quirks: pooling, cold starts, Hobby ToS (non-commercial) | usage billing; one more platform | paying $5 for familiarity that no longer buys much | ops time sink |

### 9.6 Recommendation (rev 2)

**Bundle C — FastAPI as Vercel functions + Neon free Postgres + Vercel Hobby frontend.**
$0/month + $10.44/yr domain, one dashboard, git-push deploys, no Docker anywhere, Neon PITR as
the backup story. This directly serves the stated goal (minimize maintenance + deploy friction).

**Named fallback:** if the serverless spike fights back (pooling weirdness, request limits,
anything that eats more than ~half a day), pivot to **A′ (Fly + Neon)** — the Postgres port is
identical for both, so nothing is wasted. That's the decision point, and it comes early.

### 9.7 Implementation order (rev 2)

1. **PG port:** add `asyncpg`; replay Alembic chain on local Postgres (Docker); fix breakage; CI job with PG service container
2. **Neon:** create project; `alembic upgrade head` against it (direct URL)
3. **Seed:** one-time copy script `mm_ladder.db` → Neon; verify row counts; spot-check leaderboard totals against the live local app
4. **Backend on Vercel:** `api/` entrypoint exposing `app`, `vercel.json` (`maxDuration`), env: pooled `DATABASE_URL`, `ADMIN_TOKEN`, `CORS_ORIGINS`, `AUTO_MIGRATE=0` — *fallback checkpoint lives here*
5. **Frontend project** + `NEXT_PUBLIC_API_URL`
6. **Pipeline:** CI → gated `production` env → `alembic upgrade head` → deploy backend + frontend → smoke test
7. **Ingest endpoint** + `INGEST_TOKEN`; extension changes tracked in the ThornyBlueCactus repo
8. **Domain** — ✅ `mtg-magic-mates.com` live (see §5): NS → Vercel, `www` → apex redirect, CORS updated

---

*Pricing sources (July 2026): [Fly.io pricing](https://fly.io/docs/about/pricing/) ·
[Railway plans](https://docs.railway.com/pricing/plans) · [Render pricing](https://render.com/pricing) ·
[Vercel Hobby](https://vercel.com/docs/plans/hobby) · [Neon pricing](https://neon.com/pricing) ·
[Turso pricing](https://turso.tech/pricing) · [Cloudflare Workers/Pages](https://www.cloudflare.com/plans/developer-platform/) ·
[Cloudflare Registrar](https://www.cloudflare.com/products/registrar/) · [OpenNext for Cloudflare](https://opennext.js.org/cloudflare)*
