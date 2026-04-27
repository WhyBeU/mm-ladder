from fastapi import APIRouter
from fastapi import status as http_status

from mm_ladder.deps import SeasonServiceDep
from mm_ladder.interface.season import SeasonCreateRequest, SeasonPatchRequest, SeasonUpdateRequest
from mm_ladder.schemas.season import SeasonRead

router = APIRouter(prefix="/seasons", tags=["seasons"])


@router.get("/", response_model=list[SeasonRead])
async def list_seasons(service: SeasonServiceDep) -> list[SeasonRead]:
    return [SeasonRead.model_validate(s) for s in await service.list()]


@router.post("/", response_model=SeasonRead, status_code=http_status.HTTP_201_CREATED)
async def create_season(data: SeasonCreateRequest, service: SeasonServiceDep) -> SeasonRead:
    return SeasonRead.model_validate(await service.create(data))


@router.get("/{season_id}", response_model=SeasonRead)
async def get_season(season_id: int, service: SeasonServiceDep) -> SeasonRead:
    return SeasonRead.model_validate(await service.get(season_id))


@router.put("/{season_id}", response_model=SeasonRead)
async def update_season(season_id: int, data: SeasonUpdateRequest, service: SeasonServiceDep) -> SeasonRead:
    return SeasonRead.model_validate(await service.update(season_id, data))


@router.patch("/{season_id}", response_model=SeasonRead)
async def patch_season(season_id: int, data: SeasonPatchRequest, service: SeasonServiceDep) -> SeasonRead:
    return SeasonRead.model_validate(await service.patch(season_id, data))


@router.delete("/{season_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_season(season_id: int, service: SeasonServiceDep) -> None:
    await service.delete(season_id)
