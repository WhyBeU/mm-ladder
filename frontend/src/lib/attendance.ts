// Pure attendance-over-time model for the all-time timeline. No React, no IO — unit-tested.

import type { MMLEvent, Season, YearlyCup } from "@/lib/types";

/** One event (week) on the timeline. */
export interface AttendancePoint {
  eventNumber: number;
  heldOn: string;
  /** Distinct players that week = participant rows across the event's pods. */
  attendance: number;
  seasonId: number;
}

/** A season's first event, for a start-of-season logo callout. */
export interface SeasonMarker {
  seasonId: number;
  setCode: string;
  keyrune: string;
  name: string;
  /** Index into `points` of the season's first event. */
  firstIndex: number;
}

/** A run of consecutive events belonging to one cup year (or none). */
export interface CupBand {
  year: number | null;
  label: string;
  startIndex: number;
  endIndex: number;
}

export interface AttendanceSeries {
  points: AttendancePoint[];
  seasonMarkers: SeasonMarker[];
  cupBands: CupBand[];
  maxAttendance: number;
}

type ParticipantLike = { tournament_id: number };
type SeasonLike = Pick<Season, "id" | "set_code" | "keyrune" | "name" | "yearly_cup_id">;
type CupLike = Pick<YearlyCup, "id" | "year" | "name">;

/**
 * Build the timeline series from already-fetched all-time data. Events are sorted
 * chronologically; attendance for a week sums the participant counts of that event's
 * pods. Season markers mark each season's first appearance; cup bands are maximal runs
 * of consecutive events sharing a `yearly_cup_id` (un-cup'd events form "—" bands).
 */
export function buildAttendanceSeries(
  events: MMLEvent[],
  participants: ParticipantLike[],
  seasons: SeasonLike[],
  yearlyCups: CupLike[],
): AttendanceSeries {
  const countByTournament = new Map<number, number>();
  for (const p of participants) {
    countByTournament.set(p.tournament_id, (countByTournament.get(p.tournament_id) ?? 0) + 1);
  }

  const ordered = [...events].sort((a, b) => a.held_on.localeCompare(b.held_on) || a.number - b.number);
  const seasonById = new Map(seasons.map((s) => [s.id, s]));
  const cupById = new Map(yearlyCups.map((c) => [c.id, c]));

  const points: AttendancePoint[] = ordered.map((e) => ({
    eventNumber: e.number,
    heldOn: e.held_on,
    attendance: e.pods.reduce((sum, pod) => sum + (countByTournament.get(pod.id) ?? 0), 0),
    seasonId: e.season_id,
  }));

  const seasonMarkers: SeasonMarker[] = [];
  const seenSeason = new Set<number>();
  ordered.forEach((e, i) => {
    if (seenSeason.has(e.season_id)) return;
    seenSeason.add(e.season_id);
    const s = seasonById.get(e.season_id);
    if (!s) return;
    seasonMarkers.push({ seasonId: s.id, setCode: s.set_code, keyrune: s.keyrune, name: s.name, firstIndex: i });
  });

  const cupBands: CupBand[] = [];
  let lastCupId: number | null | undefined;
  ordered.forEach((e, i) => {
    const cupId = seasonById.get(e.season_id)?.yearly_cup_id ?? null;
    if (i > 0 && cupId === lastCupId) {
      cupBands[cupBands.length - 1].endIndex = i;
    } else {
      const cup = cupId != null ? cupById.get(cupId) : undefined;
      cupBands.push({
        year: cup?.year ?? null,
        label: cup?.year != null ? String(cup.year) : "—",
        startIndex: i,
        endIndex: i,
      });
    }
    lastCupId = cupId;
  });

  const maxAttendance = points.reduce((m, p) => Math.max(m, p.attendance), 0);

  return { points, seasonMarkers, cupBands, maxAttendance };
}

/** Trailing moving average over `window` points. Early points average what's available. */
export function rollingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - window + 1), i + 1);
    return slice.reduce((sum, v) => sum + v, 0) / slice.length;
  });
}
