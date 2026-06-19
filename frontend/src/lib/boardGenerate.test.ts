import { describe, expect, it } from "vitest";
import { buildGenerateGroups, type SeedMetrics } from "./boardGenerate";
import type { ApiBoardFormat, ApiBoardSignup } from "./boardApi";

function fmt(id: number, ordinal: number, seasonId: number | null): ApiBoardFormat {
  return { id, ordinal, name: `F${id}`, season_id: seasonId, created_at: "" };
}

function signup(id: number, formatId: number, present: boolean, playerId: number | null = null, isExtra = false): ApiBoardSignup {
  return {
    id,
    player_id: playerId,
    display_name: `P${id}`,
    is_extra: isExtra,
    present,
    format_id: formatId,
    pod_id: null,
    seat: null,
    created_at: "",
  };
}

describe("buildGenerateGroups", () => {
  it("seeds a season-backed format by the chosen method", () => {
    const formats = [fmt(1, 1, 10)];
    const signups = [signup(1, 1, true, 100), signup(2, 1, true, 200)];
    const metrics = new Map<number, Map<number, SeedMetrics>>([
      [1, new Map([
        [100, { total: 3, average: 0, best: 0 }],
        [200, { total: 9, average: 0, best: 0 }],
      ])],
    ]);
    const groups = buildGenerateGroups(formats, signups, metrics, "Total");
    expect(groups).toHaveLength(1);
    expect(groups[0].format_id).toBe(1);
    expect(groups[0].seeding_label).toBe("Total");
    // strongest (player 200 / signup 2) seeds first
    expect(groups[0].pods[0][0]).toBe(2);
  });

  it("forces Random for an 'Other' (season-less) format regardless of method", () => {
    const formats = [fmt(2, 2, null)];
    const signups = [signup(5, 2, true), signup(6, 2, true)];
    const groups = buildGenerateGroups(formats, signups, new Map(), "Best");
    expect(groups[0].seeding_label).toBe("Random");
    // membership is preserved even though order is shuffled
    expect(groups[0].pods.flat().sort()).toEqual([5, 6]);
  });

  it("only includes present sign-ups in the matching format, and skips empty formats", () => {
    const formats = [fmt(1, 1, 10), fmt(2, 2, null)];
    const signups = [
      signup(1, 1, true),
      signup(2, 1, false), // not present -> excluded
      signup(3, 2, false), // format 2 has nobody present
    ];
    const groups = buildGenerateGroups(formats, signups, new Map(), "Average");
    expect(groups).toHaveLength(1);
    expect(groups[0].format_id).toBe(1);
    expect(groups[0].pods.flat()).toEqual([1]);
  });

  it("produces one group per format when both have present players", () => {
    const formats = [fmt(1, 1, 10), fmt(2, 2, null)];
    const signups = [signup(1, 1, true), signup(2, 2, true)];
    const groups = buildGenerateGroups(formats, signups, new Map(), "Average");
    expect(groups.map((g) => g.format_id).sort()).toEqual([1, 2]);
  });
});
