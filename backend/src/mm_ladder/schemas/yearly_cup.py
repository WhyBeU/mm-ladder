from datetime import date, datetime

from pydantic import BaseModel

from .base import BaseReadSchema


class YearlyCupCreate(BaseModel):
    year: int
    name: str
    starts_on: date
    ends_on: date


class YearlyCupRead(BaseReadSchema):
    id: int
    year: int
    name: str
    starts_on: date
    ends_on: date
    player_of_the_year_id: int | None
    player_of_the_year_name: str | None
    cup_winner_id: int | None
    cup_winner_name: str | None
    qualified_player_ids: list[int]
    created_at: datetime
    updated_at: datetime
