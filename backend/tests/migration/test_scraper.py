SAMPLE_HTML = """
<script type="text/javascript">
    var razor = {};
    razor.players = [{
        "Firstname": "Alice",
        "Lastname": "Smith",
        "NbTournaments": 1,
        "NthBest": 0,
        "TotalMatchPoints": 9,
        "AveragePointsByTournament": 9.0,
        "Trophies": []
    }, {
        "Firstname": "Bob",
        "Lastname": "Jones",
        "NbTournaments": 1,
        "NthBest": 0,
        "TotalMatchPoints": 6,
        "AveragePointsByTournament": 6.0,
        "Trophies": []
    }];
    razor.month = new Date('2025/04/01');
</script>
"""

EMPTY_HTML = """
<script type="text/javascript">
    var razor = {};
    razor.players = [];
    razor.month = new Date('2025/04/01');
</script>
"""


def test_parse_players_from_html_returns_players() -> None:
    from migration.scraper import parse_players_from_html

    players = parse_players_from_html(SAMPLE_HTML)
    assert len(players) == 2
    assert players[0]["Firstname"] == "Alice"
    assert players[0]["TotalMatchPoints"] == 9
    assert players[0]["NbTournaments"] == 1


def test_parse_players_from_html_empty_returns_empty_list() -> None:
    from migration.scraper import parse_players_from_html

    players = parse_players_from_html(EMPTY_HTML)
    assert players == []


def test_parse_players_from_html_missing_block_returns_none() -> None:
    from migration.scraper import parse_players_from_html

    result = parse_players_from_html("<html>no data here</html>")
    assert result is None


def _make_summary(**kwargs):  # type: ignore[return]
    from migration.scraper import ScrapeSummary

    defaults = dict(
        set_code="tst",
        name="Test",
        total_mondays=5,
        events_on_disk=3,
        newly_saved=3,
        skipped_existing=0,
        empty_dates=[],
        future_count=0,
    )
    return ScrapeSummary(**(defaults | kwargs))


def test_scrape_summary_consecutive_gaps() -> None:
    from datetime import date

    s = _make_summary(empty_dates=[date(2024, 1, 8), date(2024, 1, 15), date(2024, 2, 5)])
    gaps = s.consecutive_gaps
    assert len(gaps) == 1
    assert len(gaps[0]) == 2  # Jan 8 and Jan 15 are consecutive; Feb 5 is isolated


def test_scrape_summary_no_gaps_when_isolated_empties() -> None:
    from datetime import date

    s = _make_summary(empty_dates=[date(2024, 1, 8), date(2024, 1, 22)])
    assert s.consecutive_gaps == []  # two weeks apart, not consecutive


def test_monday_result_multi_event_flag() -> None:
    from datetime import date

    from migration.scraper import MondayResult

    r = MondayResult(attendees=[{"Firstname": "Alice"}], multi_event=True, actual_date=date(2024, 10, 21))
    assert r.multi_event is True
    assert len(r.attendees) == 1
    assert r.actual_date == date(2024, 10, 21)


def test_normalize_attendees_single_included_as_is() -> None:
    from migration.scraper import normalize_attendees

    players = [{"Firstname": "A", "NbTournaments": 1, "TotalMatchPoints": 9}]
    attendees, multi = normalize_attendees(players)
    assert len(attendees) == 1
    assert attendees[0]["TotalMatchPoints"] == 9
    assert multi is False


def test_normalize_attendees_double_entry_halves_points() -> None:
    from migration.scraper import normalize_attendees

    players = [{"Firstname": "B", "NbTournaments": 2, "TotalMatchPoints": 13}]
    attendees, multi = normalize_attendees(players)
    assert len(attendees) == 1
    assert attendees[0]["TotalMatchPoints"] == 6  # floor(13/2)
    assert multi is False


def test_normalize_attendees_nbt_over_2_flagged_and_excluded() -> None:
    from migration.scraper import normalize_attendees

    players = [
        {"Firstname": "A", "NbTournaments": 1, "TotalMatchPoints": 9},
        {"Firstname": "B", "NbTournaments": 3, "TotalMatchPoints": 18},
    ]
    attendees, multi = normalize_attendees(players)
    assert len(attendees) == 1
    assert attendees[0]["Firstname"] == "A"
    assert multi is True
