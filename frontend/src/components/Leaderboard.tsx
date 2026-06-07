"use client";

import { useState, useMemo } from "react";
import type { StandingEntry, MMLEvent, Scope, Season } from "@/lib/types";
import { fmtPct, fmtAvg, PlayerAvatar, StreakChips, Sparkline } from "@/components/bits";

type SortKey = "points" | "display_name" | "match_wins" | "win_pct" | "avg_pts" | "tournaments_played" | "trophies" | "comp_avg";
type SortDir = "asc" | "desc";
type Density = "comfy" | "compact";

interface LeaderboardProps {
  standings: StandingEntry[];
  scope: Scope;
  season?: Season | null;
  scopedEvents: MMLEvent[];
  showStreak?: boolean;
  showCupLine?: boolean;
  density?: Density;
  defaultSortKey?: SortKey;
  onEventSelect?: (event: MMLEvent) => void;
}

export default function Leaderboard({
  standings,
  scope,
  season,
  scopedEvents,
  showStreak = true,
  showCupLine = true,
  density = "comfy",
  defaultSortKey = "points",
  onEventSelect,
}: LeaderboardProps) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expanded, setExpanded] = useState<number | null>(null);

  const handleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir(d => d === "desc" ? "asc" : "desc");
    else { setSortKey(k); setSortDir(k === "display_name" ? "asc" : "desc"); }
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
  const padY = density === "compact" ? 8 : 12;
  const showAvg     = scope.kind === "season" || scope.kind === "cup" || scope.kind === "alltime";
  const showCompAvg = scope.kind === "season";
  const showEvents  = showAvg;
  const eventLabel  = scope.kind === "pod" || scope.kind === "event" ? "Rounds" : "Events";
  const cupLineEnabled = showCupLine && scope.kind === "season" && !!season?.yearly_cup_id;

  // Build grid template
  const cols: string[] = [];
  cols.push("44px");
  cols.push("minmax(0, 1.6fr)");
  if (showAvg) cols.push("74px");
  cols.push("70px");
  if (showEvents) cols.push("56px");
  cols.push("96px");
  cols.push("70px");
  if (showAvg) cols.push("78px");
  if (showCompAvg) cols.push("80px");
  cols.push("24px");
  const colTemplate = cols.join(" ");

  return (
    <section>
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
        <div style={{ fontSize: 11, color: "var(--parchment-faint)", letterSpacing: "0.12em", textTransform: "uppercase", display: "flex", gap: 16 }}>
          <span><span style={{ color: "var(--accent-300)", fontWeight: 700 }}>{rows.length}</span> showing</span>
          <span>{standings.length} total</span>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: "grid", gridTemplateColumns: colTemplate, gap: 8, padding: "10px 20px", alignItems: "center" }}>
        <SortHead label="#"        k="points"      align="center" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        <SortHead label="Player"   k="display_name" align="left"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        {showAvg && <SortHead label="Trophies" k="trophies" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} title="Events where you scored 9 points" />}
        <SortHead label="Pts"      k="points"             align="right"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        {showEvents && <SortHead label="Evts" k="tournaments_played" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
        <SortHead label="W–L–D"    k="match_wins"         align="center" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        <SortHead label="Win %"    k="win_pct"            align="right"  sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
        {showAvg && <SortHead label="Avg" k="avg_pts" align="right" sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />}
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
        <span />
      </div>

      {/* Rows */}
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map(p => {
          const rank = p.rank;
          const isMedal = showMedals && rank <= 3;
          const cupLine = cupLineEnabled && showMedals && rank === qualifierCount && rows.length > qualifierCount;
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
                onClick={() => setExpanded(isExpanded ? null : p.player_id)}
                className="themed-surface"
                style={{
                  position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
                  display: "grid", gridTemplateColumns: colTemplate, gap: 8, alignItems: "center",
                  background: "var(--ink-900)",
                  border: `1px solid ${borderColor}`,
                  borderRadius: "var(--radius-card)",
                  padding: `${padY}px 16px`,
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
                  <span className="font-display" style={{
                    fontSize: 22, fontWeight: 700, fontVariantNumeric: "tabular-nums",
                    color: rank === 1 ? "var(--accent-300)" : rank === 2 ? "var(--silver-300)" : rank === 3 ? "var(--bronze-300)" : "var(--parchment-muted)",
                  }}>{rank}</span>
                </div>

                {/* Player */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                  <PlayerAvatar name={p.display_name} rank={rank} size={density === "compact" ? 32 : 36} isVeteran={p.is_veteran} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</div>
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
                  <span className="font-display" style={{ fontSize: 20, color: rank === 1 ? "var(--accent-300)" : "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{p.points}</span>
                </div>

                {/* Events played */}
                {showEvents && (
                  <div style={{ textAlign: "right", fontSize: 13, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>
                    {p.tournaments_played}
                  </div>
                )}

                {/* W–L–D */}
                <div style={{ textAlign: "center", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                  <span style={{ color: "var(--win)", fontWeight: 600 }}>{p.match_wins}</span>
                  <span style={{ color: "var(--parchment-faint)", margin: "0 3px" }}>–</span>
                  <span style={{ color: "var(--loss)", fontWeight: 600 }}>{p.match_losses}</span>
                  <span style={{ color: "var(--parchment-faint)", margin: "0 3px" }}>–</span>
                  <span style={{ color: "var(--draw)", fontWeight: 600 }}>{p.match_draws}</span>
                </div>

                {/* Win % */}
                <div style={{ textAlign: "right" }}>
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
                  <div style={{ textAlign: "right", fontSize: 13, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>
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
                <span style={{ color: "var(--parchment-faint)", fontSize: 12, transform: isExpanded ? "rotate(90deg)" : "none", transition: "transform 200ms" }}>▸</span>
              </button>

              {isExpanded && (
                <ExpandedDetail player={p} scope={scope} scopedEvents={scopedEvents} onEventSelect={onEventSelect} />
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

// ---------- TrophyCell ----------

function TrophyIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
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
  k: SortKey;
  align?: "left" | "center" | "right";
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  title?: string;
}

function SortHead({ label, k, align = "left", sortKey, sortDir, onSort, title }: SortHeadProps) {
  const active = sortKey === k;
  const justifyMap = { left: "flex-start", center: "center", right: "flex-end" } as const;
  return (
    <button onClick={() => onSort(k)} title={title} style={{
      background: "none", border: "none", cursor: "pointer", padding: 0,
      width: "100%", textAlign: align, whiteSpace: "nowrap",
      fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 600,
      color: active ? "var(--accent-400)" : "var(--parchment-faint)",
      fontFamily: "inherit",
      display: "inline-flex", alignItems: "center", gap: 4,
      justifyContent: justifyMap[align],
    }}>
      <span>{label}</span>
      <span style={{ fontSize: 9, opacity: active ? 1 : 0.5 }}>{active ? (sortDir === "desc" ? "▼" : "▲") : "⇅"}</span>
    </button>
  );
}

// ---------- ExpandedDetail ----------
interface ExpandedDetailProps {
  player: StandingEntry;
  scope: Scope;
  scopedEvents: MMLEvent[];
  onEventSelect?: (event: MMLEvent) => void;
}

function ExpandedDetail({ player, scope, scopedEvents, onEventSelect }: ExpandedDetailProps) {
  const showPerEvent = scope.kind === "season" || scope.kind === "cup" || scope.kind === "alltime";
  return (
    <div style={{
      marginTop: 4, padding: "16px 20px",
      background: "color-mix(in srgb, var(--ink-850) 80%, transparent)",
      border: "1px solid var(--ink-700)", borderRadius: "var(--radius-card)",
      display: "grid", gridTemplateColumns: showPerEvent ? "1fr 1.2fr" : "1fr", gap: 24,
    }}>
      {showPerEvent && (
        <div>
          <div className="eyebrow" style={{ marginBottom: 10 }}>● Points by event</div>
          <div style={{ paddingTop: 8 }}>
            {(() => {
              const validCount = player.per_event_points.filter(v => v != null).length;
              const useLabels = validCount > 0 && validCount < 15;
              return <Sparkline data={player.per_event_points} width={240} height={useLabels ? 60 : 44} color="var(--primary-300)" showLabels={useLabels} />;
            })()}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--parchment-faint)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>
            <span>Event 1</span>
            <span>Event {player.per_event_points.length}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginTop: 14 }}>
            <StatBlock label="Best" value={Math.max(...player.per_event_points.filter((v): v is number => v != null), 0)} />
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
          : <AttendanceGrid player={player} events={scopedEvents} onEventSelect={onEventSelect} />}
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

function AttendanceGrid({ player, events, onEventSelect }: { player: StandingEntry; events: MMLEvent[]; onEventSelect?: (event: MMLEvent) => void }) {
  const attended = player.attended || [];
  const total = attended.reduce((a: number, b: number) => a + b, 0);
  const missed = attended.length - total;
  const cells = events.slice(-Math.min(events.length, 18)).map((e, i) => {
    const startIdx = events.length - Math.min(events.length, 18);
    return { event: e, attended: attended[startIdx + i] === 1 };
  });

  return (
    <div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "color-mix(in srgb, var(--win) 60%, transparent)", border: "1px solid color-mix(in srgb, var(--win) 50%, transparent)" }} />
          <span style={{ fontSize: 12, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{total} <span style={{ color: "var(--parchment-faint)" }}>attended</span></span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: "var(--ink-800)", border: "1px solid var(--ink-700)" }} />
          <span style={{ fontSize: 12, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{missed} <span style={{ color: "var(--parchment-faint)" }}>missed</span></span>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(60px, 1fr))", gap: 4 }}>
        {cells.map(({ event, attended: att }, i) => {
          const Cell = onEventSelect ? "button" : "div";
          return (
            <Cell key={i} title={`MMM #${event.number} · ${event.held_on}${att ? " · attended" : " · missed"}`}
              onClick={onEventSelect ? () => onEventSelect(event) : undefined}
              style={{
                padding: "8px 6px", borderRadius: 4,
                background: att ? "color-mix(in srgb, var(--win) 18%, transparent)" : "var(--ink-800)",
                border: `1px solid ${att ? "color-mix(in srgb, var(--win) 35%, transparent)" : "var(--ink-700)"}`,
                display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                opacity: att ? 1 : 0.55,
                fontFamily: "inherit", cursor: onEventSelect ? "pointer" : "default",
                transition: "border-color 150ms, opacity 150ms",
              }}
              onMouseEnter={onEventSelect ? e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--primary-400)"; (e.currentTarget as HTMLElement).style.opacity = "1"; } : undefined}
              onMouseLeave={onEventSelect ? e => { (e.currentTarget as HTMLElement).style.borderColor = att ? "color-mix(in srgb, var(--win) 35%, transparent)" : "var(--ink-700)"; (e.currentTarget as HTMLElement).style.opacity = att ? "1" : "0.55"; } : undefined}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: att ? "var(--win)" : "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>#{event.number}</span>
              <span style={{ fontSize: 9, color: "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>
                {new Date(event.held_on + "T00:00:00").toLocaleDateString("en-AU", { month: "short", day: "numeric" })}
              </span>
            </Cell>
          );
        })}
      </div>
      {events.length > 18 && (
        <div style={{ marginTop: 8, fontSize: 11, color: "var(--parchment-faint)", textAlign: "right" }}>Showing last 18 of {events.length} events</div>
      )}
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
