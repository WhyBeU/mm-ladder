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
