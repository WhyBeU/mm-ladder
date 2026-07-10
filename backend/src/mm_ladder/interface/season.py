from datetime import date
from typing import Literal

from pydantic import BaseModel, Field

QualifyingType = Literal["POINTS", "BEST"]


class SeasonCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    set_code: str = Field(min_length=1, max_length=10)
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = Field(default=None, ge=1)
    qualifier_count: int = Field(default=2, ge=0)
    event_count: int = Field(default=12, ge=1)
    champion_player_id: int | None = Field(default=None, ge=1)


class SeasonUpdateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    set_code: str = Field(min_length=1, max_length=10)
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None = Field(default=None, ge=1)
    qualifier_count: int = Field(ge=0)
    event_count: int = Field(ge=1)
    champion_player_id: int | None = Field(default=None, ge=1)


class SeasonPatchRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    set_code: str | None = Field(default=None, min_length=1, max_length=10)
    starts_on: date | None = None
    ends_on: date | None = None
    yearly_cup_id: int | None = Field(default=None, ge=1)
    qualifier_count: int | None = Field(default=None, ge=0)
    event_count: int | None = Field(default=None, ge=1)
    qualifying_type: QualifyingType | None = None
    champion_player_id: int | None = Field(default=None, ge=1)
