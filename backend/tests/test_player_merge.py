from httpx import AsyncClient


async def _mk_player(client: AsyncClient, name: str) -> int:
    return (await client.post("/players/", json={"display_name": name})).json()["id"]


async def _mk_tournament(client: AsyncClient) -> int:
    season = await client.post(
        "/seasons/",
        json={"name": "S", "set_code": "AAA", "starts_on": "2025-01-01", "ends_on": "2025-03-01"},
    )
    return (
        await client.post("/tournaments/", json={"held_on": "2025-01-05", "season_id": season.json()["id"]})
    ).json()["id"]


async def test_merge_reassigns_participations_and_folds_aliases(client: AsyncClient) -> None:
    keep = await _mk_player(client, "Alice Smith")
    dup = await _mk_player(client, "Alice S")
    t1 = await _mk_tournament(client)
    await client.post(f"/tournaments/{t1}/participants", json={"player_id": dup, "match_wins": 3})

    resp = await client.post("/players/merge", json={"keep_id": keep, "duplicate_ids": [dup]})
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == keep
    assert "Alice S" in body["aliases"]

    # dup is gone
    assert (await client.get(f"/players/{dup}")).status_code == 404
    # participation now belongs to keep
    parts = (await client.get(f"/tournaments/{t1}/participants")).json()
    assert [p["player_id"] for p in parts] == [keep]


async def test_merge_rejects_keep_in_duplicates(client: AsyncClient) -> None:
    keep = await _mk_player(client, "Bob")
    resp = await client.post("/players/merge", json={"keep_id": keep, "duplicate_ids": [keep]})
    assert resp.status_code == 409


async def test_merge_rejects_shared_tournament_conflict(client: AsyncClient) -> None:
    keep = await _mk_player(client, "Cara One")
    dup = await _mk_player(client, "Cara Two")
    t1 = await _mk_tournament(client)
    await client.post(f"/tournaments/{t1}/participants", json={"player_id": keep})
    await client.post(f"/tournaments/{t1}/participants", json={"player_id": dup})

    resp = await client.post("/players/merge", json={"keep_id": keep, "duplicate_ids": [dup]})
    assert resp.status_code == 409
