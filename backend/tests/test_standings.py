from httpx import AsyncClient

_SEASON = {"name": "Test Season", "set_code": "TST", "starts_on": "2026-01-01", "ends_on": "2026-06-30"}


async def _make_season(client: AsyncClient, event_count: int = 3) -> int:
    resp = await client.post("/seasons/", json={**_SEASON, "event_count": event_count})
    assert resp.status_code == 201
    return int(resp.json()["id"])


async def _make_tournament(client: AsyncClient, season_id: int, held_on: str) -> int:
    resp = await client.post("/tournaments/", json={"held_on": held_on, "season_id": season_id})
    assert resp.status_code == 201
    return int(resp.json()["id"])


async def _make_player(client: AsyncClient, name: str) -> int:
    resp = await client.post("/players/", json={"display_name": name})
    assert resp.status_code == 201
    return int(resp.json()["id"])


async def _add_participant(
    client: AsyncClient, tournament_id: int, player_id: int, wins: int, losses: int, draws: int
) -> None:
    resp = await client.post(
        f"/tournaments/{tournament_id}/participants",
        json={"player_id": player_id, "match_wins": wins, "match_losses": losses, "match_draws": draws},
    )
    assert resp.status_code == 201


async def test_standings_empty_season(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    resp = await client.get(f"/seasons/{season_id}/standings")
    assert resp.status_code == 200
    assert resp.json() == []


async def test_standings_missing_season_returns_404(client: AsyncClient) -> None:
    resp = await client.get("/seasons/99999/standings")
    assert resp.status_code == 404


async def test_standings_basic_order(client: AsyncClient) -> None:
    season_id = await _make_season(client, event_count=2)
    player_a = await _make_player(client, "Alice")
    player_b = await _make_player(client, "Bob")
    t1 = await _make_tournament(client, season_id, "2026-02-01")
    t2 = await _make_tournament(client, season_id, "2026-03-01")

    # Alice: 9pts (t1) + 6pts (t2) = 15; Bob: 6pts (t1) + 3pts (t2) = 9
    await _add_participant(client, t1, player_a, wins=3, losses=0, draws=0)
    await _add_participant(client, t1, player_b, wins=2, losses=1, draws=0)
    await _add_participant(client, t2, player_a, wins=2, losses=1, draws=0)
    await _add_participant(client, t2, player_b, wins=1, losses=2, draws=0)

    resp = await client.get(f"/seasons/{season_id}/standings")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 2

    # comp_avg_n = ceil(2 * 0.66) = 2
    assert data[0]["display_name"] == "Alice"
    assert data[0]["rank"] == 1
    assert data[0]["points"] == 15
    assert data[0]["trophies"] == 1
    assert data[0]["comp_avg_n"] == 2
    assert abs(data[0]["comp_avg"] - 7.5) < 0.01

    assert data[1]["display_name"] == "Bob"
    assert data[1]["rank"] == 2
    assert data[1]["points"] == 9
    assert data[1]["trophies"] == 0
    assert abs(data[1]["comp_avg"] - 4.5) < 0.01


async def test_standings_per_event_scores_has_nulls_for_missed(client: AsyncClient) -> None:
    season_id = await _make_season(client, event_count=2)
    player_a = await _make_player(client, "Alice")
    t1 = await _make_tournament(client, season_id, "2026-02-01")
    await _make_tournament(client, season_id, "2026-03-01")  # t2 — Alice misses this

    await _add_participant(client, t1, player_a, wins=3, losses=0, draws=0)

    resp = await client.get(f"/seasons/{season_id}/standings")
    data = resp.json()
    assert len(data) == 1
    assert data[0]["per_event_scores"] == [9, None]


async def test_standings_comp_avg_none_if_no_games(client: AsyncClient) -> None:
    season_id = await _make_season(client, event_count=2)
    player_a = await _make_player(client, "Alice")
    t1 = await _make_tournament(client, season_id, "2026-02-01")
    await _add_participant(client, t1, player_a, wins=0, losses=3, draws=0)

    resp = await client.get(f"/seasons/{season_id}/standings")
    data = resp.json()
    # 0 points is still a score, so comp_avg is not None
    assert data[0]["comp_avg"] is not None
    assert data[0]["comp_avg"] == 0.0


async def test_standings_trophies_counted_correctly(client: AsyncClient) -> None:
    season_id = await _make_season(client, event_count=3)
    player_a = await _make_player(client, "Alice")
    t1 = await _make_tournament(client, season_id, "2026-02-01")
    t2 = await _make_tournament(client, season_id, "2026-03-01")
    t3 = await _make_tournament(client, season_id, "2026-04-01")

    # Alice: 9pts (t1), 6pts (t2), 9pts (t3) → 2 trophies
    await _add_participant(client, t1, player_a, wins=3, losses=0, draws=0)
    await _add_participant(client, t2, player_a, wins=2, losses=1, draws=0)
    await _add_participant(client, t3, player_a, wins=3, losses=0, draws=0)

    resp = await client.get(f"/seasons/{season_id}/standings")
    data = resp.json()
    assert data[0]["trophies"] == 2


async def test_standings_include_awards(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    player_id = await _make_player(client, "Champ")
    tid = await _make_tournament(client, season_id, "2026-02-01")
    await _add_participant(client, tid, player_id, wins=3, losses=0, draws=0)

    await client.patch(f"/seasons/{season_id}", json={"champion_player_id": player_id})
    cup = await client.post(
        "/yearly-cups/",
        json={"year": 2025, "name": "2025 Cup", "starts_on": "2025-01-01", "ends_on": "2025-12-31"},
    )
    cup_id = cup.json()["id"]
    await client.patch(f"/yearly-cups/{cup_id}", json={"player_of_the_year_id": player_id, "cup_winner_id": player_id})

    resp = await client.get(f"/seasons/{season_id}/standings")
    assert resp.status_code == 200
    row = next(r for r in resp.json() if r["player_id"] == player_id)
    assert row["season_championships"] == [{"set_code": "TST", "season_name": "Test Season"}]
    assert row["player_of_the_year_years"] == [2025]
    assert row["cup_champion_years"] == [2025]
