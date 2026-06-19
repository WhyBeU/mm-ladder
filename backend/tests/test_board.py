from datetime import UTC, datetime, timedelta

from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.interface.board import FormatGenerateGroup, GenerateRequest, SignupCreateRequest
from mm_ladder.schemas.board import (
    PodEventRead,
    PodFormatRead,
    PodPodRead,
    PodRegistrationStateRead,
    PodSignupRead,
)
from mm_ladder.services.board import AUTO_CLEAR_AFTER, BoardService


async def _default_format_id(client: AsyncClient) -> int:
    return (await client.get("/board")).json()["formats"][0]["id"]


def _gen_body(format_id: int, pods: list[list[int]], label: str | None = None) -> dict:
    return {"formats": [{"format_id": format_id, "seeding_label": label, "pods": pods}]}


async def _add_player(client: AsyncClient, name: str) -> int:
    resp = await client.post("/players/", json={"display_name": name})
    assert resp.status_code == 201
    return resp.json()["id"]


async def _signups(client: AsyncClient) -> list[dict]:
    resp = await client.get("/board")
    assert resp.status_code == 200
    return resp.json()["signups"]


# ── GET / public access ───────────────────────────────────────────────────────


async def test_get_empty_board(client: AsyncClient) -> None:
    resp = await client.get("/board")
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"]["status"] == "open"
    assert body["signups"] == []
    assert body["pods"] == []
    assert body["events"] == []
    # The default (active-season) format is auto-created; tests have no seasons -> "Draft".
    assert len(body["formats"]) == 1
    assert body["formats"][0]["ordinal"] == 1
    assert body["formats"][0]["season_id"] is None


async def test_board_is_public(noauth_client: AsyncClient) -> None:
    resp = await noauth_client.get("/board")
    assert resp.status_code == 200
    resp = await noauth_client.post("/board/signups", json={"display_name": "Walk-in"})
    assert resp.status_code == 200
    assert any(s["display_name"] == "Walk-in" for s in resp.json()["signups"])


# ── signups ─────────────────────────────────────────────────────────────────


async def test_add_roster_signup(client: AsyncClient) -> None:
    pid = await _add_player(client, "Alice")
    resp = await client.post("/board/signups", json={"player_id": pid})
    assert resp.status_code == 200
    signups = resp.json()["signups"]
    assert len(signups) == 1
    assert signups[0]["player_id"] == pid
    assert signups[0]["display_name"] == "Alice"
    assert signups[0]["is_extra"] is False
    assert signups[0]["present"] is False


async def test_add_extra_signup(client: AsyncClient) -> None:
    resp = await client.post("/board/signups", json={"display_name": "Guest"})
    assert resp.status_code == 200
    signup = resp.json()["signups"][0]
    assert signup["player_id"] is None
    assert signup["display_name"] == "Guest"
    assert signup["is_extra"] is True


async def test_duplicate_roster_claim_conflicts(client: AsyncClient) -> None:
    pid = await _add_player(client, "Alice")
    assert (await client.post("/board/signups", json={"player_id": pid})).status_code == 200
    resp = await client.post("/board/signups", json={"player_id": pid})
    assert resp.status_code == 409


async def test_unknown_player_not_found(client: AsyncClient) -> None:
    resp = await client.post("/board/signups", json={"player_id": 99999})
    assert resp.status_code == 404


async def test_signup_requires_player_or_name(client: AsyncClient) -> None:
    resp = await client.post("/board/signups", json={})
    assert resp.status_code == 400


async def test_remove_signup(client: AsyncClient) -> None:
    resp = await client.post("/board/signups", json={"display_name": "Guest"})
    sid = resp.json()["signups"][0]["id"]
    resp = await client.delete(f"/board/signups/{sid}")
    assert resp.status_code == 200
    assert resp.json()["signups"] == []


async def test_remove_unknown_signup_not_found(client: AsyncClient) -> None:
    resp = await client.delete("/board/signups/99999")
    assert resp.status_code == 404


# ── present ──────────────────────────────────────────────────────────────────


