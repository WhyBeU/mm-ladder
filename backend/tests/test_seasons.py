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

    updated = {**_SEASON, "name": "Updated Season", "qualifier_count": 2}
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
