from fastapi import APIRouter
from fastapi import status as http_status

from mm_ladder.auth import AdminDep
from mm_ladder.deps import YearlyCupServiceDep
from mm_ladder.interface.yearly_cup import YearlyCupCreateRequest, YearlyCupPatchRequest, YearlyCupUpdateRequest
from mm_ladder.schemas.yearly_cup import YearlyCupRead

router = APIRouter(prefix="/yearly-cups", tags=["yearly-cups"])


@router.get("/", response_model=list[YearlyCupRead])
async def list_yearly_cups(service: YearlyCupServiceDep) -> list[YearlyCupRead]:
    return [YearlyCupRead.model_validate(c) for c in await service.list()]


@router.post("/", response_model=YearlyCupRead, status_code=http_status.HTTP_201_CREATED, dependencies=[AdminDep])
async def create_yearly_cup(data: YearlyCupCreateRequest, service: YearlyCupServiceDep) -> YearlyCupRead:
    return YearlyCupRead.model_validate(await service.create(data))


@router.get("/{cup_id}", response_model=YearlyCupRead)
async def get_yearly_cup(cup_id: int, service: YearlyCupServiceDep) -> YearlyCupRead:
    return YearlyCupRead.model_validate(await service.get(cup_id))


@router.put("/{cup_id}", response_model=YearlyCupRead, dependencies=[AdminDep])
async def update_yearly_cup(cup_id: int, data: YearlyCupUpdateRequest, service: YearlyCupServiceDep) -> YearlyCupRead:
    return YearlyCupRead.model_validate(await service.update(cup_id, data))


@router.patch("/{cup_id}", response_model=YearlyCupRead, dependencies=[AdminDep])
async def patch_yearly_cup(cup_id: int, data: YearlyCupPatchRequest, service: YearlyCupServiceDep) -> YearlyCupRead:
    return YearlyCupRead.model_validate(await service.patch(cup_id, data))


@router.delete("/{cup_id}", status_code=http_status.HTTP_204_NO_CONTENT, dependencies=[AdminDep])
async def delete_yearly_cup(cup_id: int, service: YearlyCupServiceDep) -> None:
    await service.delete(cup_id)
