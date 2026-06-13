# Admin Portal

The admin portal is a password-protected area at **`/admin`** for viewing and correcting the
data behind the public leaderboard: yearly cups, seasons, tournaments, participants, players,
champion awards, and cup qualification. It also includes a player-merge tool for cleaning up
duplicate accounts.

It is a corrections/curation surface — bulk data still comes in through the migrate CLI pipeline.

## Setup

### 1. Set the admin password (backend)

The backend reads a single shared secret from the `ADMIN_TOKEN` environment variable. **All
write endpoints** (POST/PUT/PATCH/DELETE) require it; GET endpoints stay public so the
leaderboard keeps working.

Set it in the **same terminal** you start the backend from (it lives only for that session):

```bash
# bash / zsh (macOS, Linux)
export ADMIN_TOKEN="choose-a-long-random-string"
```

```powershell
# PowerShell (Windows) — note: `export` is not a PowerShell command
$env:ADMIN_TOKEN = "choose-a-long-random-string"
# persist across new shells (reopen the terminal afterward):
[Environment]::SetEnvironmentVariable("ADMIN_TOKEN", "choose-a-long-random-string", "User")
```

If `ADMIN_TOKEN` is unset or empty, the API **fails closed** — every write is rejected with
401. Set it before using the portal.

### 2. Allow the frontend origin (CORS)

Writes are sent from the browser with credentials. Ensure the backend `CORS_ORIGINS` includes
the site origin (defaults to `http://localhost:3000`).

### 3. Log in

Open `/admin`, enter the `ADMIN_TOKEN` value in the sign-in box. The token is stored in the
browser's `localStorage` (`mm_admin_token`) and sent as the `X-Admin-Token` header on every
write. There is no expiry; "Log out" clears it. A 401 from any write also clears it and returns
you to the sign-in screen.

> Security level is intentionally modest (one shared secret, no accounts). The important
> guarantee is that writes are enforced **server-side**, not merely hidden in the UI.

## Sections

The left nav has four sections. Each is a list → detail editor; pick an item to edit it, or use
**+ New** to create one. Detail editors share a **Save changes / Reset changes** pair (Reset
reverts to the last-saved values) and surface success/errors as toasts.

### Yearly Cups
Edit `year`, `name`, and dates. Assign the **Player of the Year** and **Cup winner** (player
search pickers). Manage **Qualified players** (manually validated) as a chip list. The detail
view also lists the cup's seasons.

### Seasons
Edit `name`, `set_code`, dates, `qualifier_count`, `event_count`, `qualifying_type`
(POINTS/BEST), the parent **Yearly cup**, and the **Season champion**. The detail view lists the
season's tournaments.

> Note: parent-cup, champion, and qualifying-type are set/changed here; clearing them back to
> "none" via the portal is not supported (a deliberate simplification).

### Tournaments
Edit `held_on`, `name`, `notes`, and the parent **Season**. `has_match_detail` is shown
read-only. Below the metadata is the **participant roster**:

- Set each participant's **W / L / D**. **Points is read-only** — the database computes it from
  W/L/D, and the public standings recompute automatically.
- The per-row **player picker reassigns** that result to a different player (fixes a
  misattribution without a full merge).
- Add a participant with the bottom row; remove one with the row's "remove".

Individual match pairings are intentionally not editable here — only aggregate W/L/D.

### Players
Edit `display_name`, the `hidden` toggle, and **aliases** (alternate spellings matched on
import) as a chip list. `is_veteran` is computed and not editable. Awards are **not** edited
here — they live in the Season and Cup editors.

## Deleting things

Every delete uses a confirmation dialog that requires typing **`delete`** before the button
enables, and states what will be removed:

- **Tournament** delete removes the tournament and all its participant rows (the primary use is
  removing a duplicate event).
- **Season / Cup** delete removes that record.
- **Player** delete is **blocked** (409) when the player has tournament participations — use the
  Merge tool instead.

## Merge players

Reached from the **⚙ Merge players** button on the Players list (not from an individual player).

1. Pick the **keep** (canonical) player.
2. Add one or more **duplicates**.
3. Review the preview, then type **`merge`** to confirm.

The merge reassigns all of the duplicates' participations (and any match references) to the
keeper, folds the duplicates' names/aliases into the keeper's aliases, repoints any champion /
POTY / cup-winner / qualification records, and deletes the duplicates. A merge is **rejected**
(409) if the players share a tournament or faced each other in a match, since that would create
an impossible record.

## History (audit log)

The **📜 History** tab is an append-only record of every change made through the portal. Each
write (create / update / delete across cups, seasons, tournaments, participants, players, matches,
and player merges) is logged atomically with the change itself, so the history can't drift from the
data.

Each entry is a single line — **action · what changed · summary · timestamp** — and expands to a
`field | old | new` diff. Filter by entity type and action, and page through with Prev/Next. The
data pipeline (migrate CLI) is intentionally **not** logged here — only actions taken by an admin
through the portal/API. Entries are never edited or deleted.

## Awards on the leaderboard

Awards set in the portal appear on the public leaderboard as an icon cluster by each player's name:

- **Season champion** — the set's Keyrune symbol in a mythic (amber/red) gradient; tooltip
  "{Season} Champion".
- **Player of the Year** — a foil (holographic) star; tooltip "{year} Player of the Year".
- **MM Cup winner** — the foil MM logo; tooltip "MM Cup winner {year}".

When an award type repeats (e.g. two POTY years), a single icon shows a small count badge and the
tooltip lists every year; when a player has many awards the cluster wraps to multiple lines. Badges
show on the season standings and — derived from the cups/seasons data — on the cup and all-time
scopes too.

On the **cup** view the podium is replaced by **Qualified players** cards (the players the admin
marked qualified, with their awards), and the hero's leader card is the cup's **Player of the
Year**. The cup and all-time scopes also show a faint MM-logo / star watermark in the header.
