from datetime import date

from pydantic import BaseModel, Field


class YearlyCupCreateRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    name: str = Field(min_length=1, max_length=255)
    starts_on: date
    ends_on: date
    player_of_the_year_id: int | None = Field(default=None, ge=1)
    cup_winner_id: int | None = Field(default=None, ge=1)
    qualified_player_ids: list[int] = []


class YearlyCupUpdateRequest(BaseModel):
    year: int = Field(ge=2000, le=2100)
    name: str = Field(min_length=1, max_length=255)
    starts_on: date
    ends_on: date
    player_of_the_year_id: int | None = Field(default=None, ge=1)
    cup_winner_id: int | None = Field(default=None, ge=1)
    qualified_player_ids: list[int] = []


class YearlyCupPatchRequest(BaseModel):
    year: int | None = Field(default=None, ge=2000, le=2100)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    starts_on: date | None = None
    ends_on: date | None = None
    player_of_the_year_id: int | None = Field(default=None, ge=1)
    cup_winner_id: int | None = Field(default=None, ge=1)
    qualified_player_ids: list[int] | None = None
