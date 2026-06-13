from httpx import AsyncClient

from mm_ladder.services.audit import diff_fields


def test_diff_fields_reports_only_changed() -> None:
    changes = diff_fields({"name": "A", "hidden": False}, {"name": "B", "hidden": False})
    assert changes == [{"field": "name", "old": "A", "new": "B"}]


async def test_player_create_update_delete_are_audited(client: AsyncClient) -> None:
    pid = (await client.post("/players/", json={"display_name": "Auditee"})).json()["id"]
    await client.patch(f"/players/{pid}", json={"display_name": "Auditee2"})
    await client.delete(f"/players/{pid}")

    rows = (await client.get("/admin/audit", params={"entity_type": "player"})).json()["items"]
    actions = [r["action"] for r in rows]
    assert actions == ["DELETE", "UPDATE", "CREATE"]  # newest first
    update = next(r for r in rows if r["action"] == "UPDATE")
    assert {"field": "display_name", "old": "Auditee", "new": "Auditee2"} in update["changes"]


async def test_noop_patch_writes_no_audit(client: AsyncClient) -> None:
    pid = (await client.post("/players/", json={"display_name": "Stable"})).json()["id"]
    await client.patch(f"/players/{pid}", json={})
    rows = (await client.get("/admin/audit", params={"entity_type": "player", "action": "UPDATE"})).json()["items"]
    assert all(r["entity_id"] != pid for r in rows)


async def test_audit_requires_token(noauth_client: AsyncClient) -> None:
    assert (await noauth_client.get("/admin/audit")).status_code == 401


async def test_audit_pagination(client: AsyncClient) -> None:
    for i in range(3):
        await client.post("/players/", json={"display_name": f"Pg{i}"})
    page = (await client.get("/admin/audit", params={"action": "CREATE", "limit": 2, "offset": 0})).json()
    assert page["total"] >= 3
    assert len(page["items"]) == 2


async def test_tournament_delete_is_audited(client: AsyncClient) -> None:
    season = await client.post(
        "/seasons/", json={"name": "S", "set_code": "AAA", "starts_on": "2025-01-01", "ends_on": "2025-03-01"}
    )
    tid = (await client.post("/tournaments/", json={"held_on": "2025-01-05", "season_id": season.json()["id"]})).json()[
        "id"
    ]
    await client.delete(f"/tournaments/{tid}")

    rows = (await client.get("/admin/audit", params={"entity_type": "tournament", "action": "DELETE"})).json()["items"]
    assert any(r["entity_id"] == tid for r in rows)


async def test_cup_award_change_is_audited(client: AsyncClient) -> None:
    pid = (await client.post("/players/", json={"display_name": "Winner"})).json()["id"]
    cup = await client.post(
        "/yearly-cups/", json={"year": 2030, "name": "2030 Cup", "starts_on": "2030-01-01", "ends_on": "2030-12-31"}
    )
    cid = cup.json()["id"]
    await client.patch(f"/yearly-cups/{cid}", json={"cup_winner_id": pid})

    rows = (await client.get("/admin/audit", params={"entity_type": "yearly_cup", "action": "UPDATE"})).json()["items"]
    update = next(r for r in rows if r["entity_id"] == cid)
    assert {"field": "cup_winner_id", "old": None, "new": pid} in update["changes"]
