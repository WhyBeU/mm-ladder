from httpx import AsyncClient

_SEASON = {"name": "Test Season", "set_code": "TST", "starts_on": "2024-01-01", "ends_on": "2024-12-31"}


async def _make_season(client: AsyncClient) -> int:
    resp = await client.post("/seasons/", json=_SEASON)
    return int(resp.json()["id"])


async def _make_tournament(client: AsyncClient, season_id: int) -> int:
    resp = await client.post("/tournaments/", json={"held_on": "2024-03-04", "season_id": season_id})
    assert resp.status_code == 201
    return int(resp.json()["id"])


async def _make_player(client: AsyncClient, name: str) -> int:
    resp = await client.post("/players/", json={"display_name": name})
    return int(resp.json()["id"])


# ── Tournament CRUD ────────────────────────────────────────────────────────────


async def test_create_and_get_tournament(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    resp = await client.post("/tournaments/", json={"held_on": "2024-03-04", "season_id": season_id})
    assert resp.status_code == 201
    data = resp.json()
    assert data["season_id"] == season_id
    assert data["has_match_detail"] is False

    resp = await client.get(f"/tournaments/{data['id']}")
    assert resp.status_code == 200


async def test_list_tournaments(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    await _make_tournament(client, season_id)
    resp = await client.get("/tournaments/")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_update_tournament(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)

    resp = await client.put(
        f"/tournaments/{tid}", json={"held_on": "2024-04-01", "season_id": season_id, "notes": "Updated"}
    )
    assert resp.status_code == 200
    assert resp.json()["notes"] == "Updated"


async def test_patch_tournament(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)

    resp = await client.patch(f"/tournaments/{tid}", json={"name": "MMM #1"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "MMM #1"


async def test_delete_tournament(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)

    resp = await client.delete(f"/tournaments/{tid}")
    assert resp.status_code == 204

    resp = await client.get(f"/tournaments/{tid}")
    assert resp.status_code == 404


# ── Participants (nested) ──────────────────────────────────────────────────────


async def test_create_and_list_participants(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    pid = await _make_player(client, "Alice")

    resp = await client.post(f"/tournaments/{tid}/participants", json={"player_id": pid, "match_wins": 2})
    assert resp.status_code == 201
    data = resp.json()
    assert data["points"] == 6  # 2 wins × 3
    assert data["tournament_id"] == tid

    resp = await client.get(f"/tournaments/{tid}/participants")
    assert resp.status_code == 200
    assert len(resp.json()) == 1


async def test_update_participant(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    pid = await _make_player(client, "Bob")

    resp = await client.post(f"/tournaments/{tid}/participants", json={"player_id": pid})
    part_id = resp.json()["id"]

    resp = await client.put(
        f"/tournaments/{tid}/participants/{part_id}",
        json={"player_id": pid, "match_wins": 3, "match_losses": 1, "match_draws": 0},
    )
    assert resp.status_code == 200
    assert resp.json()["points"] == 9  # 3 wins × 3


async def test_patch_participant(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    pid = await _make_player(client, "Carol")

    resp = await client.post(f"/tournaments/{tid}/participants", json={"player_id": pid})
    part_id = resp.json()["id"]

    resp = await client.patch(f"/tournaments/{tid}/participants/{part_id}", json={"match_draws": 1})
    assert resp.status_code == 200
    assert resp.json()["points"] == 1  # 1 draw × 1


async def test_delete_participant(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    pid = await _make_player(client, "Dave")

    resp = await client.post(f"/tournaments/{tid}/participants", json={"player_id": pid})
    part_id = resp.json()["id"]

    resp = await client.delete(f"/tournaments/{tid}/participants/{part_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/tournaments/{tid}/participants/{part_id}")
    assert resp.status_code == 404


# ── Matches (nested) ───────────────────────────────────────────────────────────


async def test_create_match_sets_has_match_detail(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    p1 = await _make_player(client, "Eve")
    p2 = await _make_player(client, "Frank")

    assert (await client.get(f"/tournaments/{tid}")).json()["has_match_detail"] is False

    resp = await client.post(
        f"/tournaments/{tid}/matches",
        json={"player_a_id": p1, "player_b_id": p2, "games_a": 2, "games_b": 0},
    )
    assert resp.status_code == 201
    assert resp.json()["outcome"] == "A_WINS"

    assert (await client.get(f"/tournaments/{tid}")).json()["has_match_detail"] is True


async def test_delete_last_match_clears_has_match_detail(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    p1 = await _make_player(client, "Grace")
    p2 = await _make_player(client, "Heidi")

    resp = await client.post(
        f"/tournaments/{tid}/matches",
        json={"player_a_id": p1, "player_b_id": p2, "games_a": 1, "games_b": 1},
    )
    match_id = resp.json()["id"]
    assert (await client.get(f"/tournaments/{tid}")).json()["has_match_detail"] is True

    await client.delete(f"/tournaments/{tid}/matches/{match_id}")
    assert (await client.get(f"/tournaments/{tid}")).json()["has_match_detail"] is False


async def test_get_missing_match(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    resp = await client.get(f"/tournaments/{tid}/matches/99999")
    assert resp.status_code == 404


async def test_reassign_participant_to_another_player(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    p1 = (await client.post("/players/", json={"display_name": "P1"})).json()["id"]
    p2 = (await client.post("/players/", json={"display_name": "P2"})).json()["id"]

    part = await client.post(
        f"/tournaments/{tid}/participants",
        json={"player_id": p1, "match_wins": 2, "match_losses": 1, "match_draws": 0},
    )
    part_id = part.json()["id"]

    resp = await client.patch(f"/tournaments/{tid}/participants/{part_id}", json={"player_id": p2})
    assert resp.status_code == 200
    assert resp.json()["player_id"] == p2


async def test_delete_tournament_removes_participants(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    tid = await _make_tournament(client, season_id)
    pid = (await client.post("/players/", json={"display_name": "Solo"})).json()["id"]
    await client.post(f"/tournaments/{tid}/participants", json={"player_id": pid})

    resp = await client.delete(f"/tournaments/{tid}")
    assert resp.status_code == 204
    assert (await client.get(f"/tournaments/{tid}")).status_code == 404
    assert (await client.get(f"/tournaments/{tid}/participants")).json() == []
