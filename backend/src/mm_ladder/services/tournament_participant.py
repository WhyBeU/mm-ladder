from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.tournament_participant import (
    TournamentParticipantCreateRequest,
    TournamentParticipantPatchRequest,
    TournamentParticipantUpdateRequest,
)
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.services.audit import AuditRecorder, diff_fields


def _participant_snapshot(tp: TournamentParticipant) -> dict[str, object]:
    return {
        "player_id": tp.player_id,
        "match_wins": tp.match_wins,
        "match_losses": tp.match_losses,
        "match_draws": tp.match_draws,
    }


def _participant_label(tp: TournamentParticipant) -> str:
    return f"Participant #{tp.id} (t{tp.tournament_id})"


class TournamentParticipantService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, tournament_id: int) -> Sequence[TournamentParticipant]:
        result = await self._session.execute(
            select(TournamentParticipant).where(TournamentParticipant.tournament_id == tournament_id)
        )
        return result.scalars().all()

    async def get(self, tournament_id: int, participant_id: int) -> TournamentParticipant:
        tp = await self._session.get(TournamentParticipant, participant_id)
        if tp is None or tp.tournament_id != tournament_id:
            raise NotFoundError("TournamentParticipant", participant_id)
        return tp

    async def create(self, tournament_id: int, data: TournamentParticipantCreateRequest) -> TournamentParticipant:
        tournament = await self._session.get(Tournament, tournament_id)
        if tournament is None:
            raise NotFoundError("Tournament", tournament_id)
        tp = TournamentParticipant(
            tournament_id=tournament_id,
            player_id=data.player_id,
            match_wins=data.match_wins,
            match_losses=data.match_losses,
            match_draws=data.match_draws,
        )
        self._session.add(tp)
        await self._session.flush()
        AuditRecorder(self._session).record(
            action="CREATE",
            entity_type="participant",
            entity_id=tp.id,
            label=_participant_label(tp),
            changes=[{"field": k, "old": None, "new": v} for k, v in _participant_snapshot(tp).items()],
        )
        await self._session.commit()
        await self._session.refresh(tp)
        return tp

    async def update(
        self, tournament_id: int, participant_id: int, data: TournamentParticipantUpdateRequest
    ) -> TournamentParticipant:
        tp = await self.get(tournament_id, participant_id)
        before = _participant_snapshot(tp)
        tp.player_id = data.player_id
        tp.match_wins = data.match_wins
        tp.match_losses = data.match_losses
        tp.match_draws = data.match_draws
        self._record_update(tp, before)
        await self._session.commit()
        await self._session.refresh(tp)
        return tp

    def _record_update(self, tp: TournamentParticipant, before: dict[str, object]) -> None:
        changes = diff_fields(before, _participant_snapshot(tp))
        if changes:
            AuditRecorder(self._session).record(
                action="UPDATE",
                entity_type="participant",
                entity_id=tp.id,
                label=_participant_label(tp),
                changes=changes,
            )

    async def patch(
        self, tournament_id: int, participant_id: int, data: TournamentParticipantPatchRequest
    ) -> TournamentParticipant:
        tp = await self.get(tournament_id, participant_id)
        before = _participant_snapshot(tp)
        if data.player_id is not None:
            tp.player_id = data.player_id
        if data.match_wins is not None:
            tp.match_wins = data.match_wins
        if data.match_losses is not None:
            tp.match_losses = data.match_losses
        if data.match_draws is not None:
            tp.match_draws = data.match_draws
        self._record_update(tp, before)
        await self._session.commit()
        await self._session.refresh(tp)
        return tp

    async def delete(self, tournament_id: int, participant_id: int) -> None:
        tp = await self.get(tournament_id, participant_id)
        AuditRecorder(self._session).record(
            action="DELETE",
            entity_type="participant",
            entity_id=participant_id,
            label=_participant_label(tp),
            changes=[{"field": k, "old": v, "new": None} for k, v in _participant_snapshot(tp).items()],
        )
        await self._session.delete(tp)
        await self._session.commit()
