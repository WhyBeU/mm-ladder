from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.yearly_cup import YearlyCupCreateRequest, YearlyCupPatchRequest, YearlyCupUpdateRequest
from mm_ladder.models.player import Player
from mm_ladder.models.yearly_cup import YearlyCup


class YearlyCupService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> Sequence[YearlyCup]:
        result = await self._session.execute(select(YearlyCup))
        return result.scalars().all()

    async def get(self, cup_id: int) -> YearlyCup:
        cup = await self._session.get(YearlyCup, cup_id)
        if cup is None:
            raise NotFoundError("YearlyCup", cup_id)
        return cup

    async def _set_qualified_players(self, cup: YearlyCup, player_ids: Sequence[int]) -> None:
        result = await self._session.execute(select(Player).where(Player.id.in_(player_ids)))
        cup.qualified_players = list(result.scalars().all())

    async def create(self, data: YearlyCupCreateRequest) -> YearlyCup:
        cup = YearlyCup(
            year=data.year,
            name=data.name,
            starts_on=data.starts_on,
            ends_on=data.ends_on,
            player_of_the_year_id=data.player_of_the_year_id,
            cup_winner_id=data.cup_winner_id,
        )
        await self._set_qualified_players(cup, data.qualified_player_ids)
        self._session.add(cup)
        await self._session.commit()
        await self._session.refresh(cup)
        return cup

    async def update(self, cup_id: int, data: YearlyCupUpdateRequest) -> YearlyCup:
        cup = await self.get(cup_id)
        cup.year = data.year
        cup.name = data.name
        cup.starts_on = data.starts_on
        cup.ends_on = data.ends_on
        cup.player_of_the_year_id = data.player_of_the_year_id
        cup.cup_winner_id = data.cup_winner_id
        await self._set_qualified_players(cup, data.qualified_player_ids)
        await self._session.commit()
        await self._session.refresh(cup)
        return cup

    async def patch(self, cup_id: int, data: YearlyCupPatchRequest) -> YearlyCup:
        cup = await self.get(cup_id)
        if data.year is not None:
            cup.year = data.year
        if data.name is not None:
            cup.name = data.name
        if data.starts_on is not None:
            cup.starts_on = data.starts_on
        if data.ends_on is not None:
            cup.ends_on = data.ends_on
        if data.player_of_the_year_id is not None:
            cup.player_of_the_year_id = data.player_of_the_year_id
        if data.cup_winner_id is not None:
            cup.cup_winner_id = data.cup_winner_id
        if data.qualified_player_ids is not None:
            await self._set_qualified_players(cup, data.qualified_player_ids)
        await self._session.commit()
        await self._session.refresh(cup)
        return cup

    async def delete(self, cup_id: int) -> None:
        cup = await self.get(cup_id)
        await self._session.delete(cup)
        await self._session.commit()
