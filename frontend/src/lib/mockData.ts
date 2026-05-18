import type { YearlyCup, Season, MMLEvent, Player, StandingEntry } from "./types";

export const yearlyCups: YearlyCup[] = [
  { id: 1, year: 2026, name: "2026 Magic Mates Cup", starts_on: "2026-01-05", ends_on: "2026-12-31", is_current: true },
  { id: 0, year: 2025, name: "2025 Magic Mates Cup", starts_on: "2025-01-06", ends_on: "2025-12-29", is_current: false },
];

export const seasons: Season[] = [
  { id: 1, name: "Bloomburrow",               set_code: "BLB", keyrune: "blb", starts_on: "2026-01-05", ends_on: "2026-02-23", yearly_cup_id: 1, qualifier_count: 2, is_current: false },
  { id: 2, name: "Duskmourn",                 set_code: "DSK", keyrune: "dsk", starts_on: "2026-02-24", ends_on: "2026-04-19", yearly_cup_id: 1, qualifier_count: 2, is_current: false },
  { id: 3, name: "Strixhaven",                set_code: "STX", keyrune: "stx", starts_on: "2026-04-20", ends_on: "2026-06-15", yearly_cup_id: 1, qualifier_count: 2, is_current: true  },
  { id: 4, name: "Edge of Eternities",        set_code: "EOE", keyrune: "eoe", starts_on: "2026-06-16", ends_on: "2026-08-10", yearly_cup_id: 1, qualifier_count: 2, is_current: false },
  { id: 5, name: "The Lost Caverns of Ixalan",set_code: "LCI", keyrune: "lci", starts_on: "2025-11-01", ends_on: "2025-12-31", yearly_cup_id: 0, qualifier_count: 2, is_current: false },
];

const playerNames = [
  "Yurk-Wei Xu", "Quinci Cohen", "Samuel Maher", "Jim Diment", "Carlos Pacheco",
  "Alex Kwong", "Chris North", "Felix Tonkin", "Caleb House", "Yoann Buratti",
  "Lyndon Maher", "Andrew Mcroberts", "Adrian Walker", "Damon Merry", "Kon Kabilafkas",
  "Priya Nair", "Marcus Chen", "Eleanor Grey", "Rohan Patel", "Sasha Volkov",
  "Tomás Reyes", "Wren Ashford", "Bea Halloran", "Naomi Park", "Tariq Bashir",
  "Clio Marsden", "Jonas Lindqvist", "Mira Otieno", "Devon Cole", "Hana Watanabe",
];
export const players: Player[] = playerNames.map((n, i) => ({ id: i + 1, display_name: n, is_hidden: false }));

export const events: MMLEvent[] = [
  { id: "e141", season_id: 3, held_on: "2026-04-20", number: 141, pods: [
    { id: 301, name: "MMM #141", participant_count: 12, has_match_detail: true },
  ]},
  { id: "e142", season_id: 3, held_on: "2026-04-27", number: 142, pods: [
    { id: 302, name: "MMM #142 · A", participant_count: 10, has_match_detail: true },
    { id: 303, name: "MMM #142 · B", participant_count:  8, has_match_detail: true },
  ]},
  { id: "e143", season_id: 3, held_on: "2026-05-04", number: 143, pods: [
    { id: 304, name: "MMM #143", participant_count: 14, has_match_detail: true },
  ]},
  { id: "e144", season_id: 3, held_on: "2026-05-11", number: 144, pods: [
    { id: 305, name: "MMM #144", participant_count: 11, has_match_detail: false },
  ]},
  { id: "e145", season_id: 3, held_on: "2026-05-18", number: 145, pods: [
    { id: 306, name: "MMM #145", participant_count: 13, has_match_detail: true },
  ]},
  { id: "e146", season_id: 3, held_on: "2026-05-25", number: 146, pods: [
    { id: 307, name: "MMM #146", participant_count: 12, has_match_detail: true },
  ]},
];

interface RawRow {
  player_id: number;
  w: number; l: number; d: number; t: number;
  prev_rank: number;
  attended: (0 | 1)[];
}

