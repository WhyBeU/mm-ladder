from pydantic import BaseModel, Field


class TournamentParticipantCreateRequest(BaseModel):
    player_id: int = Field(ge=1)
    match_wins: int = Field(default=0, ge=0)
    match_losses: int = Field(default=0, ge=0)
    match_draws: int = Field(default=0, ge=0)


class TournamentParticipantUpdateRequest(BaseModel):
    player_id: int = Field(ge=1)
    match_wins: int = Field(ge=0)
    match_losses: int = Field(ge=0)
    match_draws: int = Field(ge=0)


class TournamentParticipantPatchRequest(BaseModel):
    player_id: int | None = Field(default=None, ge=1)
    match_wins: int | None = Field(default=None, ge=0)
    match_losses: int | None = Field(default=None, ge=0)
    match_draws: int | None = Field(default=None, ge=0)
