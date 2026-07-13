// Grid column templates for the leaderboard header row and player rows.
//
// Desktop lists a track for every rendered cell. Mobile (< 640px) lists tracks
// only for the cells that stay visible there — the others carry the `lb-m-hide`
// class (display: none), and hidden grid items don't occupy tracks. The two
// templates are applied via the --lb-cols / --lb-cols-m custom properties read
// by the .lb-grid class in globals.css.

export interface LeaderboardGridFlags {
  /** Trophies + Avg columns (season / cup / all-time scopes). */
  showAvg: boolean;
  /** Events-played column (same scopes as showAvg today). */
  showEvents: boolean;
  /** "Best" comp-avg column (season scope only). */
  showCompAvg: boolean;
}

export function leaderboardGridTemplates({ showAvg, showEvents, showCompAvg }: LeaderboardGridFlags): {
  desktop: string;
  mobile: string;
} {
  const desktop: string[] = [];
  desktop.push("44px");               // rank
  desktop.push("minmax(0, 1.6fr)");   // player
  if (showAvg) desktop.push("74px");  // trophies
  desktop.push("70px");               // points
  if (showEvents) desktop.push("56px"); // events played
  desktop.push("96px");               // W–L–D
  desktop.push("70px");               // win %
  if (showAvg) desktop.push("78px");  // avg
  if (showCompAvg) desktop.push("80px"); // best
  desktop.push("24px");               // expand arrow

  // Mobile keeps every stat that matters for ordering in scope (trophies, pts,
  // best); W–L–D stays only in event/pod scope, where those columns don't exist.
  const mobile: string[] = [];
  mobile.push("24px");                // rank
  mobile.push("minmax(0, 1fr)");      // player
  if (showAvg) mobile.push("44px");   // trophies
  mobile.push("40px");                // points
  if (showEvents) mobile.push("40px"); // events played
  if (!showAvg) mobile.push("70px");  // W–L–D (event/pod scope only)
  if (showCompAvg) mobile.push("40px"); // best

  return { desktop: desktop.join(" "), mobile: mobile.join(" ") };
}
