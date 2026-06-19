// Pure logic for turning the live board state into a per-format generate payload.
// No React, no IO — unit-tested.

import { buildPods, type SeedMethod, type SeedablePlayer } from "./pods";
import type { ApiBoardFormat, ApiBoardSignup, GenerateFormatGroup } from "./boardApi";

export interface SeedMetrics {
  total: number;
  average: number;
  best: number;
}

const ZERO: SeedMetrics = { total: 0, average: 0, best: 0 };

/**
 * Build the `{ formats: [...] }` generate body: for each format with present sign-ups, seed
 * its present players within the format. Season-backed formats use the chosen `method` and
 * their season metrics; "Other" formats (no `season_id`) always seed Random. Extras and
 * players missing metrics score 0 (seeded last). Formats with nobody present are skipped.
 */
export function buildGenerateGroups(
  formats: ApiBoardFormat[],
  signups: ApiBoardSignup[],
  metricsByFormat: Map<number, Map<number, SeedMetrics>>,
  method: SeedMethod,
): GenerateFormatGroup[] {
  const groups: GenerateFormatGroup[] = [];
  for (const fmt of formats) {
    const present = signups.filter((s) => s.present && s.format_id === fmt.id);
    if (present.length === 0) continue;

    const metrics = metricsByFormat.get(fmt.id);
    const seedMethod: SeedMethod = fmt.season_id != null ? method : "Random";
    const seedables: SeedablePlayer[] = present.map((s) => {
      const m = (s.player_id != null ? metrics?.get(s.player_id) : undefined) ?? ZERO;
      return {
        key: String(s.id),
        name: s.display_name,
        total: m.total,
        average: m.average,
        best: m.best,
        isExtra: s.is_extra,
      };
    });
    const pods = buildPods(seedables, seedMethod).map((pod) => pod.map((p) => Number(p.key)));
    groups.push({ format_id: fmt.id, seeding_label: seedMethod, pods });
  }
  return groups;
}
