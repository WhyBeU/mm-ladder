from datetime import datetime

from pydantic import BaseModel

from .base import BaseReadSchema


class TournamentParticipantCreate(BaseModel):
    tournament_id: int
    player_id: int
    match_wins: int = 0
    match_losses: int = 0
    match_draws: int = 0


class TournamentParticipantRead(BaseReadSchema):
    id: int
    tournament_id: int
    player_id: int
    match_wins: int
    match_losses: int
    match_draws: int
    points: int
    created_at: datetime
    updated_at: datetime
