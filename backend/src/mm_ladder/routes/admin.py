from fastapi import APIRouter

from mm_ladder.auth import AdminDep
from mm_ladder.deps import AuditServiceDep
from mm_ladder.schemas.audit_log import AuditLogPage, AuditLogRead

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/check", dependencies=[AdminDep])
async def check() -> dict[str, str]:
    return {"status": "ok"}


@router.get("/audit", response_model=AuditLogPage, dependencies=[AdminDep])
async def list_audit(
    service: AuditServiceDep,
    entity_type: str | None = None,
    action: str | None = None,
    limit: int = 50,
    offset: int = 0,
) -> AuditLogPage:
    rows, total = await service.list(entity_type=entity_type, action=action, limit=limit, offset=offset)
    return AuditLogPage(items=[AuditLogRead.model_validate(r) for r in rows], total=total)
