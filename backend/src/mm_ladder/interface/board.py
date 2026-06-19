from pydantic import BaseModel


class SignupCreateRequest(BaseModel):
    player_id: int | None = None
    display_name: str | None = None


class SignupPatchRequest(BaseModel):
    present: bool | None = None
    format_id: int | None = None


class FormatCreateRequest(BaseModel):
    season_id: int | None = None
    name: str | None = None


class FormatGenerateGroup(BaseModel):
    format_id: int
    seeding_label: str | None = None
    pods: list[list[int]]


class GenerateRequest(BaseModel):
    formats: list[FormatGenerateGroup]


class PodCodePatchRequest(BaseModel):
    code: str
