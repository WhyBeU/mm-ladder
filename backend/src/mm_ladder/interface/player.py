from pydantic import BaseModel


class PlayerCreateRequest(BaseModel):
    display_name: str
    is_hidden: bool = False


class PlayerUpdateRequest(BaseModel):
    display_name: str
    is_hidden: bool


class PlayerPatchRequest(BaseModel):
    display_name: str | None = None
    is_hidden: bool | None = None
