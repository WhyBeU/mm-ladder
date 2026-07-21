"""Canonical scoring helpers.

Lives in the app package so both the running app and the one-off ``migration`` tooling
can share a single source of truth. The app must never depend on ``migration/`` code, so
the mapping is defined here and ``migration`` imports it from this module.
"""

# For a single 3-round draft pod, map final match points to (wins, losses, draws).
# Where points are ambiguous the decomposition prefers wins over draws (e.g. 3 pts is
# recorded as 1W-2L, never 3 draws), matching how historical results were migrated.
# 8 points is impossible in 3-round match play, so it has no entry.
POINTS_TO_WLD: dict[int, tuple[int, int, int]] = {
    9: (3, 0, 0),
    7: (2, 0, 1),
    6: (2, 1, 0),
    5: (1, 0, 2),
    4: (1, 1, 1),
    3: (1, 2, 0),
    2: (0, 1, 2),
    1: (0, 2, 1),
    0: (0, 3, 0),
}


def wld_for_points(points: int) -> tuple[int, int, int]:
    """Return (wins, losses, draws) for a single 3-round tournament result."""
    return POINTS_TO_WLD[points]
