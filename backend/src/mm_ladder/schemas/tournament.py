from datetime import date, datetime

from pydantic import BaseModel

from .base import BaseReadSchema


class TournamentCreate(BaseModel):
    held_on: date
    season_id: int
    name: str | None = None
    notes: str | None = None


class TournamentRead(BaseReadSchema):
    id: int
    held_on: date
    season_id: int
    name: str | None
    notes: str | None
    has_match_detail: bool
    created_at: datetime
    updated_at: datetime
