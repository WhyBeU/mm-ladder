from datetime import datetime
from typing import Any

from pydantic import BaseModel

from .base import BaseReadSchema


class AuditLogRead(BaseReadSchema):
    id: int
    created_at: datetime
    actor: str
    action: str
    entity_type: str
    entity_id: int | None
    label: str
    summary: str
    changes: list[dict[str, Any]]


class AuditLogPage(BaseModel):
    items: list[AuditLogRead]
    total: int
