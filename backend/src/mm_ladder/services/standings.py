from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.errors import NotFoundError
from mm_ladder.models.player import Player
from mm_ladder.models.season import Season
from mm_ladder.models.tournament import Tournament
from mm_ladder.models.tournament_participant import TournamentParticipant
from mm_ladder.schemas.standings import SeasonStandingRead


class StandingsService:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_season_standings(self, season_id: int) -> list[SeasonStandingRead]:
        season = await self._session.get(Season, season_id)
        if season is None:
            raise NotFoundError("Season", season_id)

        result = await self._session.execute(
            select(Tournament).where(Tournament.season_id == season_id).order_by(Tournament.held_on, Tournament.id)
        )
        tournaments = list(result.scalars().all())
        if not tournaments:
            return []

        tournament_ids = [t.id for t in tournaments]

        result = await self._session.execute(
            select(TournamentParticipant, Player)
            .join(Player, Player.id == TournamentParticipant.player_id)
            .where(TournamentParticipant.tournament_id.in_(tournament_ids))
            .where(Player.is_hidden.is_(False))
        )
        rows = result.all()

        by_player: dict[int, list[tuple[TournamentParticipant, Player]]] = defaultdict(list)
        player_names: dict[int, str] = {}
        for tp, p in rows:
            by_player[p.id].append((tp, p))
            player_names[p.id] = p.display_name

        event_count = season.event_count
        comp_avg_n = season.comp_avg_n

        stats_list: list[dict[str, object]] = []
        for player_id, parts in by_player.items():
            wins = sum(tp.match_wins for tp, _ in parts)
            losses = sum(tp.match_losses for tp, _ in parts)
            draws = sum(tp.match_draws for tp, _ in parts)
            total_matches = wins + losses + draws
            points = sum(tp.points for tp, _ in parts)
            trophies = sum(1 for tp, _ in parts if tp.points == 9)

            by_tournament = {tp.tournament_id: tp.points for tp, _ in parts}
            per_event_scores: list[int | None] = [by_tournament.get(t.id) for t in tournaments[:event_count]]
            while len(per_event_scores) < event_count:
                per_event_scores.append(None)

            non_null_sorted = sorted([s for s in per_event_scores if s is not None], reverse=True)
            comp_avg: float | None = sum(non_null_sorted[:comp_avg_n]) / comp_avg_n if non_null_sorted else None

            stats_list.append(
                {
                    "player_id": player_id,
                    "display_name": player_names[player_id],
                    "tournaments_played": len(parts),
                    "points": points,
                    "match_wins": wins,
                    "match_losses": losses,
                    "match_draws": draws,
                    "win_pct": wins / total_matches if total_matches > 0 else 0.0,
                    "avg_pts": points / len(parts),
                    "comp_avg": comp_avg,
                    "comp_avg_n": comp_avg_n,
                    "trophies": trophies,
                    "per_event_scores": per_event_scores,
                }
            )

        stats_list.sort(
            key=lambda d: (
                d["comp_avg"] if d["comp_avg"] is not None else float("-inf"),
                d["points"],
            ),
            reverse=True,
        )

        return [SeasonStandingRead(rank=rank, **d) for rank, d in enumerate(stats_list, 1)]  # type: ignore[arg-type]
