import { describe, expect, it } from "vitest";
import {
  buildPods,
  calculatePodStructure,
  fmtMetric,
  podSizePreview,
  seedPlayers,
  type SeedablePlayer,
} from "./pods";

describe("calculatePodStructure", () => {
  // Known values from the design spec (the reference LimitedSpoiler algorithm).
  const known: Record<number, number[]> = {
    1: [1],
    5: [5],
    6: [6],
    7: [7],
    8: [8],
    9: [9],
    10: [10],
    11: [11],
    12: [6, 6],
    13: [6, 7],
    14: [8, 6],
    15: [8, 7],
    16: [8, 8],
    17: [8, 9],
    18: [8, 10],
    19: [6, 6, 7],
    20: [8, 6, 6],
    21: [8, 6, 7],
    22: [8, 8, 6],
    23: [8, 8, 7],
    24: [8, 8, 8],
    25: [8, 8, 9],
    26: [8, 6, 6, 6],
    27: [8, 6, 6, 7],
    28: [8, 8, 6, 6],
  };

  it.each(Object.entries(known))("n=%s -> expected sizes", (n, expected) => {
    expect(calculatePodStructure(Number(n))).toEqual(expected);
  });

  it("sizes always sum to n for n = 1..40", () => {
    for (let n = 1; n <= 40; n++) {
      const sizes = calculatePodStructure(n);
      expect(sizes.reduce((s, x) => s + x, 0)).toBe(n);
    }
  });

  it("keeps every pod within 6..11 for n >= 6", () => {
    for (let n = 6; n <= 40; n++) {
      for (const size of calculatePodStructure(n)) {
        expect(size).toBeGreaterThanOrEqual(6);
        expect(size).toBeLessThanOrEqual(11);
      }
    }
  });

  it("returns a single undersized pod for n < 6", () => {
    for (let n = 1; n <= 5; n++) {
      expect(calculatePodStructure(n)).toEqual([n]);
    }
  });

  it("returns [] for n <= 0", () => {
    expect(calculatePodStructure(0)).toEqual([]);
    expect(calculatePodStructure(-3)).toEqual([]);
  });
});

describe("podSizePreview", () => {
  it("formats sizes with separators", () => {
    expect(podSizePreview(19)).toBe("6 · 6 · 7");
    expect(podSizePreview(8)).toBe("8");
  });

  it("shows a dash for empty fields", () => {
    expect(podSizePreview(0)).toBe("—");
  });
});

function player(
  key: string,
  metrics: Partial<Pick<SeedablePlayer, "total" | "average" | "best">> = {},
  isExtra = false,
): SeedablePlayer {
  return {
    key,
    name: key,
    total: metrics.total ?? 0,
    average: metrics.average ?? 0,
    best: metrics.best ?? 0,
    isExtra,
  };
}

describe("fmtMetric", () => {
  const metrics = { total: 24, average: 4.25, best: 18 };

  it("returns null for Random (no metric shown)", () => {
    expect(fmtMetric("Random", metrics)).toBeNull();
  });

  it("shows the integer point sum for Total and Best", () => {
    expect(fmtMetric("Total", metrics)).toBe("24");
    expect(fmtMetric("Best", metrics)).toBe("18");
  });

  it("shows one decimal for Average", () => {
    expect(fmtMetric("Average", metrics)).toBe("4.3");
  });

  it("shows a dash for a 0/unrated metric", () => {
    expect(fmtMetric("Total", { total: 0, average: 0, best: 0 })).toBe("—");
  });
});

describe("seedPlayers", () => {
  it("sorts real players descending by the chosen metric", () => {
    const players = [
      player("a", { total: 3 }),
      player("b", { total: 9 }),
      player("c", { total: 6 }),
    ];
    expect(seedPlayers(players, "Total").map((p) => p.key)).toEqual(["b", "c", "a"]);
  });

  it("uses the Best metric (top-N point sum) for Best seeding", () => {
    const players = [
      player("a", { best: 18 }),
      player("b", { best: 21 }),
    ];
    expect(seedPlayers(players, "Best").map((p) => p.key)).toEqual(["b", "a"]);
  });

  it("always appends extras last, even before 0-metric real players", () => {
    const players = [
      player("x-extra", {}, true),
      player("rated", { total: 5 }),
      player("unrated", { total: 0 }),
    ];
    const order = seedPlayers(players, "Total").map((p) => p.key);
    expect(order[order.length - 1]).toBe("x-extra");
    expect(order).toEqual(["rated", "unrated", "x-extra"]);
  });

  it("keeps extras last for Random too", () => {
    const players = [
      player("e", {}, true),
      player("a", { total: 1 }),
      player("b", { total: 2 }),
    ];
    // deterministic rng -> no shuffle movement, but extra must still be last
    const order = seedPlayers(players, "Random", () => 0).map((p) => p.key);
    expect(order[order.length - 1]).toBe("e");
  });
});

describe("buildPods", () => {
  it("slices the seeded order into the pod structure", () => {
    const players = Array.from({ length: 19 }, (_, i) =>
      player(`p${i}`, { total: 19 - i }),
    );
    const pods = buildPods(players, "Total");
    expect(pods.map((pod) => pod.length)).toEqual([6, 6, 7]);
    // strongest (total 19) seeds into pod 1
    expect(pods[0][0].key).toBe("p0");
    // total players preserved
    expect(pods.flat()).toHaveLength(19);
  });
});
