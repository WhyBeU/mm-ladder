from datetime import date

from pydantic import BaseModel


class YearlyCupCreateRequest(BaseModel):
    year: int
    name: str
    starts_on: date
    ends_on: date


class YearlyCupUpdateRequest(BaseModel):
    year: int
    name: str
    starts_on: date
    ends_on: date


class YearlyCupPatchRequest(BaseModel):
    year: int | None = None
    name: str | None = None
    starts_on: date | None = None
    ends_on: date | None = None
