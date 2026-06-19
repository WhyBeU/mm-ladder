from collections.abc import AsyncGenerator
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from mm_ladder.services.audit import AuditService
from mm_ladder.services.board import BoardService
from mm_ladder.services.match import MatchService
from mm_ladder.services.player import PlayerService
from mm_ladder.services.season import SeasonService
from mm_ladder.services.standings import StandingsService
from mm_ladder.services.tournament import TournamentService
from mm_ladder.services.tournament_participant import TournamentParticipantService
from mm_ladder.services.yearly_cup import YearlyCupService


async def get_session(request: Request) -> AsyncGenerator[AsyncSession]:
    async with request.app.state.session_factory() as session:
        yield session


SessionDep = Annotated[AsyncSession, Depends(get_session)]


# Service dependency factories — wired to the session dep
def get_player_service(session: SessionDep) -> PlayerService:
    return PlayerService(session)


def get_yearly_cup_service(session: SessionDep) -> YearlyCupService:
    return YearlyCupService(session)


def get_season_service(session: SessionDep) -> SeasonService:
    return SeasonService(session)


def get_tournament_service(session: SessionDep) -> TournamentService:
    return TournamentService(session)


def get_participant_service(session: SessionDep) -> TournamentParticipantService:
    return TournamentParticipantService(session)


def get_match_service(session: SessionDep) -> MatchService:
    return MatchService(session)


def get_standings_service(session: SessionDep) -> StandingsService:
    return StandingsService(session)


def get_audit_service(session: SessionDep) -> AuditService:
    return AuditService(session)


def get_board_service(session: SessionDep) -> BoardService:
    return BoardService(session)


PlayerServiceDep = Annotated[PlayerService, Depends(get_player_service)]
YearlyCupServiceDep = Annotated[YearlyCupService, Depends(get_yearly_cup_service)]
SeasonServiceDep = Annotated[SeasonService, Depends(get_season_service)]
TournamentServiceDep = Annotated[TournamentService, Depends(get_tournament_service)]
ParticipantServiceDep = Annotated[TournamentParticipantService, Depends(get_participant_service)]
MatchServiceDep = Annotated[MatchService, Depends(get_match_service)]
StandingsServiceDep = Annotated[StandingsService, Depends(get_standings_service)]
AuditServiceDep = Annotated[AuditService, Depends(get_audit_service)]
BoardServiceDep = Annotated[BoardService, Depends(get_board_service)]
