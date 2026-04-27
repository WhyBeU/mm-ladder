from datetime import date

from pydantic import BaseModel


class SeasonCreateRequest(BaseModel):
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = None
    qualifier_count: int = 2


class SeasonUpdateRequest(BaseModel):
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = None
    qualifier_count: int


class SeasonPatchRequest(BaseModel):
    name: str | None = None
    set_code: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    qualifier_count: int | None = None
