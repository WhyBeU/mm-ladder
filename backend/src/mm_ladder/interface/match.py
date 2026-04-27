from pydantic import BaseModel


class MatchCreateRequest(BaseModel):
    player_a_id: int
    player_b_id: int
    games_a: int = 0
    games_b: int = 0
    game_draws: int = 0


class MatchUpdateRequest(BaseModel):
    player_a_id: int
    player_b_id: int
    games_a: int
    games_b: int
    game_draws: int


class MatchPatchRequest(BaseModel):
    player_a_id: int | None = None
    player_b_id: int | None = None
    games_a: int | None = None
    games_b: int | None = None
    game_draws: int | None = None
