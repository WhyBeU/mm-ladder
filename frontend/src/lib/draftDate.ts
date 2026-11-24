const VENUE_TZ = "Australia/Sydney";
const MS_PER_DAY = 86_400_000;

/**
 * The Monday the sign-up board is for: the first Monday on or after `at`, in
 * venue-local (Sydney) time. On a Monday it is that same Monday (sign-ups on the
 * night); from Tuesday it rolls to the next week. Returns a UTC-midnight Date
 * carrying the local calendar day.
 */
export function draftMonday(at: Date | string, timeZone: string = VENUE_TZ): Date | null {
  const instant = new Date(at);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(instant)
    .reduce<Record<string, string>>((acc, p) => ({ ...acc, [p.type]: p.value }), {});
  const localDay = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const weekday = new Date(localDay).getUTCDay(); // 0 = Sunday, 1 = Monday
  const ahead = (1 - weekday + 7) % 7;
  return new Date(localDay + ahead * MS_PER_DAY);
}

/** "1 December" — the heading form of a {@link draftMonday} date. */
export function formatDraftDate(d: Date): string {
  return d.toLocaleDateString("en-AU", { day: "numeric", month: "long", timeZone: "UTC" });
}
