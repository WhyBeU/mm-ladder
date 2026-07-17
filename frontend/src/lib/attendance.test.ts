import { describe, it, expect } from "vitest";
import { buildAttendanceSeries, rollingAverage } from "./attendance";
import type { MMLEvent, Pod } from "./types";

function pod(id: number): Pod {
  return { id, name: "", participant_count: 0, has_match_detail: false };
}

function event(number: number, seasonId: number, heldOn: string, podIds: number[]): MMLEvent {
  return { id: `e${number}`, season_id: seasonId, held_on: heldOn, number, pods: podIds.map(pod) };
}

const seasons = [
  { id: 1, set_code: "MID", keyrune: "mid", name: "Midnight Hunt", yearly_cup_id: 10 },
  { id: 2, set_code: "DMU", keyrune: "dmu", name: "Dominaria United", yearly_cup_id: 11 },
  { id: 3, set_code: "ONE", keyrune: "one", name: "Phyrexia", yearly_cup_id: null },
];
const cups = [
  { id: 10, year: 2024, name: "Cup 2024" },
  { id: 11, year: 2025, name: "Cup 2025" },
];

// tournament_id -> attendance rows
const participants = [
  ...Array(8).fill({ tournament_id: 100 }),
  ...Array(8).fill({ tournament_id: 101 }),
  ...Array(6).fill({ tournament_id: 102 }),
  ...Array(7).fill({ tournament_id: 103 }),
];

const events = [
  event(1, 1, "2024-01-01", [100]),
  event(2, 1, "2024-01-08", [101, 102]),
  event(3, 2, "2024-02-05", [103]),
  event(4, 3, "2024-03-04", [104]), // no participants -> attendance 0
];

describe("buildAttendanceSeries", () => {
  it("sums pod participant counts per week", () => {
    const { points, maxAttendance } = buildAttendanceSeries(events, participants, seasons, cups);
    expect(points.map((p) => p.attendance)).toEqual([8, 14, 7, 0]);
    expect(maxAttendance).toBe(14);
  });

  it("marks each season's first event", () => {
    const { seasonMarkers } = buildAttendanceSeries(events, participants, seasons, cups);
    expect(seasonMarkers).toEqual([
      { seasonId: 1, setCode: "MID", keyrune: "mid", name: "Midnight Hunt", firstIndex: 0 },
      { seasonId: 2, setCode: "DMU", keyrune: "dmu", name: "Dominaria United", firstIndex: 2 },
      { seasonId: 3, setCode: "ONE", keyrune: "one", name: "Phyrexia", firstIndex: 3 },
    ]);
  });

  it("groups consecutive events into cup bands, un-cup'd as '—'", () => {
    const { cupBands } = buildAttendanceSeries(events, participants, seasons, cups);
    expect(cupBands).toEqual([
      { year: 2024, label: "2024", startIndex: 0, endIndex: 1 },
      { year: 2025, label: "2025", startIndex: 2, endIndex: 2 },
      { year: null, label: "—", startIndex: 3, endIndex: 3 },
    ]);
  });

  it("sorts events chronologically before building", () => {
    const shuffled = [events[2], events[0], events[3], events[1]];
    const { points } = buildAttendanceSeries(shuffled, participants, seasons, cups);
    expect(points.map((p) => p.eventNumber)).toEqual([1, 2, 3, 4]);
  });
});

describe("rollingAverage", () => {
  it("averages what's available before the window fills, then trails", () => {
    // window 4 over [8, 14, 7, 0, 10]
    expect(rollingAverage([8, 14, 7, 0, 10], 4)).toEqual([
      8, // [8]
      11, // [8,14]
      (8 + 14 + 7) / 3, // [8,14,7]
      (8 + 14 + 7 + 0) / 4, // [8,14,7,0]
      (14 + 7 + 0 + 10) / 4, // [14,7,0,10]
    ]);
  });

  it("returns an empty array for no data", () => {
    expect(rollingAverage([], 4)).toEqual([]);
  });
});
