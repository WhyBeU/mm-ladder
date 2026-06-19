from datetime import datetime

from pydantic import BaseModel

from .base import BaseReadSchema


class PodRegistrationStateRead(BaseReadSchema):
    id: int
    status: str
    generated_at: datetime | None
    last_activity_at: datetime
    created_at: datetime


class PodFormatRead(BaseReadSchema):
    id: int
    ordinal: int
    name: str
    season_id: int | None
    created_at: datetime


class PodSignupRead(BaseReadSchema):
    id: int
    player_id: int | None
    display_name: str
    is_extra: bool
    present: bool
    format_id: int | None
    pod_id: int | None
    seat: int | None
    created_at: datetime


class PodPodRead(BaseReadSchema):
    id: int
    format_id: int | None
    ordinal: int
    code: str | None
    created_at: datetime


class PodEventRead(BaseReadSchema):
    id: int
    kind: str
    message: str
    created_at: datetime


class BoardRead(BaseModel):
    state: PodRegistrationStateRead
    formats: list[PodFormatRead]
    signups: list[PodSignupRead]
    pods: list[PodPodRead]
    events: list[PodEventRead]
