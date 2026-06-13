from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.tournament import TournamentCreateRequest, TournamentPatchRequest, TournamentUpdateRequest
from mm_ladder.models.tournament import Tournament
from mm_ladder.services.audit import AuditRecorder, diff_fields


def _tournament_snapshot(t: Tournament) -> dict[str, object]:
    return {
        "held_on": t.held_on.isoformat(),
        "name": t.name,
        "notes": t.notes,
        "season_id": t.season_id,
    }


def _tournament_label(t: Tournament) -> str:
    return f"Tournament {t.held_on}"


class TournamentService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> Sequence[Tournament]:
        result = await self._session.execute(select(Tournament))
        return result.scalars().all()

    async def get(self, tournament_id: int) -> Tournament:
        tournament = await self._session.get(Tournament, tournament_id)
        if tournament is None:
            raise NotFoundError("Tournament", tournament_id)
        return tournament

    async def create(self, data: TournamentCreateRequest) -> Tournament:
        tournament = Tournament(
            held_on=data.held_on,
            season_id=data.season_id,
            name=data.name,
            notes=data.notes,
        )
        self._session.add(tournament)
        await self._session.flush()
        AuditRecorder(self._session).record(
            action="CREATE",
            entity_type="tournament",
            entity_id=tournament.id,
            label=_tournament_label(tournament),
            changes=[{"field": k, "old": None, "new": v} for k, v in _tournament_snapshot(tournament).items()],
        )
        await self._session.commit()
        await self._session.refresh(tournament)
        return tournament

    async def update(self, tournament_id: int, data: TournamentUpdateRequest) -> Tournament:
        tournament = await self.get(tournament_id)
        before = _tournament_snapshot(tournament)
        tournament.held_on = data.held_on
        tournament.season_id = data.season_id
        tournament.name = data.name
        tournament.notes = data.notes
        self._record_update(tournament, before)
        await self._session.commit()
        await self._session.refresh(tournament)
        return tournament

    def _record_update(self, tournament: Tournament, before: dict[str, object]) -> None:
        changes = diff_fields(before, _tournament_snapshot(tournament))
        if changes:
            AuditRecorder(self._session).record(
                action="UPDATE",
                entity_type="tournament",
                entity_id=tournament.id,
                label=_tournament_label(tournament),
                changes=changes,
            )

    async def patch(self, tournament_id: int, data: TournamentPatchRequest) -> Tournament:
        tournament = await self.get(tournament_id)
        before = _tournament_snapshot(tournament)
        if data.held_on is not None:
            tournament.held_on = data.held_on
        if data.season_id is not None:
            tournament.season_id = data.season_id
        if data.name is not None:
            tournament.name = data.name
        if data.notes is not None:
            tournament.notes = data.notes
        self._record_update(tournament, before)
        await self._session.commit()
        await self._session.refresh(tournament)
        return tournament

    async def delete(self, tournament_id: int) -> None:
        result = await self._session.execute(
            select(Tournament)
            .where(Tournament.id == tournament_id)
            .options(selectinload(Tournament.participants), selectinload(Tournament.matches))
        )
        tournament = result.scalar_one_or_none()
        if tournament is None:
            raise NotFoundError("Tournament", tournament_id)
        AuditRecorder(self._session).record(
            action="DELETE",
            entity_type="tournament",
            entity_id=tournament_id,
            label=_tournament_label(tournament),
            changes=[{"field": k, "old": v, "new": None} for k, v in _tournament_snapshot(tournament).items()],
        )
        await self._session.delete(tournament)
        await self._session.commit()
