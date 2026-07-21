from datetime import date
from pathlib import Path

import pytest

from mm_ladder.errors import BadRequestError
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
