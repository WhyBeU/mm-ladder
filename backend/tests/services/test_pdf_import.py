from datetime import date
from pathlib import Path

import pytest

from mm_ladder.errors import BadRequestError
from mm_ladder.services import pdf_import
from mm_ladder.services.pdf_import import (
    compose_event_name,
    parse_standings_pdf,
    parse_standings_text,
    tidy_name,
)

FIXTURES = Path(__file__).parent.parent / "fixtures"


def _read(name: str) -> bytes:
    return (FIXTURES / name).read_bytes()


# ── Real PDF fixtures ────────────────────────────────────────────────────────


def test_parse_pod1_clean() -> None:
    parsed = parse_standings_pdf(_read("eventlink_pod1.pdf"))
    assert parsed.eventlink_id == "11289050"
    assert parsed.pod_number == 1
    assert parsed.held_on == date(2026, 7, 20)
    assert parsed.rounds == 3
    assert parsed.venue == "Draft at Chromatic games"
    assert [(r.rank, r.raw_name, r.points) for r in parsed.rows] == [
        (1, "Damon Merry ☠", 9),
        (2, "Alex Kwong", 6),
        (3, "Charlie Boyd", 6),
        (4, "Kon Kabilafkas", 3),
        (5, "Sammy Madafiglio", 3),
        (6, "Chris North", 0),
    ]


def test_parse_pod2_with_draws() -> None:
    parsed = parse_standings_pdf(_read("eventlink_pod2.pdf"))
    assert parsed.eventlink_id == "11211407"
    assert parsed.pod_number == 2
    assert parsed.venue == "Draft at Chromatic"
    names = {r.raw_name: r.points for r in parsed.rows}
    assert names["Dylan Tevardy-O'Neil"] == 3
    assert names["Yurk-Wei Xu"] == 4  # a draw-carrying score
    assert names["Sebastian Restrepo"] == 1


def test_parse_pod3_us_locale_dates() -> None:
    parsed = parse_standings_pdf(_read("eventlink_pod3.pdf"))
    assert parsed.eventlink_id == "11289053"
    assert parsed.pod_number == 1
    assert parsed.held_on == date(2026, 8, 10)
    assert parsed.rounds == 3
    assert parsed.venue == "Draft at Chromatic games"
    assert len(parsed.rows) == 11
    assert (parsed.rows[0].rank, parsed.rows[0].raw_name, parsed.rows[0].points) == (1, "Alex Kwong", 9)
    assert (parsed.rows[-1].rank, parsed.rows[-1].raw_name, parsed.rows[-1].points) == (11, "Matt Sellas", 0)


# ── Text-level parsing & reject paths ────────────────────────────────────────

_HEADER = (
    "EventLink 20/07/2026, 22:01Report: Standings by Rank"
    "Event: Draft Pod 1 (11289050)Event Date: 20/07/2026"
    "Event Information: Draft at Chromatic games "
    "Opponents Match Win Percent : OMW% "
    "Rank Name Pod Points OMW% GW% OGW% "
    "-------------------------------------------------- "
)
_FOOTER = " EventLink - Copyright © 2026 - Wizards of the Coast LLC "


def _doc(rows: str, rounds: str = "Round 3 Standings by Rank") -> str:
    return _HEADER + rows + _FOOTER + "20/07/2026, 22:01 " + rounds


def test_parse_text_happy() -> None:
    parsed = parse_standings_text(_doc("1 Alice 1 9 44 75 46 2 Bob 1 6 66 62 55 "))
    assert parsed.pod_number == 1
    assert [(r.raw_name, r.points) for r in parsed.rows] == [("Alice", 9), ("Bob", 6)]


def test_reject_non_three_rounds() -> None:
    text = _doc("1 Alice 1 9 44 75 46 ", rounds="Round 4 Standings by Rank")
    with pytest.raises(BadRequestError, match="4 rounds"):
        parse_standings_text(text)


def test_reject_no_event_header() -> None:
    with pytest.raises(BadRequestError, match="Not an EventLink"):
        parse_standings_text("just some random text with Round 3 Standings by Rank")


def test_reject_impossible_points() -> None:
    # 8 points is impossible in a 3-round pod.
    with pytest.raises(BadRequestError, match="impossible"):
        parse_standings_text(_doc("1 Alice 1 8 44 75 46 "))


