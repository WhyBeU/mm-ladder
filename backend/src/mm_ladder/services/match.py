from collections.abc import Sequence

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.interface.match import MatchCreateRequest, MatchPatchRequest, MatchUpdateRequest
from mm_ladder.models.match import Match
from mm_ladder.models.tournament import Tournament
from mm_ladder.services.audit import AuditRecorder, diff_fields


def _match_snapshot(m: Match) -> dict[str, object]:
    return {
        "player_a_id": m.player_a_id,
        "player_b_id": m.player_b_id,
        "games_a": m.games_a,
        "games_b": m.games_b,
        "game_draws": m.game_draws,
    }


def _match_label(m: Match) -> str:
    return f"Match #{m.id} (t{m.tournament_id})"


class MatchService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list(self, tournament_id: int) -> Sequence[Match]:
        result = await self._session.execute(select(Match).where(Match.tournament_id == tournament_id))
        return result.scalars().all()

    async def get(self, tournament_id: int, match_id: int) -> Match:
        match = await self._session.get(Match, match_id)
        if match is None or match.tournament_id != tournament_id:
            raise NotFoundError("Match", match_id)
        return match

    async def create(self, tournament_id: int, data: MatchCreateRequest) -> Match:
        tournament = await self._session.get(Tournament, tournament_id)
        if tournament is None:
            raise NotFoundError("Tournament", tournament_id)
        match = Match(
            tournament_id=tournament_id,
            player_a_id=data.player_a_id,
            player_b_id=data.player_b_id,
            games_a=data.games_a,
            games_b=data.games_b,
            game_draws=data.game_draws,
        )
        self._session.add(match)
        if not tournament.has_match_detail:
            tournament.has_match_detail = True
        await self._session.flush()
        AuditRecorder(self._session).record(
            action="CREATE",
            entity_type="match",
            entity_id=match.id,
            label=_match_label(match),
            changes=[{"field": k, "old": None, "new": v} for k, v in _match_snapshot(match).items()],
        )
        await self._session.commit()
        await self._session.refresh(match)
        return match

    async def update(self, tournament_id: int, match_id: int, data: MatchUpdateRequest) -> Match:
        match = await self.get(tournament_id, match_id)
        before = _match_snapshot(match)
        match.player_a_id = data.player_a_id
        match.player_b_id = data.player_b_id
        match.games_a = data.games_a
        match.games_b = data.games_b
        match.game_draws = data.game_draws
        self._record_update(match, before)
        await self._session.commit()
        await self._session.refresh(match)
        return match

    def _record_update(self, match: Match, before: dict[str, object]) -> None:
        changes = diff_fields(before, _match_snapshot(match))
        if changes:
            AuditRecorder(self._session).record(
                action="UPDATE",
                entity_type="match",
                entity_id=match.id,
                label=_match_label(match),
                changes=changes,
            )

    async def patch(self, tournament_id: int, match_id: int, data: MatchPatchRequest) -> Match:
        match = await self.get(tournament_id, match_id)
        before = _match_snapshot(match)
        if data.player_a_id is not None:
            match.player_a_id = data.player_a_id
        if data.player_b_id is not None:
            match.player_b_id = data.player_b_id
        if data.games_a is not None:
            match.games_a = data.games_a
        if data.games_b is not None:
            match.games_b = data.games_b
        if data.game_draws is not None:
            match.game_draws = data.game_draws
        self._record_update(match, before)
        await self._session.commit()
        await self._session.refresh(match)
        return match

    async def delete(self, tournament_id: int, match_id: int) -> None:
        match = await self.get(tournament_id, match_id)
        AuditRecorder(self._session).record(
            action="DELETE",
            entity_type="match",
            entity_id=match_id,
            label=_match_label(match),
            changes=[{"field": k, "old": v, "new": None} for k, v in _match_snapshot(match).items()],
        )
        await self._session.delete(match)
        await self._session.flush()
        remaining = await self._session.scalar(select(func.count()).where(Match.tournament_id == tournament_id))
        if remaining == 0:
            tournament = await self._session.get(Tournament, tournament_id)
            if tournament is not None:
                tournament.has_match_detail = False
        await self._session.commit()
