from datetime import date

from pydantic import BaseModel


class TournamentCreateRequest(BaseModel):
    held_on: date
    season_id: int
    name: str | None = None
    notes: str | None = None


class TournamentUpdateRequest(BaseModel):
    held_on: date
    season_id: int
    name: str | None = None
    notes: str | None = None


class TournamentPatchRequest(BaseModel):
    held_on: date | None = None
    season_id: int | None = None
    name: str | None = None
    notes: str | None = None
