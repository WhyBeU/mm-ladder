from datetime import date

from pydantic import BaseModel, Field


class TournamentCreateRequest(BaseModel):
    held_on: date
    season_id: int = Field(ge=1)
    name: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class TournamentUpdateRequest(BaseModel):
    held_on: date
    season_id: int = Field(ge=1)
    name: str | None = Field(default=None, max_length=255)
    notes: str | None = None


class TournamentPatchRequest(BaseModel):
    held_on: date | None = None
    season_id: int | None = Field(default=None, ge=1)
    name: str | None = Field(default=None, max_length=255)
    notes: str | None = None
