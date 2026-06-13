import type { Season, YearlyCup } from "@/lib/types";

export interface PlayerAwards {
  season_championships: { set_code: string; season_name: string }[];
  player_of_the_year_years: number[];
  cup_champion_years: number[];
}

export function buildPlayerAwards(cups: YearlyCup[], seasons: Season[]): Map<number, PlayerAwards> {
  const map = new Map<number, PlayerAwards>();
  const ensure = (id: number): PlayerAwards => {
    let a = map.get(id);
    if (!a) {
      a = { season_championships: [], player_of_the_year_years: [], cup_champion_years: [] };
      map.set(id, a);
    }
    return a;
  };
  for (const s of seasons) {
    if (s.champion_player_id != null) {
      ensure(s.champion_player_id).season_championships.push({ set_code: s.set_code, season_name: s.name });
    }
  }
  for (const c of cups) {
    if (c.player_of_the_year_id != null) ensure(c.player_of_the_year_id).player_of_the_year_years.push(c.year);
    if (c.cup_winner_id != null) ensure(c.cup_winner_id).cup_champion_years.push(c.year);
  }
  for (const a of map.values()) {
    a.player_of_the_year_years.sort((x, y) => y - x);
    a.cup_champion_years.sort((x, y) => y - x);
  }
  return map;
}
