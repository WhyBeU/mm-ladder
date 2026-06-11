from datetime import date

from pydantic import BaseModel


class YearlyCupCreateRequest(BaseModel):
    year: int
    name: str
    starts_on: date
    ends_on: date
    player_of_the_year_id: int | None = None
    cup_winner_id: int | None = None
    qualified_player_ids: list[int] = []


class YearlyCupUpdateRequest(BaseModel):
    year: int
    name: str
    starts_on: date
    ends_on: date
    player_of_the_year_id: int | None = None
    cup_winner_id: int | None = None
    qualified_player_ids: list[int] = []


class YearlyCupPatchRequest(BaseModel):
    year: int | None = None
    name: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
    player_of_the_year_id: int | None = None
    cup_winner_id: int | None = None
    qualified_player_ids: list[int] | None = None
