from httpx import AsyncClient

_CUP = {"year": 2024, "name": "2024 Magic Mates Cup", "starts_on": "2024-01-01", "ends_on": "2024-12-31"}


async def test_create_and_get_yearly_cup(client: AsyncClient) -> None:
    resp = await client.post("/yearly-cups/", json=_CUP)
    assert resp.status_code == 201
    data = resp.json()
    assert data["year"] == 2024
    cup_id = data["id"]

    resp = await client.get(f"/yearly-cups/{cup_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "2024 Magic Mates Cup"


async def test_list_yearly_cups(client: AsyncClient) -> None:
    await client.post("/yearly-cups/", json=_CUP)
    resp = await client.get("/yearly-cups/")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_update_yearly_cup(client: AsyncClient) -> None:
    resp = await client.post("/yearly-cups/", json=_CUP)
    cup_id = resp.json()["id"]

    updated = {**_CUP, "name": "Updated Cup"}
    resp = await client.put(f"/yearly-cups/{cup_id}", json=updated)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Cup"


async def test_patch_yearly_cup(client: AsyncClient) -> None:
    resp = await client.post("/yearly-cups/", json=_CUP)
    cup_id = resp.json()["id"]

    resp = await client.patch(f"/yearly-cups/{cup_id}", json={"name": "Patched Cup"})
    assert resp.status_code == 200
    assert resp.json()["name"] == "Patched Cup"


async def test_delete_yearly_cup(client: AsyncClient) -> None:
    resp = await client.post("/yearly-cups/", json=_CUP)
    cup_id = resp.json()["id"]

    resp = await client.delete(f"/yearly-cups/{cup_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/yearly-cups/{cup_id}")
    assert resp.status_code == 404


async def test_get_missing_yearly_cup(client: AsyncClient) -> None:
    resp = await client.get("/yearly-cups/99999")
    assert resp.status_code == 404


async def test_yearly_cup_trophy_fields_default_to_none_or_empty(client: AsyncClient) -> None:
    resp = await client.post("/yearly-cups/", json=_CUP)
    assert resp.status_code == 201
    data = resp.json()
    assert data["player_of_the_year_id"] is None
    assert data["player_of_the_year_name"] is None
    assert data["cup_winner_id"] is None
    assert data["cup_winner_name"] is None
    assert data["qualified_player_ids"] == []


async def test_patch_yearly_cup_trophies(client: AsyncClient) -> None:
    poty_resp = await client.post("/players/", json={"display_name": "Jim Bandas"})
    poty_id = poty_resp.json()["id"]
    winner_resp = await client.post("/players/", json={"display_name": "Alice"})
    winner_id = winner_resp.json()["id"]
    qualifier_resp = await client.post("/players/", json={"display_name": "Bob"})
    qualifier_id = qualifier_resp.json()["id"]

    resp = await client.post("/yearly-cups/", json=_CUP)
    cup_id = resp.json()["id"]

    resp = await client.patch(
        f"/yearly-cups/{cup_id}",
        json={
            "player_of_the_year_id": poty_id,
            "cup_winner_id": winner_id,
            "qualified_player_ids": [qualifier_id, winner_id],
        },
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["player_of_the_year_id"] == poty_id
    assert data["player_of_the_year_name"] == "Jim Bandas"
    assert data["cup_winner_id"] == winner_id
    assert data["cup_winner_name"] == "Alice"
    assert sorted(data["qualified_player_ids"]) == sorted([qualifier_id, winner_id])
