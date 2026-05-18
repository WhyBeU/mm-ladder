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


def test_filter_single_tournament_players() -> None:
    from migration.scraper import filter_single_tournament_players

    players = [
        {"Firstname": "A", "NbTournaments": 1, "TotalMatchPoints": 9},
        {"Firstname": "B", "NbTournaments": 3, "TotalMatchPoints": 18},
    ]
    result = filter_single_tournament_players(players)
    assert len(result) == 1
    assert result[0]["Firstname"] == "A"
