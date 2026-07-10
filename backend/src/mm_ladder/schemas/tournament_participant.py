from datetime import datetime

from .base import BaseReadSchema


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
