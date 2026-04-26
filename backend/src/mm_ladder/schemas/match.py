from datetime import datetime
from typing import Literal

from pydantic import BaseModel, computed_field

from .base import BaseReadSchema

MatchOutcome = Literal["A_WINS", "B_WINS", "DRAW"]


class MatchCreate(BaseModel):
    tournament_id: int
    player_a_id: int
    player_b_id: int
    games_a: int = 0
    games_b: int = 0
    game_draws: int = 0


class MatchRead(BaseReadSchema):
    id: int
    tournament_id: int
    player_a_id: int
    player_b_id: int
    games_a: int
    games_b: int
    game_draws: int
    created_at: datetime

    @computed_field
    @property
    def outcome(self) -> MatchOutcome:
        if self.games_a > self.games_b:
            return "A_WINS"
        if self.games_b > self.games_a:
            return "B_WINS"
        return "DRAW"
