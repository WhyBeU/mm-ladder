"use client";

import { useState, useMemo } from "react";
import type { StandingEntry, MMLEvent, Scope, Season, PerEvent } from "@/lib/types";
import { fmtPct, fmtAvg, fmtDate, PlayerAvatar, StreakChips, Sparkline } from "@/components/bits";
import AwardsCluster from "@/components/AwardsCluster";
import { trophyCutoffIndex } from "@/lib/trophyLine";
import { leaderboardGridTemplates } from "@/lib/leaderboardGrid";

type SortKey = "points" | "display_name" | "match_wins" | "win_pct" | "avg_pts" | "tournaments_played" | "trophies" | "comp_avg";
type SortDir = "asc" | "desc";
type Density = "comfy" | "compact";

interface LeaderboardProps {
  standings: StandingEntry[];
  scope: Scope;
  season?: Season | null;
  seasons?: Season[];
  scopedEvents: MMLEvent[];
  showStreak?: boolean;
  showCupLine?: boolean;
  density?: Density;
  defaultSortKey?: SortKey;
  onEventSelect?: (event: MMLEvent) => void;
  qualifiedPlayerIds?: Set<number>;
  qualifiedCupYear?: number | null;
}

export default function Leaderboard({
  standings,
  scope,
  season,
  seasons = [],
  scopedEvents,
  showStreak = true,
  showCupLine = true,
  density = "comfy",
  defaultSortKey = "points",
  onEventSelect,
  qualifiedPlayerIds,
  qualifiedCupYear,
}: LeaderboardProps) {
  // Set code / keyrune per season id — labels the per-season attendance strips in cup scope.
  const seasonLookup = useMemo(
    () => new Map(seasons.map(s => [s.id, { set_code: s.set_code, keyrune: s.keyrune }])),
    [seasons],
  );
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  // The user's manual sort choice, tagged with the scope it was made in. Until they
  // pick a column, the sort falls back to defaultSortKey — which for a BEST season
  // resolves only after the async season data loads, so deriving it here (rather than
  // seeding useState once) fixes cold mobile loads wrongly staying on points. Tagging
  // by scope means a new scope re-applies that scope's own default.
  const [sortOverride, setSortOverride] = useState<{ sig: string; key: SortKey; dir: SortDir } | null>(null);

  const scopeSig = `${scope.kind}:${scope.cupId ?? ""}:${scope.seasonId ?? ""}:${scope.eventId ?? ""}:${scope.podId ?? ""}`;
  const activeOverride = sortOverride?.sig === scopeSig ? sortOverride : null;
  const sortKey = activeOverride?.key ?? defaultSortKey;
  const sortDir = activeOverride?.dir ?? "desc";

  const handleSort = (k: SortKey) => {
    setSortOverride(prev => {
      const cur = prev?.sig === scopeSig ? prev : null;
      if (cur && cur.key === k) return { sig: scopeSig, key: k, dir: cur.dir === "desc" ? "asc" : "desc" };
      return { sig: scopeSig, key: k, dir: k === "display_name" ? "asc" : "desc" };
    });
  };

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let out = standings.filter(p => !q || p.display_name.toLowerCase().includes(q));
    out = [...out].sort((a, b) => {
      if (sortKey === "display_name") {
        const av = a.display_name.toLowerCase(), bv = b.display_name.toLowerCase();
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      if (sortKey === "comp_avg") {
        const av = a.comp_avg ?? -Infinity;
        const bv = b.comp_avg ?? -Infinity;
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const av = a[sortKey as keyof StandingEntry] as number;
      const bv = b[sortKey as keyof StandingEntry] as number;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return out;
  }, [search, sortKey, sortDir, standings]);

  const showMedals = sortDir === "desc" && (sortKey === "points" || (scope.kind === "season" && sortKey === "comp_avg"));
  const qualifierCount = season?.qualifier_count ?? 2;
  const showAvg     = scope.kind === "season" || scope.kind === "cup" || scope.kind === "alltime";
  const showCompAvg = scope.kind === "season";
  const showEvents  = showAvg;
  const eventLabel  = scope.kind === "pod" || scope.kind === "event" ? "Rounds" : "Events";
  const qualifyingSortKey: SortKey = scope.kind === "season" && season?.qualifying_type === "BEST" ? "comp_avg" : "points";
  const cupLineEnabled =
    showCupLine && scope.kind === "season" && !!season?.yearly_cup_id && sortKey === qualifyingSortKey && sortDir === "desc";

  const isEvent = scope.kind === "event";
  // Trophy line: only in event scope, sorted points-desc; index of last 9-pt row.
  const trophyIdx =
    isEvent && sortKey === "points" && sortDir === "desc"
      ? trophyCutoffIndex(rows.map((r) => r.points))
      : -1;

  // Grid templates (desktop + mobile) — see lib/leaderboardGrid.ts
  const gridTemplates = leaderboardGridTemplates({ showAvg, showEvents, showCompAvg });

  return (
    <section style={{ "--lb-cols": gridTemplates.desktop, "--lb-cols-m": gridTemplates.mobile } as React.CSSProperties}>
      {/* Search bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 14 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <svg style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--parchment-faint)" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players…"
            className="themed-surface"
            style={{
              width: "100%", background: "var(--ink-850)",
              border: "1px solid var(--ink-700)", borderRadius: "var(--radius-card)",
              padding: "10px 14px 10px 36px", fontSize: 14, color: "var(--parchment)",
              fontFamily: "inherit", outline: "none",
            }}
          />
        </div>
        <div className="lb-counters" style={{ fontSize: 11, color: "var(--parchment-faint)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
          <span><span style={{ color: "var(--accent-300)", fontWeight: 700 }}>{rows.length}</span> showing</span>
          <span>{standings.length} total</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="lb-grid lb-head">
        <SortHead label="#"        k="points"      align="center" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        <SortHead label="Player"   k="display_name" align="left"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        {showAvg && <SortHead label="Trophies" labelShort="🏆" k="trophies" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} title="Events where you scored 9 points" />}
        <SortHead label="Pts"      k="points"             align="right"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        {showEvents && <SortHead label="Evts" k="tournaments_played" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
        <SortHead label="W–L–D"    k="match_wins"         align="center" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className={showAvg ? "lb-m-hide" : undefined} />
        <SortHead label="Win %"    k="win_pct"            align="right"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="lb-m-hide" />
        {showAvg && <SortHead label="Avg" k="avg_pts" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} className="lb-m-hide" />}
        {showCompAvg && (
          <SortHead
            label="Best"
            k="comp_avg"
            align="right"
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            title={`Total of your top ${standings[0]?.comp_avg_n ?? "N"} event scores`}
          />
        )}
        <span className="lb-m-hide" />
      </div>

      {/* Rows */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(p => {
          const rank = p.rank;
          const isMedal = !isEvent && showMedals && rank <= 3;
          const cupLine = cupLineEnabled && rank === qualifierCount && rows.length > qualifierCount;
          const isExpanded = expanded === p.player_id;

          const medalEdge =
            rank === 1 ? "linear-gradient(180deg, var(--accent-300), var(--accent-500))" :
            rank === 2 ? "linear-gradient(180deg, #e1e6ee, #6b7a93)" :
            rank === 3 ? "linear-gradient(180deg, #d4a373, #6e441f)" : null;

          const borderColor = isMedal
            ? (rank === 1 ? "color-mix(in srgb, var(--accent-400) 35%, transparent)"
              : rank === 2 ? "color-mix(in srgb, var(--silver-400) 30%, transparent)"
              : "color-mix(in srgb, var(--bronze-400) 30%, transparent)")
            : "var(--ink-700)";

          return (
            <li key={p.player_id}>
              <button
                onClick={isEvent ? undefined : () => setExpanded(isExpanded ? null : p.player_id)}
                className={`themed-surface lb-grid lb-row${density === "compact" ? " lb-compact" : ""}`}
                style={{
                  position: "relative", width: "100%", textAlign: "left", cursor: isEvent ? "default" : "pointer",
                  background: "var(--ink-900)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: "var(--radius-card)",
                  color: "var(--parchment)", fontFamily: "inherit",
                  boxShadow: isMedal ? "var(--shadow-card)" : "none",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--ink-850)")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--ink-900)")}
              >
                {medalEdge && (
                  <span style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: 2, background: medalEdge }} />
                )}

                {/* Rank */}
                <div style={{ textAlign: "center" }}>
                  <span className="font-display lb-rank" style={{
                    fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: rank === 1 ? "var(--accent-300)" : rank === 2 ? "var(--silver-300)" : rank === 3 ? "var(--bronze-300)" : "var(--parchment-muted)",
                  }}>{rank}</span>
                </div>

                {/* Player */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <PlayerAvatar name={p.display_name} rank={rank} size={density === "compact" ? 32 : 36} isVeteran={p.is_veteran} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, rowGap: 4, minWidth: 0, flexWrap: "wrap" }}>
                      <span style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{p.display_name}</span>
                      {qualifiedPlayerIds?.has(p.player_id) && <QualifiedCheck year={qualifiedCupYear} />}
                      <AwardsCluster player={p} wrap />
                    </div>
                    <div style={{ fontSize: 11, color: "var(--parchment-faint)", display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{p.tournaments_played} {eventLabel.toLowerCase()}</span>
                      {showStreak && p.streak && (
                        <>
                          <span style={{ width: 3, height: 3, background: "var(--parchment-faint)", borderRadius: "50%" }} />
                          <StreakChips streak={p.streak} />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Trophies */}
                {showAvg && <TrophyCell count={p.trophies} />}

                {/* Points */}
                <div style={{ textAlign: "right" }}>
                  <span className="font-display lb-pts" style={{ color: rank === 1 ? "var(--accent-300)" : "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{p.points}</span>
                </div>

                {/* Events played */}
                {showEvents && (
                  <div style={{ textAlign: "right", fontSize: 13, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {p.tournaments_played}
                  </div>
                )}

                {/* W–L–D */}
                <div className={showAvg ? "lb-m-hide" : undefined} style={{ textAlign: "center", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: "var(--win)", fontWeight: 600 }}>{p.match_wins}</span>
                  <span style={{ color: "var(--parchment-faint)", margin: "0 3px" }}>–</span>
                  <span style={{ color: "var(--loss)", fontWeight: 600 }}>{p.match_losses}</span>
                  <span style={{ color: "var(--parchment-faint)", margin: "0 3px" }}>–</span>
                  <span style={{ color: "var(--draw)", fontWeight: 600 }}>{p.match_draws}</span>
                </div>

                {/* Win % */}
                <div className="lb-m-hide" style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 13, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{fmtPct(p.win_pct)}</div>
                  <div style={{ marginTop: 3, height: 3, background: "var(--ink-800)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${p.win_pct * 100}%`,
                      background: rank === 1 ? "var(--accent-400)" : rank <= 3 ? "var(--primary-300)" : "var(--primary-500)",
                    }} />
                  </div>
                </div>

                {/* Avg */}
                {showAvg && (
                  <div className="lb-m-hide" style={{ textAlign: "right", fontSize: 13, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {fmtAvg(p.avg_pts)}
                  </div>
                )}

                {/* Best (total of top N events) */}
                {showCompAvg && (
                  <div style={{ textAlign: "right", fontSize: 13, fontVariantNumeric: "tabular-nums", fontWeight: 600, color: p.comp_avg != null ? "var(--accent-300)" : "var(--parchment-faint)" }}>
                    {p.comp_avg != null && p.comp_avg_n != null ? Math.round(p.comp_avg * p.comp_avg_n) : "—"}
                  </div>
                )}

                {/* Expand arrow */}
                {!isEvent
                  ? <span className="lb-m-hide" style={{ color: "var(--parchment-faint)", fontSize: 12, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 200ms" }}>▸</span>
                  : <span className="lb-m-hide" />}
              </button>

              {!isEvent && isExpanded && (
                <ExpandedDetail player={p} scope={scope} scopedEvents={scopedEvents} seasonLookup={seasonLookup} onEventSelect={onEventSelect} />
              )}
              {trophyIdx >= 0 && trophyIdx === rows.indexOf(p) && (
                <div style={{ position: "relative", margin: "10px 0 4px", borderBottom: "1px dashed color-mix(in srgb, var(--accent-400) 45%, transparent)" }}>
                  <span style={{
                    position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: -11,
                    display: "inline-flex", alignItems: "center", gap: 6,
                    background: "var(--ink-950)", padding: "0 10px",
                    fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                    color: "var(--accent-300)", fontWeight: 700,
                  }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14l-1 8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4L5 4Zm5 13h4l1 3H9l1-3Z" /></svg>
                    3-0
                  </span>
                </div>
              )}
              {cupLine && (
                <div style={{ position: "relative", margin: "6px 0 2px", borderBottom: "1px dashed color-mix(in srgb, var(--accent-400) 50%, transparent)" }}>
                  <span style={{
                    position: "absolute", right: 0, bottom: -9,
                    fontSize: 10, letterSpacing: "0.18em", textTransform: "uppercase",
                    background: "color-mix(in srgb, var(--accent-400) 16%, var(--ink-950))",
                    border: "1px solid color-mix(in srgb, var(--accent-400) 35%, transparent)",
                    color: "var(--accent-300)", fontWeight: 700,
                    padding: "2px 8px", borderRadius: 4, display: "inline-flex", alignItems: "center", gap: 5,
                  }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14l-1 8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4L5 4Zm5 13h4l1 3H9l1-3Z" /></svg>
                    Cup qualifier line · top {qualifierCount}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {rows.length === 0 && (
        <div style={{ padding: 40, textAlign: "center", border: "1px solid var(--ink-700)", borderRadius: "var(--radius-card)", color: "var(--parchment-muted)" }}>
          No players match the current filter.
        </div>
      )}
    </section>
  );
}

// ---------- QualifiedCheck ----------

function QualifiedCheck({ year }: { year?: number | null }) {
  return (
    <span className="aw" style={{ flexShrink: 0 }} title={`Qualified for MM Cup${year != null ? ` ${year}` : ""}`}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--accent-300)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ display: "block" }}>
        <path d="M20 6 9 17l-5-5" />
      </svg>
      <span className="aw-tip">Qualified for MM Cup{year != null ? ` ${year}` : ""}</span>
    </span>
  );
}

// ---------- TrophyCell ----------

function TrophyIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path style={{ fill: "var(--accent-300)" }} d="M5 4h14l-1 8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4L5 4Zm5 13h4l1 3H9l1-3Z" />
    </svg>
  );
}

function TrophyCell({ count }: { count: number }) {
  if (count === 0) {
    return <div style={{ textAlign: "right", fontSize: 13, color: "var(--parchment-faint)" }}>—</div>;
  }
  if (count <= 3) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
        {Array.from({ length: count }, (_, i) => <TrophyIcon key={i} />)}
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4 }}>
      <TrophyIcon />
      <span style={{ fontSize: 12, color: "var(--accent-300)", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>×{count}</span>
    </div>
  );
}

// ---------- SortHead ----------
interface SortHeadProps {
  label: string;
  labelShort?: string;
  k: SortKey;
  align?: "left" | "center" | "right";
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  title?: string;
  className?: string;
}

function SortHead({ label, labelShort, k, align = "left", sortKey, sortDir, onSort, title, className }: SortHeadProps) {
  const active = sortKey === k;
  const justifyMap = { left: "flex-start", center: "center", right: "flex-end" } as const;
  return (
    <button onClick={() => onSort(k)} title={title} className={`lb-sorthead${className ? ` ${className}` : ""}`} style={{
      background: "none", border: "none", cursor: "pointer", padding: 0,
      width: "100%", textAlign: align, whiteSpace: "nowrap",
      textTransform: "uppercase", fontWeight: 600,
      color: active ? "var(--accent-400)" : "var(--parchment-faint)",
      fontFamily: "inherit",
      justifyContent: justifyMap[align],
    }}>
      {labelShort != null
        ? <><span className="lb-l-full">{label}</span><span className="lb-l-short">{labelShort}</span></>
        : <span>{label}</span>}
      <span className={active ? undefined : "lb-glyph-off"} style={{ fontSize: 9, opacity: active ? 1 : 0.5 }}>{active ? (sortDir === "desc" ? "▼" : "▲") : "⇅"}</span>
    </button>
  );
}

// ---------- ExpandedDetail ----------
type SeasonLookup = Map<number, { set_code: string; keyrune: string }>;

interface ExpandedDetailProps {
  player: StandingEntry;
  scope: Scope;
  scopedEvents: MMLEvent[];
  seasonLookup: SeasonLookup;
  onEventSelect?: (event: MMLEvent) => void;
}

function ExpandedDetail({ player, scope, scopedEvents, seasonLookup, onEventSelect }: ExpandedDetailProps) {
  // All-time drops the points chart entirely — the heatmap shades cells by points instead.
  const showPerEvent = scope.kind === "season" || scope.kind === "cup";
  const points = player.per_event.map(e => e.points);
  const validPoints = points.filter((v): v is number => v != null);
  const useLabels = validPoints.length > 0 && validPoints.length < 15;
  // Per-point tooltips carry the pod (tournament) id the player played.
  const tips = player.per_event.map(e =>
    e.points == null ? null : `#${e.tournament_id} · ${fmtDate(e.held_on)} · ${e.points} pts`);

  return (
    <div className="xp-grid" style={{
      marginTop: 4, padding: "16px 20px",
      background: "color-mix(in srgb, var(--ink-850) 80%, transparent)",
      border: "1px solid var(--ink-700)", borderRadius: "var(--radius-card)",
      "--xp-cols": showPerEvent ? "1fr 1.2fr" : "1fr",
    } as React.CSSProperties}>
      {showPerEvent && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>● Points by event</div>
          <div style={{ paddingTop: 8 }}>
            <Sparkline data={points} width={240} height={useLabels ? 60 : 44} color="var(--primary-300)" showLabels={useLabels} tips={tips} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--parchment-faint)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            <span>Event 1</span>
            <span>Event {points.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
            <StatBlock label="Best" value={Math.max(...validPoints, 0)} />
            <StatBlock label="Avg"  value={player.avg_pts.toFixed(1)} />
            <StatBlock label="Events" value={player.tournaments_played} />
          </div>
        </div>
      )}
      <div>
        <div className="eyebrow" style={{ marginBottom: 10 }}>
          ● {scope.kind === "pod" || scope.kind === "event" ? "Match record" : "Event attendance"}
        </div>
        {scope.kind === "pod" || scope.kind === "event"
          ? <RoundBreakdown player={player} />
          : <AttendanceGrid player={player} scope={scope} scopedEvents={scopedEvents} seasonLookup={seasonLookup} onEventSelect={onEventSelect} />}
      </div>
    </div>
  );
}

function StatBlock({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: "var(--ink-900)", border: "1px solid var(--ink-700)", borderRadius: 8, padding: "8px 10px" }}>
      <div className="eyebrow">{label}</div>
      <div className="font-display" style={{ fontSize: 18, color: "var(--parchment)", marginTop: 2, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function AttendanceGrid({ player, scope, scopedEvents, seasonLookup, onEventSelect }: {
  player: StandingEntry;
  scope: Scope;
  scopedEvents: MMLEvent[];
  seasonLookup: SeasonLookup;
  onEventSelect?: (event: MMLEvent) => void;
}) {
  // Each per-event slot self-describes its date/attendance (no positional zipping). Resolve the
  // click target by date so navigation still works.
  const eventByDate = useMemo(() => new Map(scopedEvents.map(e => [e.held_on, e])), [scopedEvents]);
  if (scope.kind === "cup") return <CupSeasonStrips player={player} seasonLookup={seasonLookup} eventByDate={eventByDate} onEventSelect={onEventSelect} />;
  if (scope.kind === "alltime") return <AttendanceHeatmap player={player} seasonLookup={seasonLookup} eventByDate={eventByDate} onEventSelect={onEventSelect} />;
  return <AttendanceStrip perEvent={player.per_event} eventByDate={eventByDate} onEventSelect={onEventSelect} />;
}

function AttendanceLegend({ attended, missed }: { attended: number; missed: number }) {
  return (
    <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: "color-mix(in srgb, var(--win) 60%, transparent)", border: "1px solid color-mix(in srgb, var(--win) 50%, transparent)" }} />
        <span style={{ fontSize: 12, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{attended} <span style={{ color: "var(--parchment-faint)" }}>attended</span></span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--ink-800)", border: "1px solid var(--ink-700)" }} />
        <span style={{ fontSize: 12, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{missed} <span style={{ color: "var(--parchment-faint)" }}>missed</span></span>
      </div>
    </div>
  );
}

// Season scope: one labelled cell per event (unchanged look), now driven by the self-aligned
// per_event array.
function AttendanceStrip({ perEvent, eventByDate, onEventSelect }: {
  perEvent: PerEvent[];
  eventByDate: Map<string, MMLEvent>;
  onEventSelect?: (event: MMLEvent) => void;
}) {
  const total = perEvent.filter(e => e.points != null).length;
  const missed = perEvent.length - total;
  const cells = perEvent.slice(-Math.min(perEvent.length, 18));

  return (
    <div>
      <AttendanceLegend attended={total} missed={missed} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 4 }}>
        {cells.map((e, i) => {
          const att = e.points != null;
          const event = eventByDate.get(e.held_on);
          const clickable = onEventSelect && event;
          const Cell = clickable ? "button" : "div";
          return (
            <Cell key={i} title={`${event ? `MMM #${event.number} · ` : ""}${fmtDate(e.held_on)}${att ? ` · ${e.points} pts` : " · missed"}`}
              onClick={clickable ? () => onEventSelect!(event!) : undefined}
              style={{
                padding: "8px 6px", borderRadius: 4,
                background: att ? "color-mix(in srgb, var(--win) 18%, transparent)" : "var(--ink-800)",
                border: `1px solid ${att ? "color-mix(in srgb, var(--win) 35%, transparent)" : "var(--ink-700)"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                opacity: att ? 1 : 0.55,
                fontFamily: "inherit", cursor: clickable ? "pointer" : "default",
                transition: "border-color 150ms, opacity 150ms",
              }}
              onMouseEnter={clickable ? ev => { (ev.currentTarget as HTMLElement).style.borderColor = "var(--primary-400)"; (ev.currentTarget as HTMLElement).style.opacity = "1"; } : undefined}
              onMouseLeave={clickable ? ev => { (ev.currentTarget as HTMLElement).style.borderColor = att ? "color-mix(in srgb, var(--win) 35%, transparent)" : "var(--ink-700)"; (ev.currentTarget as HTMLElement).style.opacity = att ? "1" : "0.55"; } : undefined}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: att ? "var(--win)" : "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>{event ? `#${event.number}` : "—"}</span>
              <span style={{ fontSize: 9, color: "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>
                {new Date(e.held_on + "T00:00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
              </span>
            </Cell>
          );
        })}
      </div>
      {perEvent.length > 18 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--parchment-faint)", textAlign: "right" }}>Showing last 18 of {perEvent.length} events</div>
      )}
    </div>
  );
}

// A compact row of attended/missed squares for one run of events.
function EventSquares({ perEvent, eventByDate, onEventSelect }: {
  perEvent: PerEvent[];
  eventByDate: Map<string, MMLEvent>;
  onEventSelect?: (event: MMLEvent) => void;
}) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {perEvent.map((e, i) => {
        const att = e.points != null;
        const event = eventByDate.get(e.held_on);
        const clickable = onEventSelect && event;
        return (
          <span key={i}
            role={clickable ? "button" : undefined}
            onClick={clickable ? () => onEventSelect!(event!) : undefined}
            title={`${event ? `MMM #${event.number} · ` : ""}${fmtDate(e.held_on)}${att ? ` · ${e.points} pts` : " · missed"}`}
            style={{
              width: 13, height: 13, borderRadius: 3,
              background: att ? "color-mix(in srgb, var(--win) 32%, transparent)" : "var(--ink-800)",
              border: `1px solid ${att ? "color-mix(in srgb, var(--win) 45%, transparent)" : "var(--ink-700)"}`,
              cursor: clickable ? "pointer" : "default",
            }}
          />
        );
      })}
    </div>
  );
}

// Cup scope: one compact strip per season (set code · squares · attended/total).
function CupSeasonStrips({ player, seasonLookup, eventByDate, onEventSelect }: {
  player: StandingEntry;
  seasonLookup: SeasonLookup;
  eventByDate: Map<string, MMLEvent>;
  onEventSelect?: (event: MMLEvent) => void;
}) {
  // Group per_event by season, preserving chronological first-appearance order.
  const groups = useMemo(() => {
    const bySeason = new Map<number, PerEvent[]>();
    for (const e of player.per_event) {
      if (!bySeason.has(e.season_id)) bySeason.set(e.season_id, []);
      bySeason.get(e.season_id)!.push(e);
    }
    return Array.from(bySeason.entries());
  }, [player.per_event]);

  const totalAttended = player.per_event.filter(e => e.points != null).length;
  const totalMissed = player.per_event.length - totalAttended;

  return (
    <div>
      <AttendanceLegend attended={totalAttended} missed={totalMissed} />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {groups.map(([seasonId, evs]) => {
          const set = seasonLookup.get(seasonId);
          const attended = evs.filter(e => e.points != null).length;
          return (
            <div key={seasonId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, width: 64, flexShrink: 0 }}>
                {set && <i className={`ss ss-${set.keyrune} ss-fw`} style={{ fontSize: 16, color: "var(--primary-300)" }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--parchment-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{set?.set_code ?? "—"}</span>
              </span>
              <EventSquares perEvent={evs} eventByDate={eventByDate} onEventSelect={onEventSelect} />
              <span style={{ fontSize: 11, color: "var(--parchment-faint)", fontVariantNumeric: "tabular-nums", marginLeft: "auto" }}>{attended}/{evs.length}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// All-time scope: a GitHub-style heatmap — year rows × ~53 week columns. Attended cells are
// shaded by points earned (0→9); each season's first event is marked with its set symbol.
const WEEK_COLS = 53;
const HEAT_MONTHS: { label: string; col: number }[] = [
  { label: "Jan", col: 0 }, { label: "Apr", col: 13 }, { label: "Jul", col: 26 }, { label: "Oct", col: 39 },
];

function weekOfYear(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  const start = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - start.getTime()) / 86400000);
  return Math.min(WEEK_COLS - 1, Math.floor(days / 7));
}

// Points (0..9, a 3-round pod) → win-tint strength, so brighter = a stronger night.
function pointsShade(points: number): { bg: string; border: string } {
  const pct = 22 + Math.round((Math.min(points, 9) / 9) * 53); // 22%..75%
  return {
    bg: `color-mix(in srgb, var(--win) ${pct}%, transparent)`,
    border: `color-mix(in srgb, var(--win) ${Math.min(pct + 15, 90)}%, transparent)`,
  };
}

interface HeatCell { attended: boolean; points: number; e: PerEvent; setCode?: string; labelLeft?: boolean }

const DAY_MS = 86400000;

function AttendanceHeatmap({ player, seasonLookup, eventByDate, onEventSelect }: {
  player: StandingEntry;
  seasonLookup: SeasonLookup;
  eventByDate: Map<string, MMLEvent>;
  onEventSelect?: (event: MMLEvent) => void;
}) {
  const years = useMemo(() => {
    // Season-start dates (first event of each season, chronologically). A start whose *next*
    // start falls within two weeks anchors its label to the left, so the two labels don't collide.
    const startDates: string[] = [];
    const seenForStarts = new Set<number>();
    for (const e of player.per_event) {
      if (!seenForStarts.has(e.season_id)) { seenForStarts.add(e.season_id); startDates.push(e.held_on); }
    }
    const labelLeftDates = new Set<string>();
    for (let i = 0; i < startDates.length - 1; i++) {
      const gap = (new Date(startDates[i + 1] + "T00:00:00").getTime() - new Date(startDates[i] + "T00:00:00").getTime()) / DAY_MS;
      if (gap <= 14) labelLeftDates.add(startDates[i]);
    }

    // year → week col → aggregated cell. Attended wins the slot; a season-start event tags the
    // cell with its set code (and left/right label placement).
    const seenSeason = new Set<number>();
    const map = new Map<number, Map<number, HeatCell>>();
    for (const e of player.per_event) {
      const isStart = !seenSeason.has(e.season_id);
      seenSeason.add(e.season_id);
      const set = isStart ? seasonLookup.get(e.season_id) : undefined;
      const year = Number(e.held_on.slice(0, 4));
      const col = weekOfYear(e.held_on);
      if (!map.has(year)) map.set(year, new Map());
      const row = map.get(year)!;
      const attended = e.points != null;
      const prev = row.get(col);
      if (!prev) {
        row.set(col, { attended, points: e.points ?? 0, e, setCode: set?.set_code, labelLeft: set ? labelLeftDates.has(e.held_on) : undefined });
      } else {
        if (attended && !prev.attended) { prev.attended = true; prev.points = e.points ?? 0; prev.e = e; }
        if (set && !prev.setCode) { prev.setCode = set.set_code; prev.labelLeft = labelLeftDates.has(e.held_on); }
      }
    }
    // Only show years where the player actually attended at least one event.
    return Array.from(map.entries())
      .filter(([, row]) => Array.from(row.values()).some(c => c.attended))
      .map(([year, row]) => ({ year, row }))
      .sort((a, b) => a.year - b.year);
  }, [player.per_event, seasonLookup]);

  const totalAttended = player.per_event.filter(e => e.points != null).length;
  const CELL = 12, GAP = 3, YEAR_LABEL_W = 40;
  const gridW = WEEK_COLS * CELL + (WEEK_COLS - 1) * GAP;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{totalAttended} <span style={{ color: "var(--parchment-faint)" }}>attended</span></span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--parchment-muted)" }}>
          <span style={{ color: "var(--parchment-faint)" }}>0</span>
          {[0, 3, 6, 9].map(p => {
            const s = pointsShade(p);
            return <span key={p} style={{ width: 11, height: 11, borderRadius: 2, background: s.bg, border: `1px solid ${s.border}` }} />;
          })}
          <span style={{ color: "var(--parchment-faint)" }}>9 pts</span>
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--parchment-muted)" }}>
          <span style={{ width: 11, height: 11, borderRadius: 2, background: "var(--ink-800)", border: "1px solid var(--ink-700)", opacity: 0.6 }} />
          missed
        </span>
      </div>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ minWidth: YEAR_LABEL_W + gridW }}>
          {/* Month header */}
          <div style={{ display: "flex", marginBottom: 4 }}>
            <div style={{ width: YEAR_LABEL_W, flexShrink: 0 }} />
            <div style={{ position: "relative", width: gridW, height: 12 }}>
              {HEAT_MONTHS.map(m => (
                <span key={m.label} style={{ position: "absolute", left: m.col * (CELL + GAP), fontSize: 9, color: "var(--parchment-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</span>
              ))}
            </div>
          </div>
          <div style={{ paddingTop: 16 }}>
            {years.map(({ year, row }) => (
              <div key={year} style={{ display: "flex", alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: YEAR_LABEL_W, flexShrink: 0, fontSize: 10, fontWeight: 700, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>{year}</div>
                <div style={{ position: "relative", display: "grid", gridTemplateColumns: `repeat(${WEEK_COLS}, ${CELL}px)`, gap: GAP, width: gridW }}>
                  {Array.from({ length: WEEK_COLS }, (_, col) => {
                    const cell = row.get(col);
                    if (!cell) return <span key={col} style={{ width: CELL, height: CELL }} />;
                    const att = cell.attended;
                    const shade = pointsShade(cell.points);
                    const event = eventByDate.get(cell.e.held_on);
                    const clickable = onEventSelect && event;
                    const label = `${event ? `MMM #${event.number} · ` : ""}${cell.setCode ? `${cell.setCode.toUpperCase()} · ` : ""}${fmtDate(cell.e.held_on)}${att ? ` · ${cell.points} pts` : " · missed"}`;
                    return (
                      <span key={col}
                        role={clickable ? "button" : undefined}
                        onClick={clickable ? () => onEventSelect!(event!) : undefined}
                        title={label}
                        style={{
                          position: "relative",
                          width: CELL, height: CELL, borderRadius: 2,
                          background: att ? shade.bg : "var(--ink-800)",
                          border: `1px solid ${att ? shade.border : "var(--ink-700)"}`,
                          opacity: att ? 1 : 0.6,
                          cursor: clickable ? "pointer" : "default",
                        }}
                      >
                        {/* A trophy on a perfect 9-point night. */}
                        {att && cell.points === 9 && (
                          <span style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", pointerEvents: "none", zIndex: 3, display: "flex" }}>
                            <TrophyIcon size={9} />
                          </span>
                        )}
                      </span>
                    );
                  })}
                  {/* Season boundaries as a separate overlay (not inside the cells) so the divider
                      and set-code label render identically regardless of whether the season's
                      first event was attended or missed. Label sits right of the divider by
                      default, flipping left when the next season starts within two weeks. */}
                  {Array.from(row.entries()).filter(([, c]) => c.setCode).map(([col, c]) => {
                    const x = col * (CELL + GAP) - Math.ceil(GAP / 2) - 1;
                    return (
                      <span key={`sep-${col}`} style={{ position: "absolute", left: x, top: -16, height: CELL + 20, pointerEvents: "none", zIndex: 4 }}>
                        <span style={{
                          position: "absolute", left: 0, top: 0, bottom: 0, width: 2, borderRadius: 1,
                          background: "var(--primary-300)", boxShadow: "0 0 3px color-mix(in srgb, var(--primary-300) 60%, transparent)",
                        }} />
                        <span style={{
                          position: "absolute", top: 0, left: 1,
                          transform: c.labelLeft ? "translateX(-100%)" : "none",
                          paddingLeft: c.labelLeft ? 0 : 3, paddingRight: c.labelLeft ? 3 : 0,
                          fontSize: 9, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase",
                          color: "var(--primary-200)", whiteSpace: "nowrap",
                        }}>{c.setCode!.toUpperCase()}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoundBreakdown({ player }: { player: StandingEntry }) {
  const total = player.match_wins + player.match_losses + player.match_draws;
  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 14 }}>
        <KvBlock label="Rounds played" value={total} />
        <KvBlock label="Match points"  value={player.points} accent />
        <KvBlock label="Win rate"      value={`${(player.win_pct * 100).toFixed(0)}%`} />
      </div>
      <div style={{ height: 28, display: "flex", borderRadius: 6, overflow: "hidden", border: "1px solid var(--ink-700)" }}>
        {player.match_wins > 0 && (
          <div style={{ flex: player.match_wins, background: "color-mix(in srgb, var(--win) 80%, var(--ink-900))", color: "var(--ink-950)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            {player.match_wins}W
          </div>
        )}
        {player.match_draws > 0 && (
          <div style={{ flex: player.match_draws, background: "color-mix(in srgb, var(--draw) 75%, var(--ink-900))", color: "var(--ink-950)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            {player.match_draws}D
          </div>
        )}
        {player.match_losses > 0 && (
          <div style={{ flex: player.match_losses, background: "color-mix(in srgb, var(--loss) 75%, var(--ink-900))", color: "var(--parchment)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, fontFamily: "var(--font-mono)", fontVariantNumeric: "tabular-nums" }}>
            {player.match_losses}L
          </div>
        )}
      </div>
    </div>
  );
}

function KvBlock({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ flex: 1, background: "var(--ink-900)", border: "1px solid var(--ink-700)", borderRadius: 8, padding: "10px 12px" }}>
      <div className="eyebrow">{label}</div>
      <div className="font-display" style={{ fontSize: 22, color: accent ? "var(--accent-300)" : "var(--parchment)", marginTop: 2, lineHeight: 1.1, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}
