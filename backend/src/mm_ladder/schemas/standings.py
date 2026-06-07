from pydantic import BaseModel


class SeasonStandingRead(BaseModel):
    rank: int
    player_id: int
    display_name: str
    tournaments_played: int
    points: int
    match_wins: int
    match_losses: int
    match_draws: int
    win_pct: float
    avg_pts: float
    comp_avg: float | None
    comp_avg_n: int
    trophies: int
    per_event_scores: list[int | None]
    is_veteran: bool = False
