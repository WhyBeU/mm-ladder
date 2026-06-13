from collections.abc import Sequence
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.models.audit_log import AuditLog

Change = dict[str, Any]  # {"field": str, "old": Any, "new": Any}


def diff_fields(before: dict[str, Any], after: dict[str, Any]) -> list[Change]:
    """Return [{field, old, new}] for keys whose value changed (across the union of keys)."""
    changes: list[Change] = []
    for key in {*before, *after}:
        old = before.get(key)
        new = after.get(key)
        if old != new:
            changes.append({"field": key, "old": old, "new": new})
    changes.sort(key=lambda c: c["field"])
    return changes


def _summarize(action: str, changes: list[Change]) -> str:
    if action == "CREATE":
        return "created"
    if action == "DELETE":
        return "deleted"
    parts = [f"{c['field']}: {c['old']!r} → {c['new']!r}" for c in changes[:3]]
    extra = "" if len(changes) <= 3 else f" (+{len(changes) - 3} more)"
    return ("; ".join(parts) + extra) if parts else "no change"


class AuditRecorder:
    """Adds an AuditLog row to the current session (no commit). Constructed from a service's own
    async session, so the entry is written atomically with the mutation it describes."""

    def __init__(self, session: AsyncSession, actor: str = "admin") -> None:
        self._session = session
        self._actor = actor

    def record(
        self,
        *,
        action: str,
        entity_type: str,
        entity_id: int | None,
        label: str,
        changes: list[Change],
    ) -> None:
        self._session.add(
            AuditLog(
                actor=self._actor,
                action=action,
                entity_type=entity_type,
                entity_id=entity_id,
                label=label,
                summary=_summarize(action, changes),
                changes=changes,
            )
        )


class AuditService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(
        self, *, entity_type: str | None, action: str | None, limit: int, offset: int
    ) -> tuple[Sequence[AuditLog], int]:
        stmt = select(AuditLog)
        count_stmt = select(func.count()).select_from(AuditLog)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
            count_stmt = count_stmt.where(AuditLog.entity_type == entity_type)
        if action:
            stmt = stmt.where(AuditLog.action == action)
            count_stmt = count_stmt.where(AuditLog.action == action)

        total = (await self._session.execute(count_stmt)).scalar_one()
        rows = (
            (
                await self._session.execute(
                    stmt.order_by(AuditLog.created_at.desc(), AuditLog.id.desc()).limit(limit).offset(offset)
                )
            )
            .scalars()
            .all()
        )
        return rows, total