const seasonStandings: RawRow[] = [
  { player_id:  1, w: 18, l:  4, d: 2, t: 6, prev_rank:  1, attended: [1,1,1,1,1,1] },
  { player_id:  2, w: 17, l:  5, d: 2, t: 6, prev_rank:  3, attended: [1,1,1,1,1,1] },
  { player_id:  3, w: 16, l:  5, d: 3, t: 6, prev_rank:  2, attended: [1,1,1,1,1,1] },
  { player_id:  4, w: 15, l:  6, d: 2, t: 6, prev_rank:  5, attended: [1,1,1,1,1,1] },
  { player_id:  5, w: 14, l:  7, d: 2, t: 6, prev_rank:  4, attended: [1,1,1,1,1,1] },
  { player_id:  6, w: 13, l:  7, d: 4, t: 6, prev_rank:  6, attended: [1,1,1,1,1,1] },
  { player_id:  7, w: 13, l:  8, d: 2, t: 6, prev_rank:  9, attended: [1,1,0,1,1,1] },
  { player_id:  8, w: 12, l:  8, d: 4, t: 6, prev_rank:  7, attended: [1,1,1,1,1,1] },
  { player_id:  9, w: 12, l:  9, d: 2, t: 6, prev_rank:  8, attended: [0,1,1,1,1,1] },
  { player_id: 10, w: 11, l:  9, d: 3, t: 5, prev_rank: 12, attended: [1,1,0,1,1,1] },
  { player_id: 11, w: 11, l: 10, d: 2, t: 5, prev_rank: 11, attended: [1,1,1,1,0,1] },
  { player_id: 12, w: 10, l: 10, d: 3, t: 5, prev_rank: 10, attended: [1,1,1,1,1,0] },
  { player_id: 13, w: 10, l: 11, d: 2, t: 5, prev_rank: 14, attended: [1,1,1,0,1,1] },
  { player_id: 14, w:  9, l: 11, d: 4, t: 5, prev_rank: 13, attended: [1,1,0,1,1,1] },
  { player_id: 15, w:  9, l: 12, d: 2, t: 5, prev_rank: 15, attended: [0,1,1,1,1,1] },
  { player_id: 16, w:  8, l: 10, d: 3, t: 4, prev_rank: 17, attended: [1,1,0,0,1,1] },
  { player_id: 17, w:  8, l: 11, d: 2, t: 4, prev_rank: 16, attended: [1,1,1,0,0,1] },
  { player_id: 18, w:  7, l: 11, d: 3, t: 4, prev_rank: 19, attended: [0,1,1,1,0,1] },
  { player_id: 19, w:  7, l: 12, d: 2, t: 4, prev_rank: 18, attended: [1,0,1,1,1,0] },
  { player_id: 20, w:  6, l: 11, d: 3, t: 3, prev_rank: 20, attended: [1,1,0,0,1,0] },
  { player_id: 21, w:  6, l: 12, d: 2, t: 3, prev_rank: 22, attended: [1,0,1,0,1,0] },
  { player_id: 22, w:  5, l: 11, d: 3, t: 3, prev_rank: 21, attended: [0,1,0,1,1,0] },
  { player_id: 23, w:  5, l: 12, d: 2, t: 3, prev_rank: 24, attended: [1,1,0,0,0,1] },
  { player_id: 24, w:  4, l: 11, d: 3, t: 3, prev_rank: 23, attended: [0,0,1,1,1,0] },
  { player_id: 25, w:  4, l: 12, d: 2, t: 3, prev_rank: 25, attended: [1,0,0,1,1,0] },
  { player_id: 26, w:  3, l:  9, d: 2, t: 2, prev_rank: 27, attended: [0,1,0,1,0,0] },
  { player_id: 27, w:  3, l: 10, d: 1, t: 2, prev_rank: 26, attended: [1,0,0,0,1,0] },
  { player_id: 28, w:  2, l:  7, d: 2, t: 2, prev_rank: 28, attended: [0,1,1,0,0,0] },
  { player_id: 29, w:  2, l:  8, d: 1, t: 1, prev_rank: 30, attended: [1,0,0,0,0,0] },
  { player_id: 30, w:  1, l:  6, d: 1, t: 1, prev_rank: 29, attended: [0,0,1,0,0,0] },
];

