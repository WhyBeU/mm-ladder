# Sign-up board

The tool for splitting players into draft pods. It doesn't touch official
standings.

## Sign-up board (`/sign-up`, **Sign Up** in the nav)

A shared, always-on, public board you can post to Discord each week. Its heading reads
**Monday Draft – (date)**: today if it's Monday, otherwise the coming Monday
(Sydney time), so it rolls to next week's date on Tuesday.

1. Players **claim themselves** from the roster (live-season players first, then
   everyone, with search) or add themselves as a free-text **extra**.
2. On the night, tick who's **present** once they've paid in store (per player, or **Mark all present**).
3. Anyone can **Generate** pods, then set each pod's **Wizards pod code** (with
   **Copy**).
4. **Up to two formats:** add a second format (an existing season or a typed
   "Other…" name). The list splits per format, sign-ups can move between them with
   **▲/▼**, and Generate runs **within each format**.

The board polls every few seconds so sign-ups and pods stay live across devices.
**Clear board** resets it (confirm-guarded).

The old `/board` address and the retired standalone pod-maker (`/pods`) both redirect here.

## Seeding options

- **Random** — shuffle.
- **Average** — balance by average points per event.
- **Best** — balance by best result.
- **Total** — balance by total points.

Extras are always seeded last.
