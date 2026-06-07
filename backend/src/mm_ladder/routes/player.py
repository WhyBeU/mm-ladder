from fastapi import APIRouter
from fastapi import status as http_status

from mm_ladder.deps import PlayerServiceDep
from mm_ladder.interface.player import PlayerCreateRequest, PlayerPatchRequest, PlayerUpdateRequest
from mm_ladder.schemas.player import PlayerRead

router = APIRouter(prefix="/players", tags=["players"])


@router.get("/", response_model=list[PlayerRead])
async def list_players(service: PlayerServiceDep) -> list[PlayerRead]:
    return await service.list()


@router.post("/", response_model=PlayerRead, status_code=http_status.HTTP_201_CREATED)
async def create_player(data: PlayerCreateRequest, service: PlayerServiceDep) -> PlayerRead:
    return PlayerRead.model_validate(await service.create(data))


@router.get("/{player_id}", response_model=PlayerRead)
async def get_player(player_id: int, service: PlayerServiceDep) -> PlayerRead:
    return PlayerRead.model_validate(await service.get(player_id))


@router.put("/{player_id}", response_model=PlayerRead)
async def update_player(player_id: int, data: PlayerUpdateRequest, service: PlayerServiceDep) -> PlayerRead:
    return PlayerRead.model_validate(await service.update(player_id, data))


@router.patch("/{player_id}", response_model=PlayerRead)
async def patch_player(player_id: int, data: PlayerPatchRequest, service: PlayerServiceDep) -> PlayerRead:
    return PlayerRead.model_validate(await service.patch(player_id, data))


@router.delete("/{player_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_player(player_id: int, service: PlayerServiceDep) -> None:
    await service.delete(player_id)
