from httpx import AsyncClient


async def test_create_and_get_player(client: AsyncClient) -> None:
    resp = await client.post("/players/", json={"display_name": "Alice"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["display_name"] == "Alice"
    assert data["is_hidden"] is False
    player_id = data["id"]

    resp = await client.get(f"/players/{player_id}")
    assert resp.status_code == 200
    assert resp.json()["display_name"] == "Alice"


async def test_list_players(client: AsyncClient) -> None:
    await client.post("/players/", json={"display_name": "Bob"})
    await client.post("/players/", json={"display_name": "Carol"})
    resp = await client.get("/players/")
    assert resp.status_code == 200
    names = [p["display_name"] for p in resp.json()]
    assert "Bob" in names
    assert "Carol" in names


async def test_update_player(client: AsyncClient) -> None:
    resp = await client.post("/players/", json={"display_name": "Dave"})
    player_id = resp.json()["id"]

    resp = await client.put(f"/players/{player_id}", json={"display_name": "David", "is_hidden": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "David"
    assert data["is_hidden"] is True


async def test_patch_player(client: AsyncClient) -> None:
    resp = await client.post("/players/", json={"display_name": "Eve"})
    player_id = resp.json()["id"]

    resp = await client.patch(f"/players/{player_id}", json={"is_hidden": True})
    assert resp.status_code == 200
    data = resp.json()
    assert data["display_name"] == "Eve"
    assert data["is_hidden"] is True


async def test_delete_player(client: AsyncClient) -> None:
    resp = await client.post("/players/", json={"display_name": "Frank"})
    player_id = resp.json()["id"]

    resp = await client.delete(f"/players/{player_id}")
    assert resp.status_code == 204

    resp = await client.get(f"/players/{player_id}")
    assert resp.status_code == 404


async def test_get_missing_player(client: AsyncClient) -> None:
    resp = await client.get("/players/99999")
    assert resp.status_code == 404


async def test_create_player_reuses_existing_alias(client: AsyncClient, async_session) -> None:
    from mm_ladder.models.player import Player

    canonical = Player(display_name="Damian Cengarle Barilari", aliases=["Damián Cengarle"])
    async_session.add(canonical)
    await async_session.commit()
    await async_session.refresh(canonical)

    # "Damian Cengarle" normalizes (accent-fold) to the same comparison string
    # as the existing alias "Damián Cengarle" — a strict exact match.
    resp = await client.post("/players/", json={"display_name": "Damian Cengarle"})
    assert resp.status_code == 201
    data = resp.json()
    assert data["id"] == canonical.id
    assert data["display_name"] == "Damian Cengarle Barilari"


async def test_get_player_includes_trophy_lists(client: AsyncClient) -> None:
    resp = await client.post("/players/", json={"display_name": "Jim Bandas"})
    player_id = resp.json()["id"]
    data = resp.json()
    assert data["season_champion_set_codes"] == []
    assert data["player_of_the_year_cup_names"] == []
    assert data["cup_champion_cup_names"] == []

    season_resp = await client.post(
        "/seasons/",
        json={"name": "Core Set 2021", "set_code": "M21", "starts_on": "2020-06-26", "ends_on": "2020-09-18"},
    )
    season_id = season_resp.json()["id"]
    await client.patch(f"/seasons/{season_id}", json={"champion_player_id": player_id})

    cup_resp = await client.post(
        "/yearly-cups/",
        json={"year": 2024, "name": "2024 Magic Mates Cup", "starts_on": "2024-01-01", "ends_on": "2024-12-31"},
    )
    cup_id = cup_resp.json()["id"]
    await client.patch(
        f"/yearly-cups/{cup_id}",
        json={"player_of_the_year_id": player_id, "cup_winner_id": player_id},
    )

    resp = await client.get(f"/players/{player_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["season_champion_set_codes"] == ["M21"]
    assert data["player_of_the_year_cup_names"] == ["2024 Magic Mates Cup"]
    assert data["cup_champion_cup_names"] == ["2024 Magic Mates Cup"]
