from datetime import date, datetime

from .base import BaseReadSchema


class SeasonRead(BaseReadSchema):
    id: int
    name: str
    set_code: str
    starts_on: date
    ends_on: date
    yearly_cup_id: int | None
    qualifier_count: int
    event_count: int
    comp_avg_n: int
    qualifying_type: str
    champion_player_id: int | None
    champion_name: str | None
    created_at: datetime
    updated_at: datetime
