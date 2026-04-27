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
