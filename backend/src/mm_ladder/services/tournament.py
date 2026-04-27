from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.tournament import TournamentCreateRequest, TournamentPatchRequest, TournamentUpdateRequest
from mm_ladder.models.tournament import Tournament


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
        await self._session.commit()
        await self._session.refresh(tournament)
        return tournament

    async def update(self, tournament_id: int, data: TournamentUpdateRequest) -> Tournament:
        tournament = await self.get(tournament_id)
        tournament.held_on = data.held_on
        tournament.season_id = data.season_id
        tournament.name = data.name
        tournament.notes = data.notes
        await self._session.commit()
        await self._session.refresh(tournament)
        return tournament

    async def patch(self, tournament_id: int, data: TournamentPatchRequest) -> Tournament:
        tournament = await self.get(tournament_id)
        if data.held_on is not None:
            tournament.held_on = data.held_on
        if data.season_id is not None:
            tournament.season_id = data.season_id
        if data.name is not None:
            tournament.name = data.name
        if data.notes is not None:
            tournament.notes = data.notes
        await self._session.commit()
        await self._session.refresh(tournament)
        return tournament

    async def delete(self, tournament_id: int) -> None:
        tournament = await self.get(tournament_id)
        await self._session.delete(tournament)
        await self._session.commit()
