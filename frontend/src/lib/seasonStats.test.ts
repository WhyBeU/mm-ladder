import { describe, it, expect } from "vitest";
import { computeStats } from "./seasonStats";
import type { MMLEvent, PerEvent, Pod, StandingEntry } from "./types";

function pod(id: number): Pod {
  return { id, name: "", participant_count: 0, has_match_detail: false };
}

function event(number: number, heldOn: string, podIds: number[]): MMLEvent {
  return { id: `e${number}`, season_id: 1, held_on: heldOn, number, pods: podIds.map(pod) };
}

const DATES = ["2024-01-01", "2024-01-08"];

/** A standing that attended the given dates (by index into DATES) with 3 matches per night. */
function standing(playerId: number, attended: number[], wins = 2, losses = 1): StandingEntry {
  const nights = attended.length;
  const perEvent: PerEvent[] = DATES.map((d, i) => ({
    held_on: d,
    season_id: 1,
    points: attended.includes(i) ? 6 : null,
    tournament_id: attended.includes(i) ? 100 + i : null,
  }));
  return {
    player_id: playerId, display_name: `P${playerId}`,
    match_wins: wins * nights, match_losses: losses * nights, match_draws: 0,
    tournaments_played: nights, points: 6 * nights, win_pct: 0, avg_pts: 0, trophies: 0,
    rank: 0, delta: 0, streak: "", per_event: perEvent,
  };
}

describe("computeStats", () => {
  // Monday 1: two pods. Monday 2: one pod.
  const events = [event(1, DATES[0], [100, 101]), event(2, DATES[1], [102])];

  it("averages attendance per Monday, not per pod", () => {
    // 16 players on Monday 1 (two pods of 8), 8 of them back on Monday 2.
    const standings = [
      ...Array.from({ length: 8 }, (_, i) => standing(i + 1, [0, 1])),
      ...Array.from({ length: 8 }, (_, i) => standing(i + 9, [0])),
    ];
    const stats = computeStats(events, standings);
    expect(stats.events).toBe(2);
    expect(stats.pods).toBe(3);
    expect(stats.players).toBe(16);
    expect(stats.avgAttendance).toBe((16 + 8) / 2);
  });

  it("counts a player in two pods on the same Monday once", () => {
    // Player 1 played both pods on Monday 1 — per_event folds that into one attended night.
    const twoPods = { ...standing(1, [0]), tournaments_played: 2 };
    const stats = computeStats(events, [twoPods, standing(2, [0, 1])]);
    expect(stats.avgAttendance).toBe((2 + 1) / 2);
  });

  it("averages matches per Monday, not per pod", () => {
    // 4 players x 2 nights x 3 matches = 24 player-matches = 12 matches over 2 Mondays.
    const standings = Array.from({ length: 4 }, (_, i) => standing(i + 1, [0, 1]));
    const stats = computeStats(events, standings);
    expect(stats.matches).toBe(12);
    expect(stats.matchesPerEvent).toBe(6);
  });

  it("returns zero averages when nothing is in scope", () => {
    const stats = computeStats([], []);
    expect(stats.avgAttendance).toBe(0);
    expect(stats.matchesPerEvent).toBe(0);
  });
});
