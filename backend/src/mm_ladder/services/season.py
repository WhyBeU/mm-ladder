from collections.abc import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.season import SeasonCreateRequest, SeasonPatchRequest, SeasonUpdateRequest
from mm_ladder.models.season import Season


class SeasonService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self) -> Sequence[Season]:
        result = await self._session.execute(select(Season))
        return result.scalars().all()

    async def get(self, season_id: int) -> Season:
        season = await self._session.get(Season, season_id)
        if season is None:
            raise NotFoundError("Season", season_id)
        return season

    async def create(self, data: SeasonCreateRequest) -> Season:
        season = Season(
            name=data.name,
            set_code=data.set_code,
            starts_on=data.starts_on,
            ends_on=data.ends_on,
            yearly_cup_id=data.yearly_cup_id,
            qualifier_count=data.qualifier_count,
            event_count=data.event_count,
            champion_player_id=data.champion_player_id,
        )
        self._session.add(season)
        await self._session.commit()
        await self._session.refresh(season)
        return season

    async def update(self, season_id: int, data: SeasonUpdateRequest) -> Season:
        season = await self.get(season_id)
        season.name = data.name
        season.set_code = data.set_code
        season.starts_on = data.starts_on
        season.ends_on = data.ends_on
        season.yearly_cup_id = data.yearly_cup_id
        season.qualifier_count = data.qualifier_count
        season.event_count = data.event_count
        season.champion_player_id = data.champion_player_id
        await self._session.commit()
        await self._session.refresh(season)
        return season

    async def patch(self, season_id: int, data: SeasonPatchRequest) -> Season:
        season = await self.get(season_id)
        if data.name is not None:
            season.name = data.name
        if data.set_code is not None:
            season.set_code = data.set_code
        if data.starts_on is not None:
            season.starts_on = data.starts_on
        if data.ends_on is not None:
            season.ends_on = data.ends_on
        if data.qualifier_count is not None:
            season.qualifier_count = data.qualifier_count
        if data.event_count is not None:
            season.event_count = data.event_count
        if data.champion_player_id is not None:
            season.champion_player_id = data.champion_player_id
        await self._session.commit()
        await self._session.refresh(season)
        return season

    async def delete(self, season_id: int) -> None:
        season = await self.get(season_id)
        await self._session.delete(season)
        await self._session.commit()
