from datetime import date, datetime

from .base import BaseReadSchema


class TournamentRead(BaseReadSchema):
    id: int
    held_on: date
    season_id: int
    name: str | None
    notes: str | None
    eventlink_id: str | None
    has_match_detail: bool
    created_at: datetime
    updated_at: datetime
