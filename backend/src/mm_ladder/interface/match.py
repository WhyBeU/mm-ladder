from pydantic import BaseModel, Field


class MatchCreateRequest(BaseModel):
    player_a_id: int = Field(ge=1)
    player_b_id: int = Field(ge=1)
    games_a: int = Field(default=0, ge=0)
    games_b: int = Field(default=0, ge=0)
    game_draws: int = Field(default=0, ge=0)


class MatchUpdateRequest(BaseModel):
    player_a_id: int = Field(ge=1)
    player_b_id: int = Field(ge=1)
    games_a: int = Field(ge=0)
    games_b: int = Field(ge=0)
    game_draws: int = Field(ge=0)


class MatchPatchRequest(BaseModel):
    player_a_id: int | None = Field(default=None, ge=1)
    player_b_id: int | None = Field(default=None, ge=1)
    games_a: int | None = Field(default=None, ge=0)
    games_b: int | None = Field(default=None, ge=0)
    game_draws: int | None = Field(default=None, ge=0)
