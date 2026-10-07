// Pure stats-strip model for the current scope. No React, no IO — unit-tested.

import type { MMLEvent, SeasonStats, StandingEntry } from "@/lib/types";

/**
 * Headline numbers for the stats strip. "Per event" means per Monday (one `MMLEvent` per
 * date), not per pod: a night with two pods of 8 averages 16 players, not 8. Attendance
 * counts each player once per Monday, even if they played more than one pod that night.
 */
export function computeStats(scopedEvents: MMLEvent[], scopeStandings: StandingEntry[]): SeasonStats {
  const eventCount = scopedEvents.length;
  const podCount = scopedEvents.reduce((s, e) => s + e.pods.length, 0);
  const totalMatches = scopeStandings.reduce((s, p) => s + p.match_wins + p.match_losses + p.match_draws, 0) / 2;
  const playerWeeks = scopeStandings.reduce((s, p) => s + p.per_event.filter(e => e.points != null).length, 0);
  return {
    events: eventCount,
    pods: podCount,
    players: scopeStandings.length,
    matches: Math.round(totalMatches),
    matchesPerEvent: eventCount ? totalMatches / eventCount : 0,
    avgAttendance: eventCount ? playerWeeks / eventCount : 0,
  };
}