async def test_toggle_present(client: AsyncClient) -> None:
    resp = await client.post("/board/signups", json={"display_name": "Guest"})
    sid = resp.json()["signups"][0]["id"]
    resp = await client.patch(f"/board/signups/{sid}", json={"present": True})
    assert resp.status_code == 200
    assert resp.json()["signups"][0]["present"] is True
    resp = await client.patch(f"/board/signups/{sid}", json={"present": False})
    assert resp.json()["signups"][0]["present"] is False


async def test_present_all(client: AsyncClient) -> None:
    await client.post("/board/signups", json={"display_name": "A"})
    await client.post("/board/signups", json={"display_name": "B"})
    resp = await client.post("/board/present-all")
    assert resp.status_code == 200
    assert all(s["present"] for s in resp.json()["signups"])


# ── generate ─────────────────────────────────────────────────────────────────


def _id_of(body: dict, name: str) -> int:
    return next(s["id"] for s in body["signups"] if s["display_name"] == name)


async def _two_present_extras(client: AsyncClient) -> tuple[int, int]:
    await client.post("/board/signups", json={"display_name": "A"})
    body = (await client.post("/board/signups", json={"display_name": "B"})).json()
    await client.post("/board/present-all")
    return _id_of(body, "A"), _id_of(body, "B")


async def test_generate_persists_pods_and_seats(client: AsyncClient) -> None:
    a, b = await _two_present_extras(client)
    fid = await _default_format_id(client)
    resp = await client.post("/board/generate", json=_gen_body(fid, [[a, b]], "Best"))
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"]["status"] == "generated"
    assert body["state"]["generated_at"] is not None
    assert len(body["pods"]) == 1
    assert body["pods"][0]["ordinal"] == 1
    assert body["pods"][0]["format_id"] == fid
    seated = {s["id"]: s for s in body["signups"]}
    assert seated[a]["pod_id"] == body["pods"][0]["id"]
    assert seated[a]["seat"] == 1
    assert seated[b]["seat"] == 2


async def test_generate_rejects_non_present(client: AsyncClient) -> None:
    a = (await client.post("/board/signups", json={"display_name": "A"})).json()["signups"][0]["id"]
    fid = await _default_format_id(client)
    resp = await client.post("/board/generate", json=_gen_body(fid, [[a]]))
    assert resp.status_code == 400


async def test_generate_rejects_unknown_signup(client: AsyncClient) -> None:
    a, _ = await _two_present_extras(client)
    fid = await _default_format_id(client)
    resp = await client.post("/board/generate", json=_gen_body(fid, [[a, 99999]]))
    assert resp.status_code == 400


async def test_generate_rejects_signup_in_wrong_format(client: AsyncClient) -> None:
    a, b = await _two_present_extras(client)
    # add a second format and generate the format-1 signups under it -> 400
    resp = await client.post("/board/formats", json={"name": "ECL"})
    second = next(f for f in resp.json()["formats"] if f["ordinal"] == 2)["id"]
    resp = await client.post("/board/generate", json=_gen_body(second, [[a, b]]))
    assert resp.status_code == 400


async def test_generate_clears_prior_pods(client: AsyncClient) -> None:
    a, b = await _two_present_extras(client)
    fid = await _default_format_id(client)
    await client.post("/board/generate", json=_gen_body(fid, [[a, b]]))
    resp = await client.post("/board/generate", json=_gen_body(fid, [[a], [b]]))
    assert resp.status_code == 200
    assert len(resp.json()["pods"]) == 2


async def test_generate_runs_within_each_format(client: AsyncClient) -> None:
    a, b = await _two_present_extras(client)
    fid = await _default_format_id(client)
    resp = await client.post("/board/formats", json={"name": "ECL"})
    second = next(f for f in resp.json()["formats"] if f["ordinal"] == 2)["id"]
    await client.patch(f"/board/signups/{b}", json={"format_id": second})

    body = {
        "formats": [
            {"format_id": fid, "seeding_label": "Best", "pods": [[a]]},
            {"format_id": second, "seeding_label": "Random", "pods": [[b]]},
        ]
    }
    resp = await client.post("/board/generate", json=body)
    assert resp.status_code == 200
    pods = resp.json()["pods"]
    assert len(pods) == 2
    by_format = {p["format_id"]: p for p in pods}
    assert by_format[fid]["ordinal"] == 1
    assert by_format[second]["ordinal"] == 1  # ordinals restart per format


