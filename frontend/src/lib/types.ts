export type ManaCode = "W" | "U" | "B" | "R" | "G";
export type ScopeKind = "alltime" | "cup" | "season" | "event" | "pod";

export interface Scope {
  kind: ScopeKind;
  cupId?: number;
  seasonId?: number;
  eventId?: string;
  podId?: number;
}

export interface YearlyCup {
  id: number;
  year: number;
  name: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
}

export interface Season {
  id: number;
  name: string;
  set_code: string;
  keyrune: string;
  starts_on: string;
  ends_on: string;
  yearly_cup_id: number | null;
  qualifier_count: number;
  event_count: number;
  comp_avg_n: number;
  is_current: boolean;
}

export interface Pod {
  id: number;
  name: string;
  participant_count: number;
  has_match_detail: boolean;
}

export interface MMLEvent {
  id: string;
  season_id: number;
  held_on: string;
  number: number;
  pods: Pod[];
}

export interface Player {
  id: number;
  display_name: string;
  is_hidden: boolean;
}

export interface StandingEntry {
  player_id: number;
  display_name: string;
  match_wins: number;
  match_losses: number;
  match_draws: number;
  tournaments_played: number;
  points: number;
  win_pct: number;
  avg_pts: number;
  trophies: number;
  rank: number;
  delta: number;
  streak: string;
  per_event_points: (number | null)[];
  attended: (0 | 1)[];
  comp_avg?: number | null;
  comp_avg_n?: number;
}

export interface SeasonStats {
  events: number;
  pods: number;
  players: number;
  matches: number;
  matchesPerEvent: number;
  avgAttendance: number;
}
