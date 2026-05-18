from datetime import date


def test_points_to_wld_covers_all_values() -> None:
    from migration.seasons import POINTS_TO_WLD

    for pts in [0, 1, 2, 3, 4, 5, 6, 7, 9]:  # 8 is impossible in 3-round match play
        assert pts in POINTS_TO_WLD, f"Missing mapping for {pts} points"


def test_points_to_wld_values_sum_to_three_rounds() -> None:
    from migration.seasons import POINTS_TO_WLD

    for pts, (w, losses, d) in POINTS_TO_WLD.items():
        assert w + losses + d == 3, f"{pts} pts: {w}W-{losses}L-{d}D does not sum to 3 rounds"
        assert w * 3 + d == pts, f"{pts} pts: {w}W-{losses}L-{d}D gives wrong points"


def test_seasons_have_unique_set_codes() -> None:
    from migration.seasons import SEASONS

    codes = [s["set_code"] for s in SEASONS]
    assert len(codes) == len(set(codes)), "Duplicate set_codes found"


def test_seasons_have_unique_ids() -> None:
    from migration.seasons import SEASONS

    ids = [s["id"] for s in SEASONS]
    assert len(ids) == len(set(ids)), "Duplicate season IDs found"


def test_get_mondays_returns_only_mondays() -> None:
    from migration.seasons import get_mondays

    mondays = get_mondays(date(2025, 4, 4), date(2025, 6, 5))
    assert all(d.weekday() == 0 for d in mondays)


def test_get_mondays_within_range() -> None:
    from migration.seasons import get_mondays

    mondays = get_mondays(date(2025, 4, 4), date(2025, 6, 5))
    assert all(date(2025, 4, 4) <= d <= date(2025, 6, 5) for d in mondays)
    assert date(2025, 4, 7) in mondays
    assert date(2025, 6, 2) in mondays


def test_get_mondays_tarkir_dragonstorm() -> None:
    from migration.seasons import get_mondays

    mondays = get_mondays(date(2025, 4, 4), date(2025, 6, 5))
    assert len(mondays) == 9
