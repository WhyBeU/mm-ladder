from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.player import PlayerCreateRequest, PlayerPatchRequest, PlayerUpdateRequest
from mm_ladder.models.player import Player


class PlayerService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> Sequence[Player]:
        result = await self._session.execute(select(Player))
        return result.scalars().all()

    async def get(self, player_id: int) -> Player:
        player = await self._session.get(Player, player_id)
        if player is None:
            raise NotFoundError("Player", player_id)
        return player

    async def create(self, data: PlayerCreateRequest) -> Player:
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
