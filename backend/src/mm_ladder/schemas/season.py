from datetime import date, datetime

from pydantic import BaseModel

from .base import BaseReadSchema


class SeasonCreate(BaseModel):
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = None
    qualifier_count: int = 2


class SeasonRead(BaseReadSchema):
    id: int
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None
    qualifier_count: int
    created_at: datetime
    updated_at: datetime
