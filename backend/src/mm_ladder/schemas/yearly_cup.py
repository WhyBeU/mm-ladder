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
    created_at: datetime
    updated_at: datetime
