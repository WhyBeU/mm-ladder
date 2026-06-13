from datetime import datetime

from pydantic import BaseModel

from .base import BaseReadSchema


class PlayerCreate(BaseModel):
    display_name: str
    is_hidden: bool = False


class PlayerRead(BaseReadSchema):
    id: int
    display_name: str
    is_hidden: bool
    is_veteran: bool = False
    aliases: list[str] = []
    season_champion_set_codes: list[str] = []
    player_of_the_year_cup_names: list[str] = []
    cup_champion_cup_names: list[str] = []
    created_at: datetime
    updated_at: datetime
