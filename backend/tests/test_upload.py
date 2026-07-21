from pathlib import Path

from httpx import AsyncClient

FIXTURES = Path(__file__).parent / "fixtures"
PREVIEW_URL = "/upload/tournament-results-from-pdf/preview"
COMMIT_URL = "/upload/tournament-results-from-pdf"

_SEASON = {"name": "Secrets of Strixhaven", "set_code": "sos", "starts_on": "2026-01-01", "ends_on": "2026-12-31"}


def _pod(name: str) -> dict[str, object]:
    return {"file": (name, (FIXTURES / name).read_bytes(), "application/pdf")}


async def _make_season(client: AsyncClient) -> int:
    resp = await client.post("/seasons/", json=_SEASON)
    return int(resp.json()["id"])


async def _make_player(client: AsyncClient, name: str) -> int:
    resp = await client.post("/players/", json={"display_name": name})
    return int(resp.json()["id"])


# ── Preview ──────────────────────────────────────────────────────────────────


async def test_preview_parses_and_suggests_season(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    resp = await client.post(PREVIEW_URL, files=_pod("eventlink_pod1.pdf"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["eventlink_id"] == "11289050"
    assert body["pod_number"] == 1
    assert body["held_on"] == "2026-07-20"
    assert body["suggested_season_id"] == season_id
    assert body["suggested_name"] == "Secrets of Strixhaven - 20 Jul 2026 - Pod 1"
    assert body["already_imported_tournament_id"] is None
    assert len(body["participants"]) == 6
    top = body["participants"][0]
    assert top["points"] == 9 and (top["wins"], top["losses"], top["draws"]) == (3, 0, 0)
    assert top["will_create"] is True  # no players exist yet


async def test_preview_matches_existing_player(client: AsyncClient) -> None:
    await _make_season(client)
    pid = await _make_player(client, "Damon Merry")  # matches "Damon Merry ☠" after folding
    resp = await client.post(PREVIEW_URL, files=_pod("eventlink_pod1.pdf"))
    top = resp.json()["participants"][0]
    assert top["player_id"] == pid
    assert top["will_create"] is False


async def test_preview_requires_admin(noauth_client: AsyncClient) -> None:
    resp = await noauth_client.post(PREVIEW_URL, files=_pod("eventlink_pod1.pdf"))
    assert resp.status_code == 401


# ── Commit ───────────────────────────────────────────────────────────────────


async def _commit_from_preview(client: AsyncClient, season_id: int, pod: str) -> dict[str, object]:
    preview = (await client.post(PREVIEW_URL, files=_pod(pod))).json()
    payload = {
        "eventlink_id": preview["eventlink_id"],
        "held_on": preview["held_on"],
        "season_id": season_id,
        "name": preview["suggested_name"],
        "venue": preview["venue"],
        "participants": [
            {
                "player_id": p["player_id"],
                "create_name": None if p["player_id"] else p["normalized_name"],
                "wins": p["wins"],
                "losses": p["losses"],
                "draws": p["draws"],
            }
            for p in preview["participants"]
        ],
    }
    return payload


async def test_commit_creates_tournament_and_players(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    payload = await _commit_from_preview(client, season_id, "eventlink_pod1.pdf")
    resp = await client.post(COMMIT_URL, json=payload)
    assert resp.status_code == 201
    result = resp.json()
    assert result["participant_count"] == 6
    assert len(result["created_player_ids"]) == 6

    # Tournament persisted with the EventLink id, venue note, and no match detail
    tour = (await client.get(f"/tournaments/{result['tournament_id']}")).json()
    assert tour["eventlink_id"] == "11289050"
    assert tour["notes"] == "Draft at Chromatic games"
    assert tour["has_match_detail"] is False

    # Computed points came through from the inferred W-L-D
    parts = await client.get(f"/tournaments/{result['tournament_id']}/participants")
    points = sorted(p["points"] for p in parts.json())
    assert points == [0, 3, 3, 6, 6, 9]

    # Audit log carries an IMPORT entry
    audit = await client.get("/admin/audit", params={"action": "IMPORT"})
    assert audit.json()["total"] == 1


async def test_commit_blocks_duplicate_eventlink(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    payload = await _commit_from_preview(client, season_id, "eventlink_pod1.pdf")
    first = await client.post(COMMIT_URL, json=payload)
    tid = first.json()["tournament_id"]

    # A second preview now reports it as already imported…
    preview = (await client.post(PREVIEW_URL, files=_pod("eventlink_pod1.pdf"))).json()
    assert preview["already_imported_tournament_id"] == tid

    # …and a re-commit is blocked with 409.
    resp = await client.post(COMMIT_URL, json=payload)
    assert resp.status_code == 409
    assert str(tid) in resp.json()["detail"]


async def test_commit_rejects_bad_record_sum(client: AsyncClient) -> None:
    season_id = await _make_season(client)
    payload = await _commit_from_preview(client, season_id, "eventlink_pod1.pdf")
    payload["participants"][0]["wins"] = 2  # 2+0+0 != 3
    resp = await client.post(COMMIT_URL, json=payload)
    assert resp.status_code == 422
