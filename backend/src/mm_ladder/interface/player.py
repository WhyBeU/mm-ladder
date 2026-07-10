from pydantic import BaseModel, Field


class PlayerCreateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    is_hidden: bool = False


class PlayerUpdateRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=255)
    is_hidden: bool
    aliases: list[str] = []


class PlayerPatchRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=255)
    is_hidden: bool | None = None
    aliases: list[str] | None = None
