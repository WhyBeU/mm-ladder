from datetime import date

from pydantic import BaseModel


class ImportPreviewParticipant(BaseModel):
    raw_name: str
    normalized_name: str
    points: int
    wins: int
    losses: int
    draws: int
    player_id: int | None
    matched_name: str | None
    will_create: bool


class ImportPreview(BaseModel):
    eventlink_id: str
    pod_number: int
    held_on: date
    rounds: int
    venue: str | None
    suggested_season_id: int | None
    suggested_season_name: str | None
    suggested_name: str
    already_imported_tournament_id: int | None
    participants: list[ImportPreviewParticipant]


class ImportCommitResult(BaseModel):
    tournament_id: int
    name: str | None
    participant_count: int
    created_player_ids: list[int]
