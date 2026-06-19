from collections.abc import Sequence
from datetime import date

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.season import SeasonCreateRequest, SeasonPatchRequest, SeasonUpdateRequest
from mm_ladder.models.season import Season
from mm_ladder.services.audit import AuditRecorder, diff_fields


def _season_snapshot(s: Season) -> dict[str, object]:
    return {
        "name": s.name,
        "set_code": s.set_code,
        "starts_on": s.starts_on.isoformat(),
        "ends_on": s.ends_on.isoformat(),
        "yearly_cup_id": s.yearly_cup_id,
        "qualifier_count": s.qualifier_count,
        "event_count": s.event_count,
        "qualifying_type": s.qualifying_type,
        "champion_player_id": s.champion_player_id,
    }


def _season_label(s: Season) -> str:
    return f'Season "{s.name}"'


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

    async def current_season(self, today: date | None = None) -> Season | None:
        """The season covering ``today``, else the most recent by ``ends_on``, else None."""
        today = today or date.today()
        seasons = list(await self.list())
        if not seasons:
            return None
        covering = [s for s in seasons if s.starts_on <= today <= s.ends_on]
        if covering:
            return max(covering, key=lambda s: s.ends_on)
        return max(seasons, key=lambda s: s.ends_on)

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
        await self._session.flush()
        AuditRecorder(self._session).record(
            action="CREATE",
            entity_type="season",
            entity_id=season.id,
            label=_season_label(season),
            changes=[{"field": k, "old": None, "new": v} for k, v in _season_snapshot(season).items()],
        )
        await self._session.commit()
        await self._session.refresh(season)
        return season

    async def update(self, season_id: int, data: SeasonUpdateRequest) -> Season:
        season = await self.get(season_id)
        before = _season_snapshot(season)
        season.name = data.name
        season.set_code = data.set_code
        season.starts_on = data.starts_on
        season.ends_on = data.ends_on
        season.yearly_cup_id = data.yearly_cup_id
        season.qualifier_count = data.qualifier_count
        season.event_count = data.event_count
        season.champion_player_id = data.champion_player_id
        self._record_update(season, before)
        await self._session.commit()
        await self._session.refresh(season)
        return season

    def _record_update(self, season: Season, before: dict[str, object]) -> None:
        changes = diff_fields(before, _season_snapshot(season))
        if changes:
            AuditRecorder(self._session).record(
                action="UPDATE",
                entity_type="season",
                entity_id=season.id,
                label=_season_label(season),
                changes=changes,
            )

    async def patch(self, season_id: int, data: SeasonPatchRequest) -> Season:
        season = await self.get(season_id)
        before = _season_snapshot(season)
        if data.name is not None:
            season.name = data.name
        if data.set_code is not None:
            season.set_code = data.set_code
        if data.starts_on is not None:
            season.starts_on = data.starts_on
        if data.ends_on is not None:
            season.ends_on = data.ends_on
        if data.yearly_cup_id is not None:
            season.yearly_cup_id = data.yearly_cup_id
        if data.qualifier_count is not None:
            season.qualifier_count = data.qualifier_count
        if data.event_count is not None:
            season.event_count = data.event_count
        if data.qualifying_type is not None:
            season.qualifying_type = data.qualifying_type
        if data.champion_player_id is not None:
            season.champion_player_id = data.champion_player_id
        self._record_update(season, before)
        await self._session.commit()
        await self._session.refresh(season)
        return season

    async def delete(self, season_id: int) -> None:
        season = await self.get(season_id)
        AuditRecorder(self._session).record(
            action="DELETE",
            entity_type="season",
            entity_id=season_id,
            label=_season_label(season),
            changes=[{"field": k, "old": v, "new": None} for k, v in _season_snapshot(season).items()],
        )
        await self._session.delete(season)
        await self._session.commit()