def _dated_doc(stamp: str, event_date: str) -> str:
    """A minimal one-row report with a chosen print timestamp and event date."""
    return (
        f"EventLink {stamp}Report: Standings by Rank"
        f"Event: Draft Pod 1 (11289050)Event Date: {event_date}"
        "Event Information: Draft at Chromatic games "
        "Opponents Match Win Percent : OMW% "
        "Rank Name Pod Points OMW% GW% OGW% "
        "-------------------------------------------------- "
        "1 Alice 1 9 44 75 46 " + _FOOTER + f"{stamp} Round 3 Standings by Rank"
    )


def _freeze_today(monkeypatch: pytest.MonkeyPatch, today: date) -> None:
    """Pin "now" — the last-resort ordering rule reads the clock, so every case must fix it."""
    monkeypatch.setattr(pdf_import, "_today", lambda: today)


@pytest.mark.parametrize(
    ("stamp", "event_date", "today", "expected"),
    [
        # The print timestamp's own digits pin the ordering.
        ("8/13/2026, 4:08 PM", "8/10/2026", date(2026, 8, 13), date(2026, 8, 10)),
        ("20/07/2026, 22:01", "08/10/2026", date(2026, 10, 9), date(2026, 10, 8)),
        # Nothing over 12 anywhere: a 12-hour clock is the US-locale tell, and it outranks
        # proximity — today would otherwise argue for 3 April.
        ("5/6/2026, 4:08 PM", "3/4/2026", date(2026, 4, 4), date(2026, 3, 4)),
        # Same date on a 24-hour clock: nothing pins it, so the nearer reading wins.
        ("5/6/2026, 22:01", "3/4/2026", date(2026, 4, 4), date(2026, 4, 3)),
        # The event date's own digits outrank every other signal.
        ("5/6/2026, 4:08 PM", "13/4/2026", date(2026, 4, 14), date(2026, 4, 13)),
    ],
)
def test_event_date_ordering(
    monkeypatch: pytest.MonkeyPatch, stamp: str, event_date: str, today: date, expected: date
) -> None:
    _freeze_today(monkeypatch, today)
    assert parse_standings_text(_dated_doc(stamp, event_date)).held_on == expected


@pytest.mark.parametrize(
    ("today", "expected"),
    [
        (date(2026, 2, 10), date(2026, 2, 1)),  # 1 Feb is 9 days back, 2 Jan is 39
        (date(2026, 1, 5), date(2026, 1, 2)),  # 2 Jan is 3 days back, 1 Feb is 27 ahead
        (date(2026, 1, 17), date(2026, 2, 1)),  # exact tie, 15 days either way — day-first wins
    ],
)
def test_ambiguous_event_date_takes_the_reading_closest_to_today(
    monkeypatch: pytest.MonkeyPatch, today: date, expected: date
) -> None:
    # 01/02/2026 is a valid 1 February and a valid 2 January, and the 24-hour print stamp
    # ("5/6/2026") says nothing either way.
    _freeze_today(monkeypatch, today)
    assert parse_standings_text(_dated_doc("5/6/2026, 22:01", "01/02/2026")).held_on == expected


def test_reject_missing_event_date() -> None:
    text = _dated_doc("20/07/2026, 22:01", "20/07/2026").replace("Event Date: 20/07/2026", "")
    with pytest.raises(BadRequestError, match="Could not find the event date"):
        parse_standings_text(text)


def test_reject_impossible_event_date() -> None:
    with pytest.raises(BadRequestError, match="Invalid event date"):
        parse_standings_text(_dated_doc("20/07/2026, 22:01", "13/13/2026"))


def test_reject_unreadable_pdf() -> None:
    with pytest.raises(BadRequestError, match="Could not read the PDF"):
        parse_standings_pdf(b"%PDF-1.4 not really a pdf")


# ── Small helpers ────────────────────────────────────────────────────────────


def test_tidy_name_keeps_emoji_and_punctuation() -> None:
    assert tidy_name("Damon Merry ☠ ") == "Damon Merry ☠"
    assert tidy_name("Dylan Tevardy-O'Neil\xa0\xa0") == "Dylan Tevardy-O'Neil"


def test_compose_event_name() -> None:
    assert compose_event_name("Secrets of Strixhaven", date(2026, 7, 20), 1) == (
        "Secrets of Strixhaven - 20 Jul 2026 - Pod 1"
    )
    assert compose_event_name(None, date(2026, 7, 20), 2) == "20 Jul 2026 - Pod 2"
