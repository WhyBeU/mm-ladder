from datetime import date

from pydantic import BaseModel, Field, model_validator


class ImportCommitParticipant(BaseModel):
    # Exactly one of player_id (link existing) or create_name (make a new player) must be set.
    player_id: int | None = Field(default=None, ge=1)
    create_name: str | None = Field(default=None, max_length=255)
    wins: int = Field(ge=0, le=3)
    losses: int = Field(ge=0, le=3)
    draws: int = Field(ge=0, le=3)

    @model_validator(mode="after")
    def _one_target(self) -> "ImportCommitParticipant":
        if (self.player_id is None) == (not (self.create_name or "").strip()):
            raise ValueError("Each participant needs exactly one of player_id or create_name.")
        if self.wins + self.losses + self.draws != 3:
            raise ValueError("wins + losses + draws must equal 3 (a 3-round pod).")
        return self


class ImportCommitRequest(BaseModel):
    eventlink_id: str = Field(min_length=1, max_length=32)
    held_on: date
    season_id: int = Field(ge=1)
    name: str | None = Field(default=None, max_length=255)
    venue: str | None = Field(default=None, max_length=255)
    participants: list[ImportCommitParticipant] = Field(min_length=1)
