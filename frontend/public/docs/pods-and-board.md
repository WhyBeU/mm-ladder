# Pod-maker & sign-up board

Two tools for splitting players into draft pods. Neither touches official
standings.

## Sign-up board (`/board`)

A shared, always-on, public board you can post to Discord each week.

1. Players **claim themselves** from the roster (live-season players first, then
   everyone, with search) or add themselves as a free-text **extra**.
2. On the night, mark who's **present** (per player, or **Mark all present**).
3. Anyone can **Generate** pods, then set each pod's **Wizards pod code** (with
   **Copy**).
4. **Up to two formats:** add a second format (an existing season or a typed
   "Other…" name). The list splits per format, sign-ups can move between them with
   **▲/▼**, and Generate runs **within each format**.

The board polls every few seconds so sign-ups and pods stay live across devices.
**Clear board** resets it (confirm-guarded).

## Pod-maker (`/pods`)

A quick, local tool for building pods in one sitting — pick players from the roster
and generate. Same seeding options as the board (Random / Average / Best / Total).

## Seeding options

- **Random** — shuffle.
- **Average** — balance by average points per event.
- **Best** — balance by best result.
- **Total** — balance by total points.

Extras are always seeded last.
