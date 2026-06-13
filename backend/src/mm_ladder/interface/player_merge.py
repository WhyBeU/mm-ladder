from pydantic import BaseModel


class PlayerMergeRequest(BaseModel):
    keep_id: int
    duplicate_ids: list[int]
