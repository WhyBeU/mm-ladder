from __future__ import annotations

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import ConflictError, NotFoundError
from mm_ladder.interface.player import PlayerCreateRequest, PlayerPatchRequest, PlayerUpdateRequest
from mm_ladder.models.match import Match
from mm_ladder.models.player import VETERAN_THRESHOLD, Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.models.yearly_cup import YearlyCup, yearly_cup_qualification
from mm_ladder.schemas.player import PlayerRead
from mm_ladder.services.audit import AuditRecorder, diff_fields
from mm_ladder.services.player_matching import find_matching_player, register_alias_if_new


def _player_snapshot(p: Player) -> dict[str, object]:
    return {"display_name": p.display_name, "is_hidden": p.is_hidden, "aliases": list(p.aliases or [])}


def _player_label(p: Player) -> str:
    return f'Player "{p.display_name}"'


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
                Player.aliases,
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
                aliases=row.aliases or [],
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
            before = _player_snapshot(existing)
            register_alias_if_new(existing, data.display_name)
            changes = diff_fields(before, _player_snapshot(existing))
            if changes:
                AuditRecorder(self._session).record(
                    action="UPDATE",
                    entity_type="player",
                    entity_id=existing.id,
                    label=_player_label(existing),
                    changes=changes,
                )
            await self._session.commit()
            await self._session.refresh(existing)
            return existing

        player = Player(display_name=data.display_name, is_hidden=data.is_hidden)
        self._session.add(player)
        await self._session.flush()
        AuditRecorder(self._session).record(
            action="CREATE",
            entity_type="player",
            entity_id=player.id,
            label=_player_label(player),
            changes=[{"field": k, "old": None, "new": v} for k, v in _player_snapshot(player).items()],
        )
        await self._session.commit()
        await self._session.refresh(player)
        return player

    async def update(self, player_id: int, data: PlayerUpdateRequest) -> Player:
        player = await self.get(player_id)
        before = _player_snapshot(player)
        player.display_name = data.display_name
        player.is_hidden = data.is_hidden
        player.aliases = data.aliases
        self._record_update(player, before)
        await self._session.commit()
        await self._session.refresh(player)
        return player

    async def patch(self, player_id: int, data: PlayerPatchRequest) -> Player:
        player = await self.get(player_id)
        before = _player_snapshot(player)
        if data.display_name is not None:
            player.display_name = data.display_name
        if data.is_hidden is not None:
            player.is_hidden = data.is_hidden
        if data.aliases is not None:
            player.aliases = data.aliases
        self._record_update(player, before)
        await self._session.commit()
        await self._session.refresh(player)
        return player

    def _record_update(self, player: Player, before: dict[str, object]) -> None:
        changes = diff_fields(before, _player_snapshot(player))
        if changes:
            AuditRecorder(self._session).record(
                action="UPDATE",
                entity_type="player",
                entity_id=player.id,
                label=_player_label(player),
                changes=changes,
            )

    async def merge(self, keep_id: int, duplicate_ids: list[int]) -> Player:
        dup_ids = [d for d in dict.fromkeys(duplicate_ids) if d != keep_id]
        if keep_id in duplicate_ids:
            raise ConflictError("A player cannot be merged into itself")
        if not dup_ids:
            raise ConflictError("No duplicate players supplied")

        keeper = await self.get(keep_id)
        for dup_id in dup_ids:
            await self.get(dup_id)  # 404 if missing

        all_ids = [keep_id, *dup_ids]

        # Conflict: keeper + a duplicate both played the same tournament (uq_tp_tournament_player)
        result = await self._session.execute(
            select(TournamentParticipant.tournament_id).where(TournamentParticipant.player_id.in_(all_ids))
        )
        seen: set[int] = set()
        for (tournament_id,) in result.all():
            if tournament_id in seen:
                raise ConflictError("Players to merge share a tournament; cannot merge")
            seen.add(tournament_id)

        # Conflict: they faced each other in a match (ck_match_different_players)
        clash = await self._session.execute(
            select(Match.id).where(Match.player_a_id.in_(all_ids)).where(Match.player_b_id.in_(all_ids)).limit(1)
        )
        if clash.first() is not None:
            raise ConflictError("Players to merge faced each other; cannot merge")

        # Fold names + aliases into the keeper
        known = {keeper.display_name, *keeper.aliases}
        new_aliases: list[str] = []
        for dup_id in dup_ids:
            dup = await self._session.get(Player, dup_id)
            assert dup is not None
            for candidate in [dup.display_name, *dup.aliases]:
                if candidate not in known:
                    known.add(candidate)
                    new_aliases.append(candidate)
        keeper.aliases = [*keeper.aliases, *new_aliases]

        # Repoint participations and matches
        await self._session.execute(
            update(TournamentParticipant).where(TournamentParticipant.player_id.in_(dup_ids)).values(player_id=keep_id)
        )
        await self._session.execute(update(Match).where(Match.player_a_id.in_(dup_ids)).values(player_a_id=keep_id))
        await self._session.execute(update(Match).where(Match.player_b_id.in_(dup_ids)).values(player_b_id=keep_id))

        # Repoint award FKs
        await self._session.execute(
            update(Season).where(Season.champion_player_id.in_(dup_ids)).values(champion_player_id=keep_id)
        )
        await self._session.execute(
            update(YearlyCup).where(YearlyCup.player_of_the_year_id.in_(dup_ids)).values(player_of_the_year_id=keep_id)
        )
        await self._session.execute(
            update(YearlyCup).where(YearlyCup.cup_winner_id.in_(dup_ids)).values(cup_winner_id=keep_id)
        )

        # Repoint qualification M2M, dropping rows where the keeper already qualifies for that cup
        kept_cups = await self._session.execute(
            select(yearly_cup_qualification.c.yearly_cup_id).where(yearly_cup_qualification.c.player_id == keep_id)
        )
        kept_cup_ids = {row[0] for row in kept_cups.all()}
        dup_quals = await self._session.execute(
            select(yearly_cup_qualification.c.yearly_cup_id).where(yearly_cup_qualification.c.player_id.in_(dup_ids))
        )
        for (cup_id,) in dup_quals.all():
            if cup_id not in kept_cup_ids:
                await self._session.execute(
                    yearly_cup_qualification.insert().values(yearly_cup_id=cup_id, player_id=keep_id)
                )
                kept_cup_ids.add(cup_id)
        await self._session.execute(
            yearly_cup_qualification.delete().where(yearly_cup_qualification.c.player_id.in_(dup_ids))
        )

        # Delete the duplicates
        await self._session.execute(delete(Player).where(Player.id.in_(dup_ids)))

        AuditRecorder(self._session).record(
            action="UPDATE",
            entity_type="player",
            entity_id=keep_id,
            label=_player_label(keeper),
            changes=[{"field": "merged_player_ids", "old": None, "new": dup_ids}],
        )
        await self._session.commit()
        await self._session.refresh(keeper)
        return keeper

    async def delete(self, player_id: int) -> None:
        player = await self.get(player_id)
        count = await self._session.execute(select(func.count()).where(TournamentParticipant.player_id == player_id))
        if count.scalar_one() > 0:
            raise ConflictError("Player has tournament participations; merge instead of deleting")
        match_count = await self._session.execute(
            select(func.count()).where((Match.player_a_id == player_id) | (Match.player_b_id == player_id))
        )
        if match_count.scalar_one() > 0:
            raise ConflictError("Player has match history; merge instead of deleting")
        before = _player_snapshot(player)
        AuditRecorder(self._session).record(
            action="DELETE",
            entity_type="player",
            entity_id=player_id,
            label=_player_label(player),
            changes=[{"field": k, "old": v, "new": None} for k, v in before.items()],
        )
        await self._session.delete(player)
        await self._session.commit()
