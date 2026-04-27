from fastapi import APIRouter
from fastapi import status as http_status

from mm_ladder.deps import MatchServiceDep, ParticipantServiceDep, TournamentServiceDep
from mm_ladder.interface.match import MatchCreateRequest, MatchPatchRequest, MatchUpdateRequest
from mm_ladder.interface.tournament import TournamentCreateRequest, TournamentPatchRequest, TournamentUpdateRequest
from mm_ladder.interface.tournament_participant import (
    TournamentParticipantCreateRequest,
    TournamentParticipantPatchRequest,
    TournamentParticipantUpdateRequest,
)
from mm_ladder.schemas.match import MatchRead
from mm_ladder.schemas.tournament import TournamentRead
from mm_ladder.schemas.tournament_participant import TournamentParticipantRead

router = APIRouter(prefix="/tournaments", tags=["tournaments"])


# ── Tournament CRUD ────────────────────────────────────────────────────────────


@router.get("/", response_model=list[TournamentRead])
async def list_tournaments(service: TournamentServiceDep) -> list[TournamentRead]:
    return [TournamentRead.model_validate(t) for t in await service.list()]


@router.post("/", response_model=TournamentRead, status_code=http_status.HTTP_201_CREATED)
async def create_tournament(data: TournamentCreateRequest, service: TournamentServiceDep) -> TournamentRead:
    return TournamentRead.model_validate(await service.create(data))


@router.get("/{tournament_id}", response_model=TournamentRead)
async def get_tournament(tournament_id: int, service: TournamentServiceDep) -> TournamentRead:
    return TournamentRead.model_validate(await service.get(tournament_id))


@router.put("/{tournament_id}", response_model=TournamentRead)
async def update_tournament(
    tournament_id: int, data: TournamentUpdateRequest, service: TournamentServiceDep
) -> TournamentRead:
    return TournamentRead.model_validate(await service.update(tournament_id, data))


@router.patch("/{tournament_id}", response_model=TournamentRead)
async def patch_tournament(
    tournament_id: int, data: TournamentPatchRequest, service: TournamentServiceDep
) -> TournamentRead:
    return TournamentRead.model_validate(await service.patch(tournament_id, data))


@router.delete("/{tournament_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_tournament(tournament_id: int, service: TournamentServiceDep) -> None:
    await service.delete(tournament_id)


# ── Participants (nested) ──────────────────────────────────────────────────────


@router.get("/{tournament_id}/participants", response_model=list[TournamentParticipantRead])
async def list_participants(tournament_id: int, service: ParticipantServiceDep) -> list[TournamentParticipantRead]:
    return [TournamentParticipantRead.model_validate(p) for p in await service.list(tournament_id)]


@router.post(
    "/{tournament_id}/participants",
    response_model=TournamentParticipantRead,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_participant(
    tournament_id: int, data: TournamentParticipantCreateRequest, service: ParticipantServiceDep
) -> TournamentParticipantRead:
    return TournamentParticipantRead.model_validate(await service.create(tournament_id, data))


@router.get("/{tournament_id}/participants/{participant_id}", response_model=TournamentParticipantRead)
async def get_participant(
    tournament_id: int, participant_id: int, service: ParticipantServiceDep
) -> TournamentParticipantRead:
    return TournamentParticipantRead.model_validate(await service.get(tournament_id, participant_id))


@router.put("/{tournament_id}/participants/{participant_id}", response_model=TournamentParticipantRead)
async def update_participant(
    tournament_id: int,
    participant_id: int,
    data: TournamentParticipantUpdateRequest,
    service: ParticipantServiceDep,
) -> TournamentParticipantRead:
    return TournamentParticipantRead.model_validate(await service.update(tournament_id, participant_id, data))


@router.patch("/{tournament_id}/participants/{participant_id}", response_model=TournamentParticipantRead)
async def patch_participant(
    tournament_id: int,
    participant_id: int,
    data: TournamentParticipantPatchRequest,
    service: ParticipantServiceDep,
) -> TournamentParticipantRead:
    return TournamentParticipantRead.model_validate(await service.patch(tournament_id, participant_id, data))


@router.delete("/{tournament_id}/participants/{participant_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_participant(tournament_id: int, participant_id: int, service: ParticipantServiceDep) -> None:
    await service.delete(tournament_id, participant_id)


# ── Matches (nested) ───────────────────────────────────────────────────────────


@router.get("/{tournament_id}/matches", response_model=list[MatchRead])
async def list_matches(tournament_id: int, service: MatchServiceDep) -> list[MatchRead]:
    return [MatchRead.model_validate(m) for m in await service.list(tournament_id)]


@router.post(
    "/{tournament_id}/matches",
    response_model=MatchRead,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_match(tournament_id: int, data: MatchCreateRequest, service: MatchServiceDep) -> MatchRead:
    return MatchRead.model_validate(await service.create(tournament_id, data))


@router.get("/{tournament_id}/matches/{match_id}", response_model=MatchRead)
async def get_match(tournament_id: int, match_id: int, service: MatchServiceDep) -> MatchRead:
    return MatchRead.model_validate(await service.get(tournament_id, match_id))


@router.put("/{tournament_id}/matches/{match_id}", response_model=MatchRead)
async def update_match(
    tournament_id: int, match_id: int, data: MatchUpdateRequest, service: MatchServiceDep
) -> MatchRead:
    return MatchRead.model_validate(await service.update(tournament_id, match_id, data))


@router.patch("/{tournament_id}/matches/{match_id}", response_model=MatchRead)
async def patch_match(
    tournament_id: int, match_id: int, data: MatchPatchRequest, service: MatchServiceDep
) -> MatchRead:
    return MatchRead.model_validate(await service.patch(tournament_id, match_id, data))


@router.delete("/{tournament_id}/matches/{match_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_match(tournament_id: int, match_id: int, service: MatchServiceDep) -> None:
    await service.delete(tournament_id, match_id)
