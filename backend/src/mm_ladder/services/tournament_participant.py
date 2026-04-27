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
        await self._session.commit()
        await self._session.refresh(tp)
        return tp

    async def update(
        self, tournament_id: int, participant_id: int, data: TournamentParticipantUpdateRequest
    ) -> TournamentParticipant:
        tp = await self.get(tournament_id, participant_id)
        tp.player_id = data.player_id
        tp.match_wins = data.match_wins
        tp.match_losses = data.match_losses
        tp.match_draws = data.match_draws
        await self._session.commit()
        await self._session.refresh(tp)
        return tp

    async def patch(
        self, tournament_id: int, participant_id: int, data: TournamentParticipantPatchRequest
    ) -> TournamentParticipant:
        tp = await self.get(tournament_id, participant_id)
        if data.match_wins is not None:
            tp.match_wins = data.match_wins
        if data.match_losses is not None:
            tp.match_losses = data.match_losses
        if data.match_draws is not None:
            tp.match_draws = data.match_draws
        await self._session.commit()
        await self._session.refresh(tp)
        return tp

    async def delete(self, tournament_id: int, participant_id: int) -> None:
        tp = await self.get(tournament_id, participant_id)
        await self._session.delete(tp)
        await self._session.commit()
