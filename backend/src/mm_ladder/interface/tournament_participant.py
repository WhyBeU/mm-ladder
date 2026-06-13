from pydantic import BaseModel


class TournamentParticipantCreateRequest(BaseModel):
    player_id: int
    match_wins: int = 0
    match_losses: int = 0
    match_draws: int = 0


class TournamentParticipantUpdateRequest(BaseModel):
    player_id: int
    match_wins: int
    match_losses: int
    match_draws: int


class TournamentParticipantPatchRequest(BaseModel):
    player_id: int | None = None
    match_wins: int | None = None
    match_losses: int | None = None
    match_draws: int | None = None