# ── pod code ─────────────────────────────────────────────────────────────────


async def test_set_pod_code(client: AsyncClient) -> None:
    a, b = await _two_present_extras(client)
    fid = await _default_format_id(client)
    gen = await client.post("/board/generate", json=_gen_body(fid, [[a, b]]))
    pod_id = gen.json()["pods"][0]["id"]
    resp = await client.patch(f"/board/pods/{pod_id}", json={"code": "WIZARDS123"})
    assert resp.status_code == 200
    assert resp.json()["pods"][0]["code"] == "WIZARDS123"


async def test_set_pod_code_unknown_id(client: AsyncClient) -> None:
    resp = await client.patch("/board/pods/9999", json={"code": "X"})
    assert resp.status_code == 404


# ── reset ────────────────────────────────────────────────────────────────────


async def test_reset_clears_everything(client: AsyncClient) -> None:
    a, b = await _two_present_extras(client)
    fid = await _default_format_id(client)
    await client.post("/board/generate", json=_gen_body(fid, [[a, b]]))
    resp = await client.post("/board/reset")
    assert resp.status_code == 200
    body = resp.json()
    assert body["state"]["status"] == "open"
    assert body["signups"] == []
    assert body["pods"] == []
    assert body["events"] == []
    # a fresh default format is re-created after a reset
    assert len(body["formats"]) == 1
    assert body["formats"][0]["ordinal"] == 1


# ── activity feed ────────────────────────────────────────────────────────────


async def test_mutations_log_events(client: AsyncClient) -> None:
    await client.post("/board/signups", json={"display_name": "Eve"})
    resp = await client.get("/board")
    kinds = [e["kind"] for e in resp.json()["events"]]
    assert "signup_added" in kinds


# ── lazy auto-clear (service-level, injected clock) ──────────────────────────


async def _generate_two(svc: BoardService) -> None:
    a = await svc.add_signup(SignupCreateRequest(display_name="A"))
    b = await svc.add_signup(SignupCreateRequest(display_name="B"))
    await svc.set_present(a.id, True)
    await svc.set_present(b.id, True)
    await svc.generate(
        GenerateRequest(formats=[FormatGenerateGroup(format_id=a.format_id, seeding_label="Best", pods=[[a.id, b.id]])])
    )


async def test_autoclear_resets_idle_generated_board(async_session: AsyncSession) -> None:
    svc = BoardService(async_session)
    await _generate_two(svc)

    future = datetime.now(UTC) + AUTO_CLEAR_AFTER + timedelta(hours=1)
    svc_future = BoardService(async_session, now=lambda: future)
    board = await svc_future.get_board()
    assert board.state.status == "open"
    assert board.signups == []
    assert board.pods == []


async def test_no_autoclear_within_window(async_session: AsyncSession) -> None:
    svc = BoardService(async_session)
    await _generate_two(svc)

    near = datetime.now(UTC) + timedelta(days=2)
    svc_future = BoardService(async_session, now=lambda: near)
    board = await svc_future.get_board()
    assert board.state.status == "generated"
    assert len(board.signups) == 2


async def test_no_autoclear_when_open(async_session: AsyncSession) -> None:
    svc = BoardService(async_session)
    await svc.add_signup(SignupCreateRequest(display_name="A"))

    far = datetime.now(UTC) + timedelta(days=10)
    svc_future = BoardService(async_session, now=lambda: far)
    board = await svc_future.get_board()
    assert board.state.status == "open"
    assert len(board.signups) == 1


# ── schema round-trips ───────────────────────────────────────────────────────


