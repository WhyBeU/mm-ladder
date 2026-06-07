export interface ApiYearlyCup {
  id: number
  year: number
  name: string
  starts_on: string
  ends_on: string
}

export interface ApiSeason {
  id: number
  name: string
  set_code: string
  starts_on: string
  ends_on: string
  yearly_cup_id: number | null
  qualifier_count: number
  event_count: number
  comp_avg_n: number
  qualifying_type: "POINTS" | "BEST"
}

export interface ApiTournament {
  id: number
  held_on: string
  season_id: number
  name: string | null
  notes: string | null
  has_match_detail: boolean
}

export interface ApiParticipant {
  id: number
  tournament_id: number
  player_id: number
  match_wins: number
  match_losses: number
  match_draws: number
  points: number
}

export interface ApiPlayer {
  id: number
  display_name: string
  is_hidden: boolean
  is_veteran: boolean
}

export interface ApiSeasonStanding {
  rank: number
  player_id: number
  display_name: string
  tournaments_played: number
  points: number
  match_wins: number
  match_losses: number
  match_draws: number
  win_pct: number
  avg_pts: number
  comp_avg: number | null
  comp_avg_n: number
  trophies: number
  per_event_scores: (number | null)[]
  is_veteran: boolean
}

const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`)
  return res.json() as Promise<T>
}

export const fetchYearlyCups = (): Promise<ApiYearlyCup[]> => get('/yearly-cups/')
export const fetchSeasons = (): Promise<ApiSeason[]> => get('/seasons/')
export const fetchTournaments = (): Promise<ApiTournament[]> => get('/tournaments/')
export const fetchPlayers = (): Promise<ApiPlayer[]> => get('/players/')
export const fetchTournamentParticipants = (id: number): Promise<ApiParticipant[]> =>
  get(`/tournaments/${id}/participants`)
export const fetchSeasonStandings = (seasonId: number): Promise<ApiSeasonStanding[]> =>
  get(`/seasons/${seasonId}/standings`)
