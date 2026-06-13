from httpx import AsyncClient

_SEASON = {"name": "Lorwyn Remastered", "set_code": "LWR", "starts_on": "2024-01-01", "ends_on": "2024-06-30"}


async def test_create_and_get_season(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    assert resp.status_code == 201
    data = resp.json()
    assert data["set_code"] == "LWR"
    season_id = data["id"]

    resp = await client.get(f"/seasons/{season_id}")
    assert resp.status_code == 200
    assert resp.json()["name"] == "Lorwyn Remastered"


async def test_list_seasons(client: AsyncClient) -> None:
    await client.post("/seasons/", json=_SEASON)
    resp = await client.get("/seasons/")
    assert resp.status_code == 200
    assert len(resp.json()) >= 1


async def test_update_season(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    season_id = resp.json()["id"]

    updated = {**_SEASON, "name": "Updated Season", "qualifier_count": 2, "event_count": 12}
    resp = await client.put(f"/seasons/{season_id}", json=updated)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Updated Season"


async def test_patch_season(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    season_id = resp.json()["id"]

    resp = await client.patch(f"/seasons/{season_id}", json={"qualifier_count": 3})
    assert resp.status_code == 200
    assert resp.json()["qualifier_count"] == 3


async def test_delete_season(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    season_id = resp.json()["id"]

    resp = await client.delete(f"/seasons/{season_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/seasons/{season_id}")
    assert resp.status_code == 404


async def test_get_missing_season(client: AsyncClient) -> None:
    resp = await client.get("/seasons/99999")
    assert resp.status_code == 404


async def test_season_includes_event_count(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    assert resp.status_code == 201
    data = resp.json()
    assert "event_count" in data
    assert data["event_count"] == 12  # default


async def test_create_season_with_custom_event_count(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json={**_SEASON, "event_count": 8})
    assert resp.status_code == 201
    assert resp.json()["event_count"] == 8


async def test_patch_season_event_count(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    season_id = resp.json()["id"]
    resp = await client.patch(f"/seasons/{season_id}", json={"event_count": 10})
    assert resp.status_code == 200
    assert resp.json()["event_count"] == 10


async def test_season_includes_comp_avg_n(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json={**_SEASON, "event_count": 12})
    assert resp.status_code == 201
    data = resp.json()
    assert "comp_avg_n" in data
    assert data["comp_avg_n"] == 8  # ceil(12 * 0.66) = 8


async def test_patch_season_champion(client: AsyncClient) -> None:
    player_resp = await client.post("/players/", json={"display_name": "Jim Bandas"})
    player_id = player_resp.json()["id"]

    resp = await client.post("/seasons/", json=_SEASON)
    season_id = resp.json()["id"]

    resp = await client.patch(f"/seasons/{season_id}", json={"champion_player_id": player_id})
    assert resp.status_code == 200
    data = resp.json()
    assert data["champion_player_id"] == player_id
    assert data["champion_name"] == "Jim Bandas"


async def test_season_champion_defaults_to_none(client: AsyncClient) -> None:
    resp = await client.post("/seasons/", json=_SEASON)
    assert resp.status_code == 201
    data = resp.json()
    assert data["champion_player_id"] is None
    assert data["champion_name"] is None


async def test_patch_season_cup_and_qualifying_type(client: AsyncClient) -> None:
    season_id = (await client.post("/seasons/", json=_SEASON)).json()["id"]
    cup_id = (
        await client.post(
            "/yearly-cups/",
            json={"year": 2024, "name": "2024 Cup", "starts_on": "2024-01-01", "ends_on": "2024-12-31"},
        )
    ).json()["id"]

    resp = await client.patch(f"/seasons/{season_id}", json={"yearly_cup_id": cup_id, "qualifying_type": "BEST"})
    assert resp.status_code == 200
    data = resp.json()
    assert data["yearly_cup_id"] == cup_id
    assert data["qualifying_type"] == "BEST"
