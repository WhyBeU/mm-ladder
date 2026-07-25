from datetime import date

from pydantic import BaseModel


class SeasonChampionshipRead(BaseModel):
    set_code: str
    season_name: str


class PerEventRead(BaseModel):
    held_on: date
    points: int | None
    tournament_id: int | None


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
    per_event: list[PerEventRead]
    is_veteran: bool = False
    season_championships: list[SeasonChampionshipRead] = []
    player_of_the_year_years: list[int] = []
    cup_champion_years: list[int] = []
