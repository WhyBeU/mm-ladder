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
    created_at: datetime
    updated_at: datetime
