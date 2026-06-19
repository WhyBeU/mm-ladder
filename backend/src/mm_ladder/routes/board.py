from fastapi import APIRouter

from mm_ladder.deps import BoardServiceDep
from mm_ladder.interface.board import (
    FormatCreateRequest,
    GenerateRequest,
    PodCodePatchRequest,
    SignupCreateRequest,
    SignupPatchRequest,
)
from mm_ladder.schemas.board import (
    BoardRead,
    PodEventRead,
    PodFormatRead,
    PodPodRead,
    PodRegistrationStateRead,
    PodSignupRead,
)
from mm_ladder.services.board import BoardData, BoardService

router = APIRouter(prefix="/board", tags=["board"])


def _to_read(data: BoardData) -> BoardRead:
    return BoardRead(
        state=PodRegistrationStateRead.model_validate(data.state),
        formats=[PodFormatRead.model_validate(f) for f in data.formats],
        signups=[PodSignupRead.model_validate(s) for s in data.signups],
        pods=[PodPodRead.model_validate(p) for p in data.pods],
        events=[PodEventRead.model_validate(e) for e in data.events],
    )


async def _board(service: BoardService) -> BoardRead:
    return _to_read(await service.get_board())


@router.get("", response_model=BoardRead)
async def get_board(service: BoardServiceDep) -> BoardRead:
    return await _board(service)


@router.post("/formats", response_model=BoardRead)
async def add_format(data: FormatCreateRequest, service: BoardServiceDep) -> BoardRead:
    await service.add_format(data)
    return await _board(service)


@router.delete("/formats/{format_id}", response_model=BoardRead)
async def remove_format(format_id: int, service: BoardServiceDep) -> BoardRead:
    await service.remove_format(format_id)
    return await _board(service)


@router.post("/signups", response_model=BoardRead)
async def add_signup(data: SignupCreateRequest, service: BoardServiceDep) -> BoardRead:
    await service.add_signup(data)
    return await _board(service)


@router.delete("/signups/{signup_id}", response_model=BoardRead)
async def remove_signup(signup_id: int, service: BoardServiceDep) -> BoardRead:
    await service.remove_signup(signup_id)
    return await _board(service)


@router.patch("/signups/{signup_id}", response_model=BoardRead)
async def patch_signup(signup_id: int, data: SignupPatchRequest, service: BoardServiceDep) -> BoardRead:
    if data.present is not None:
        await service.set_present(signup_id, data.present)
    if data.format_id is not None:
        await service.move_signup(signup_id, data.format_id)
    return await _board(service)


@router.post("/present-all", response_model=BoardRead)
async def present_all(service: BoardServiceDep) -> BoardRead:
    await service.present_all()
    return await _board(service)


@router.post("/generate", response_model=BoardRead)
async def generate(data: GenerateRequest, service: BoardServiceDep) -> BoardRead:
    await service.generate(data)
    return await _board(service)


@router.patch("/pods/{pod_id}", response_model=BoardRead)
async def set_pod_code(pod_id: int, data: PodCodePatchRequest, service: BoardServiceDep) -> BoardRead:
    await service.set_pod_code(pod_id, data.code)
    return await _board(service)


@router.post("/reset", response_model=BoardRead)
async def reset(service: BoardServiceDep) -> BoardRead:
    await service.reset()
    return await _board(service)
