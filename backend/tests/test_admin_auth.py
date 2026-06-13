from httpx import AsyncClient


async def test_admin_check_ok_with_token(client: AsyncClient) -> None:
    resp = await client.get("/admin/check")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


async def test_admin_check_rejects_missing_token(noauth_client: AsyncClient) -> None:
    resp = await noauth_client.get("/admin/check")
    assert resp.status_code == 401


async def test_admin_check_rejects_wrong_token(noauth_client: AsyncClient) -> None:
    resp = await noauth_client.get("/admin/check", headers={"X-Admin-Token": "nope"})
    assert resp.status_code == 401


async def test_write_route_requires_token(noauth_client: AsyncClient) -> None:
    resp = await noauth_client.post("/players/", json={"display_name": "Zed"})
    assert resp.status_code == 401