function computeStandings(rows: RawRow[]): StandingEntry[] {
  const out = rows.map(s => {
    const player = players.find(p => p.id === s.player_id)!;
    const points = s.w * 3 + s.d;
    const totalMatches = s.w + s.l + s.d;
    const win_pct = totalMatches ? s.w / totalMatches : 0;
    const avg_pts = s.t ? points / s.t : 0;
    const attendedCount = s.attended.reduce((a: number, b: number) => a + b, 0);
    const perAttended = attendedCount ? points / attendedCount : 0;
    const per_event_points: (number | null)[] = s.attended.map((a, i) =>
      a ? Math.round(perAttended + (i % 3 === 0 ? 1 : i % 3 === 2 ? -1 : 0)) : null
    );
    const streak = s.attended.slice().reverse().filter(a => a).slice(0, 5).map((_, i) => {
      const r = ((s.player_id + i) % 5);
      return r < 3 ? "W" : r === 3 ? "L" : "D";
    }).join("");
    const trophies = per_event_points.filter((v): v is number => v !== null && v >= 9).length;
    return {
      player_id: s.player_id,
      display_name: player.display_name,
      match_wins: s.w, match_losses: s.l, match_draws: s.d,
      tournaments_played: s.t,
      points, win_pct, avg_pts, trophies,
      prev_rank: s.prev_rank, streak,
      per_event_points, attended: s.attended,
      rank: 0, delta: 0,
    };
  });
  out.sort((a, b) => b.points - a.points || b.win_pct - a.win_pct || b.match_wins - a.match_wins);
  out.forEach((r, i) => { r.rank = i + 1; r.delta = r.prev_rank - r.rank; });
  return out;
}

export const standings = computeStandings(seasonStandings);

export const allTimeStandings = computeStandings(seasonStandings.map(s => ({
  ...s,
  w: s.w + Math.floor(s.w * 1.8),
  l: s.l + Math.floor(s.l * 1.6),
  d: s.d + Math.floor(s.d * 1.5),
  t: s.t + 12 + (s.player_id % 5),
  attended: [...s.attended, ...s.attended, ...s.attended] as (0 | 1)[],
})));

export const cupStandings = computeStandings(seasonStandings.map(s => ({
  ...s,
  w: s.w + Math.floor(s.w * 0.6),
  l: s.l + Math.floor(s.l * 0.5),
  d: s.d + Math.floor(s.d * 0.4),
  t: s.t + 6,
  attended: [...s.attended, 1,1,1,1,1,1] as (0 | 1)[],
})));

export function eventStandings(eventId: string): StandingEntry[] {
  const event = events.find(e => e.id === eventId);
  if (!event) return [];
  const podSize = event.pods.reduce((s, p) => s + p.participant_count, 0);
  const sample = standings.slice(0, podSize);
  return computeStandings(sample.map((p, i) => ({
    player_id: p.player_id,
    w: 3 - Math.min(3, Math.floor(i / 3)),
    l: Math.min(3, Math.floor(i / 3)),
    d: i % 4 === 3 ? 1 : 0,
    t: 1, prev_rank: i + 1,
    attended: [1] as (0 | 1)[],
  })));
}

export function podStandings(podId: number): StandingEntry[] {
  let pod: { id: number; name: string; participant_count: number; has_match_detail: boolean } | null = null;
  for (const e of events) {
    for (const p of e.pods) {
      if (p.id === podId) { pod = p; break; }
    }
    if (pod) break;
  }
  if (!pod) return [];
  const sample = standings.slice(0, pod.participant_count);
  return computeStandings(sample.map((p, i) => ({
    player_id: p.player_id,
    w: 3 - Math.min(3, Math.floor(i / 3)),
    l: Math.min(3, Math.floor(i / 3)),
    d: i % 4 === 3 ? 1 : 0,
    t: 1, prev_rank: i + 1,
    attended: [1] as (0 | 1)[],
  })));
}
