from datetime import date

from pydantic import BaseModel


class SeasonCreateRequest(BaseModel):
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = None
    qualifier_count: int = 2
    event_count: int = 12
    champion_player_id: int | None = None


class SeasonUpdateRequest(BaseModel):
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = None
    qualifier_count: int
    event_count: int
    champion_player_id: int | None = None


class SeasonPatchRequest(BaseModel):
    name: str | None = None
    set_code: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    qualifier_count: int | None = None
    event_count: int | None = None
    champion_player_id: int | None = None