def test_board_schemas_roundtrip() -> None:
    now = datetime.now(UTC)
    state = PodRegistrationStateRead(id=1, status="open", generated_at=None, last_activity_at=now, created_at=now)
    assert state.status == "open"
    signup = PodSignupRead(
        id=1,
        player_id=None,
        display_name="X",
        is_extra=True,
        present=False,
        format_id=1,
        pod_id=None,
        seat=None,
        created_at=now,
    )
    assert signup.is_extra is True
    fmt = PodFormatRead(id=1, ordinal=1, name="SOS", season_id=2, created_at=now)
    assert fmt.name == "SOS"
    pod = PodPodRead(id=1, format_id=1, ordinal=1, code=None, created_at=now)
    assert pod.ordinal == 1
    event = PodEventRead(id=1, kind="signup_added", message="X signed up", created_at=now)
    assert event.kind == "signup_added"


# ── formats ──────────────────────────────────────────────────────────────────


async def test_add_other_format(client: AsyncClient) -> None:
    resp = await client.post("/board/formats", json={"name": "ECL"})
    assert resp.status_code == 200
    formats = resp.json()["formats"]
    assert len(formats) == 2
    second = next(f for f in formats if f["ordinal"] == 2)
    assert second["name"] == "ECL"
    assert second["season_id"] is None


async def test_add_season_backed_format_uses_set_code(client: AsyncClient) -> None:
    season = await client.post(
        "/seasons/", json={"name": "Eldraine", "set_code": "ECL", "starts_on": "2026-01-01", "ends_on": "2026-06-30"}
    )
    sid = season.json()["id"]
    resp = await client.post("/board/formats", json={"season_id": sid})
    assert resp.status_code == 200
    second = next(f for f in resp.json()["formats"] if f["ordinal"] == 2)
    assert second["name"] == "ECL"
    assert second["season_id"] == sid


async def test_add_format_unknown_season(client: AsyncClient) -> None:
    resp = await client.post("/board/formats", json={"season_id": 99999})
    assert resp.status_code == 404


async def test_add_third_format_conflicts(client: AsyncClient) -> None:
    await client.post("/board/formats", json={"name": "ECL"})
    resp = await client.post("/board/formats", json={"name": "PIO"})
    assert resp.status_code == 409


async def test_remove_format_folds_signups_back(client: AsyncClient) -> None:
    fid = await _default_format_id(client)
    sid = (await client.post("/board/signups", json={"display_name": "A"})).json()["signups"][0]["id"]
    resp = await client.post("/board/formats", json={"name": "ECL"})
    second = next(f for f in resp.json()["formats"] if f["ordinal"] == 2)["id"]
    await client.patch(f"/board/signups/{sid}", json={"format_id": second})

    resp = await client.delete(f"/board/formats/{second}")
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["formats"]) == 1
    moved = next(s for s in body["signups"] if s["id"] == sid)
    assert moved["format_id"] == fid


async def test_cannot_remove_default_format(client: AsyncClient) -> None:
    fid = await _default_format_id(client)
    resp = await client.delete(f"/board/formats/{fid}")
    assert resp.status_code == 400


async def test_move_signup_between_formats(client: AsyncClient) -> None:
    sid = (await client.post("/board/signups", json={"display_name": "A"})).json()["signups"][0]["id"]
    resp = await client.post("/board/formats", json={"name": "ECL"})
    second = next(f for f in resp.json()["formats"] if f["ordinal"] == 2)["id"]

    resp = await client.patch(f"/board/signups/{sid}", json={"format_id": second})
    assert resp.status_code == 200
    moved = next(s for s in resp.json()["signups"] if s["id"] == sid)
    assert moved["format_id"] == second


async def test_move_signup_unknown_format(client: AsyncClient) -> None:
    sid = (await client.post("/board/signups", json={"display_name": "A"})).json()["signups"][0]["id"]
    resp = await client.patch(f"/board/signups/{sid}", json={"format_id": 99999})
    assert resp.status_code == 400


async def test_new_signup_defaults_to_first_format(client: AsyncClient) -> None:
    fid = await _default_format_id(client)
    resp = await client.post("/board/signups", json={"display_name": "A"})
    assert resp.json()["signups"][0]["format_id"] == fid
