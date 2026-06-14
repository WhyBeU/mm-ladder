// Pure pod-maker logic: pod-structure sizing + seeding. No React, no IO — unit-tested.

export type SeedMethod = "Random" | "Average" | "Best" | "Total";

export const SEED_METHODS: SeedMethod[] = ["Random", "Average", "Best", "Total"];

export interface SeedablePlayer {
  /** Stable unique key: player id as string, or `extra-<n>`. */
  key: string;
  name: string;
  /** Seed metrics; 0 for players with no live-season stats and for Extras. */
  total: number;
  average: number;
  best: number;
  isExtra: boolean;
}

/**
 * Split `n` players into pod sizes summing to `n`, favouring pods of 8 and even
 * sizes. Ported from LimitedSpoiler `calculatePodStructure`: fill pods of 8, then
 * rebalance the remainder by "stealing" 2 from earlier pods to keep every pod 6–11.
 *
 * The lone exception to the 6–11 range is a single small field (`n < 6`), which
 * returns one undersized pod `[n]`.
 */
export function calculatePodStructure(n: number): number[] {
  if (n <= 0) return [];

  const e = Math.floor(n / 8); // number of full pods of 8
  const r = n % 8; // remainder
  const result: number[] = Array.from({ length: e }, () => 8);

  if (e === 0) return [n]; // 1..7 -> single small pod
  if (r === 0) return result; // exact multiple of 8
  if (r >= 6) {
    result.push(r); // append a pod of 6 or 7
    return result;
  }
  if (r >= 4) {
    result[e - 1] -= 2; // -> ..., 6, (r+2)
    result.push(r + 2);
    return result;
  }
  if (e === 1) {
    result[0] += r; // single full pod absorbs 1..3 -> 9/10/11
    return result;
  }

  // r in {1,2,3}, e >= 2: try to lift a new remainder pod up to >= 6 by stealing 2s.
  if (r === 3 && e * 2 + r >= 6) return stealUp(result, r);
  if (r <= 2 && (e - 1) * 2 + r >= 6) return stealUp(result, r);

  // fallback: absorb the remainder into the last full pod
  result[e - 1] += r;
  return result;
}

/**
 * Append a new pod of size `r`, then repeatedly take 2 from the preceding full pods
 * (back to front) until the new pod reaches >= 6. The callers' guards guarantee
 * enough full pods exist for this to terminate without any pod dropping below 6.
 */
function stealUp(result: number[], r: number): number[] {
  let i = result.length - 1;
  result.push(r);
  const last = result.length - 1;
  while (result[last] < 6) {
    result[last] += 2;
    result[i] -= 2;
    i -= 1;
  }
  return result;
}

/** Human-readable preview of the pod split, e.g. `6 · 6 · 7`. */
export function podSizePreview(n: number): string {
  if (n <= 0) return "—";
  return calculatePodStructure(n).join(" · ");
}

/** The metric value used for a given seeding method (0 for Random). */
export function metricFor(p: SeedablePlayer, method: SeedMethod): number {
  switch (method) {
    case "Total":
      return p.total;
    case "Average":
      return p.average;
    case "Best":
      return p.best;
    case "Random":
      return 0;
  }
}

function shuffle<T>(items: T[], rng: () => number = Math.random): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Order the selected players for podding: real players sorted by the chosen metric
 * (descending = strongest first), or shuffled for Random; Extras are always appended
 * last so they fall into the weakest pod. `rng` is injectable for deterministic tests.
 */
export function seedPlayers(
  players: SeedablePlayer[],
  method: SeedMethod,
  rng: () => number = Math.random,
): SeedablePlayer[] {
  const real = players.filter((p) => !p.isExtra);
  const extras = players.filter((p) => p.isExtra);

  const ordered =
    method === "Random"
      ? shuffle(real, rng)
      : [...real].sort((a, b) => metricFor(b, method) - metricFor(a, method));

  return [...ordered, ...extras];
}

/** Seed the players, then slice them sequentially into the computed pod structure. */
export function buildPods(
  players: SeedablePlayer[],
  method: SeedMethod,
  rng: () => number = Math.random,
): SeedablePlayer[][] {
  const ordered = seedPlayers(players, method, rng);
  const sizes = calculatePodStructure(ordered.length);
  const pods: SeedablePlayer[][] = [];
  let placed = 0;
  for (const size of sizes) {
    pods.push(ordered.slice(placed, placed + size));
    placed += size;
  }
  return pods;
}
