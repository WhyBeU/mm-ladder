from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.player import PlayerCreateRequest, PlayerPatchRequest, PlayerUpdateRequest
from mm_ladder.models.player import Player
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.schemas.player import PlayerRead
from mm_ladder.services.player_matching import find_matching_player, register_alias_if_new

VETERAN_THRESHOLD = 52


class PlayerService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> list[PlayerRead]:
        participation_count = (
            select(func.count()).where(TournamentParticipant.player_id == Player.id).correlate(Player).scalar_subquery()
        )
        result = await self._session.execute(
            select(
                Player.id,
                Player.display_name,
                Player.is_hidden,
                Player.created_at,
                Player.updated_at,
                participation_count.label("event_count"),
            )
        )
        rows = result.all()
        return [
            PlayerRead(
                id=row.id,
                display_name=row.display_name,
                is_hidden=row.is_hidden,
                is_veteran=row.event_count > VETERAN_THRESHOLD,
                created_at=row.created_at,
                updated_at=row.updated_at,
            )
            for row in rows
        ]

    async def get(self, player_id: int) -> Player:
        player = await self._session.get(Player, player_id)
        if player is None:
            raise NotFoundError("Player", player_id)
        return player

    async def create(self, data: PlayerCreateRequest) -> Player:
        result = await self._session.execute(select(Player))
        existing = find_matching_player(result.scalars().all(), data.display_name)
        if existing is not None:
            register_alias_if_new(existing, data.display_name)
            await self._session.commit()
            await self._session.refresh(existing)
            return existing

        player = Player(display_name=data.display_name, is_hidden=data.is_hidden)
        self._session.add(player)
        await self._session.commit()
        await self._session.refresh(player)
        return player

    async def update(self, player_id: int, data: PlayerUpdateRequest) -> Player:
        player = await self.get(player_id)
        player.display_name = data.display_name
        player.is_hidden = data.is_hidden
        await self._session.commit()
        await self._session.refresh(player)
        return player

    async def patch(self, player_id: int, data: PlayerPatchRequest) -> Player:
        player = await self.get(player_id)
        if data.display_name is not None:
            player.display_name = data.display_name
        if data.is_hidden is not None:
            player.is_hidden = data.is_hidden
        await self._session.commit()
        await self._session.refresh(player)
        return player

    async def delete(self, player_id: int) -> None:
        player = await self.get(player_id)
        await self._session.delete(player)
        await self._session.commit()
