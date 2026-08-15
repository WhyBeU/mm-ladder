import type { Season } from "@/lib/types";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/**
 * Proposed number of weekly events between two ISO dates (inclusive of both
 * endpoints), i.e. `floor((end - start) / 7 days) + 1`. Seasons run one event
 * per week, so this mirrors how the importer derives `event_count` from the
 * weekly scrape files.
 *
 * Returns `null` when either date is missing/malformed or `ends_on` precedes
 * `starts_on`, so callers can simply skip the suggestion.
 */
export function weeklyEventCount(starts_on: string, ends_on: string): number | null {
  if (!ISO_DATE.test(starts_on) || !ISO_DATE.test(ends_on)) return null;
  const start = Date.parse(`${starts_on}T00:00:00Z`);
  const end = Date.parse(`${ends_on}T00:00:00Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return null;
  return Math.floor((end - start) / MS_PER_DAY / 7) + 1;
}

/**
 * The season the ladder should open on for a given ISO `today`.
 *
 * Seasons overlap: a Cube season runs for a year underneath the set seasons, so several
 * seasons usually cover today. Among those, a qualifying season (one that sends players to
 * the yearly cup) wins — that's the race worth watching. Otherwise it's the one that started
 * most recently, i.e. the set the playgroup is drafting right now, so a new season takes over
 * the landing page the day it starts.
 *
 * With nothing covering today (between seasons), falls back to the most recently ended
 * season. Returns `null` only for an empty list.
 */
export function pickActiveSeason<T extends Season>(seasons: readonly T[], today: string): T | null {
  if (seasons.length === 0) return null;
  const covering = seasons.filter(s => s.starts_on <= today && today <= s.ends_on);
  if (covering.length === 0) {
    return [...seasons].sort((a, b) => b.ends_on.localeCompare(a.ends_on) || b.id - a.id)[0];
  }
  return [...covering].sort(
    (a, b) =>
      Number(b.qualifier_count > 0) - Number(a.qualifier_count > 0) ||
      b.starts_on.localeCompare(a.starts_on) ||
      b.id - a.id,
  )[0];
}
