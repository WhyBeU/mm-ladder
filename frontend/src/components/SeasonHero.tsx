"use client";

import type { Scope, Season, YearlyCup, StandingEntry, SeasonStats, MMLEvent } from "@/lib/types";
import { fmtDate, fmtPct, PlayerAvatar, Sparkline } from "@/components/bits";

interface SeasonHeroProps {
  scope: Scope;
  season: Season | null;
  cup: YearlyCup | null;
  event: MMLEvent | null;
  leader: StandingEntry | undefined;
  stats: SeasonStats;
  eventsCount: number;
  compAvgN?: number;
}

export function SeasonHero({ scope, season, cup, event, leader, stats, eventsCount, compAvgN }: SeasonHeroProps) {
  let eyebrowLeft = "Standings", eyebrowRight = "";
  let title = "", subtitle = "", badge: string | null = null, keyrune: string | null = null;

  if (scope.kind === "alltime") {
    eyebrowRight = "All-time"; title = "All-time Ladder"; subtitle = "Across every season";
  } else if (scope.kind === "cup" && cup) {
    eyebrowRight = `${cup.year} Cup`; title = cup.name;
    subtitle = `Top 2 qualify per qualifying season`;
    badge = "● Live";
  } else if (scope.kind === "season" && season) {
    eyebrowRight = "Full season"; title = season.name;
    subtitle = `${fmtDate(season.starts_on)} — ${fmtDate(season.ends_on)} · ${season.set_code} Booster Draft`;
    keyrune = season.keyrune;
    badge = season.is_current ? "● Live" : null;
  } else if (scope.kind === "event" && event) {
    const seasonName = season?.name ?? "";
    eyebrowLeft = seasonName; eyebrowRight = "Single event";
    const total = event.pods.reduce((s, p) => s + p.participant_count, 0);
    const pods = event.pods.length > 1 ? ` · ${event.pods.length} pods` : "";
    title = `MMM #${event.number}`;
    subtitle = `${fmtDate(event.held_on)} · ${total} players${pods}`;
    keyrune = season?.keyrune ?? null;
  } else if (scope.kind === "pod" && event) {
    const pod = event.pods.find(p => p.id === scope.podId);
    eyebrowLeft = `MMM #${event.number}`; eyebrowRight = "Pod standings";
    title = pod?.name ?? `Pod ${scope.podId}`;
    subtitle = `${fmtDate(event.held_on)} · ${pod?.participant_count ?? 0} players`;
    keyrune = season?.keyrune ?? null;
  }

  return (
    <section style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16, marginBottom: 20 }}>
      {/* Title card */}
      <div className="themed-surface" style={{
        position: "relative", borderRadius: "var(--radius-card)",
        border: "1px solid var(--ink-700)",
        background: "linear-gradient(135deg, var(--ink-900), var(--ink-850) 60%, var(--ink-800))",
        padding: "26px 26px 22px", overflow: "hidden", minHeight: 188,
      }}>
        {keyrune && (
          <i className={`ss ss-${keyrune} ss-fw`} style={{
            position: "absolute", right: 24, top: "50%", transform: "translateY(-50%)",
            fontSize: 180, color: "color-mix(in srgb, var(--parchment) 8%, transparent)",
            pointerEvents: "none",
          }} />
        )}
        <div style={{ position: "relative", zIndex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="eyebrow">{eyebrowLeft} · {eyebrowRight}</span>
            {badge && (
              <span style={{
                fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700,
                padding: "2px 7px", borderRadius: 4,
                background: "color-mix(in srgb, var(--win) 18%, transparent)",
                color: "var(--win)", border: "1px solid color-mix(in srgb, var(--win) 35%, transparent)",
              }}>{badge}</span>
            )}
          </div>
          <h1 className="font-display" style={{ margin: 0, fontSize: 38, lineHeight: 1.05, letterSpacing: "0.01em", color: "var(--parchment)" }}>
            {title}
          </h1>
          <div style={{ fontSize: 13, color: "var(--parchment-muted)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
            {subtitle}
          </div>

          {scope.kind === "season" && season?.yearly_cup_id && (
            <div style={{ marginTop: 18, padding: "12px 14px", borderRadius: 10, background: "color-mix(in srgb, var(--accent-400) 8%, transparent)", border: "1px solid color-mix(in srgb, var(--accent-400) 22%, transparent)", display: "flex", alignItems: "center", gap: 14 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                <path style={{ fill: "var(--accent-300)" }} d="M5 4h14l-1 8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4L5 4Zm5 13h4l1 3H9l1-3Z" />
              </svg>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--accent-300)", letterSpacing: "0.04em" }}>Cup-qualifying season</span>
                  <span style={{ fontSize: 11, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>Top {season.qualifier_count} qualify</span>
                </div>
                <div style={{ marginTop: 8, height: 6, background: "var(--ink-800)", borderRadius: 3, overflow: "hidden" }}>
                  <div className="bg-gold-sheen" style={{ height: "100%", width: `${Math.min(100, (eventsCount / (season?.event_count ?? 12)) * 100)}%`, borderRadius: 3 }} />
                </div>
                <div style={{ marginTop: 6, display: "flex", justifyContent: "space-between", fontSize: 11, color: "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>
                  <span>{eventsCount} of {season?.event_count ?? 12} events</span>
                  <span>{stats.players} contending</span>
                </div>
              </div>
            </div>
          )}

          {scope.kind === "season" && compAvgN != null && (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--parchment-muted)", display: "flex", alignItems: "center", gap: 6 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-300)" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M12 8v4l3 3"/></svg>
              <span>Comp Avg = avg of your best <strong style={{ color: "var(--accent-300)" }}>{compAvgN}</strong> events</span>
            </div>
          )}
        </div>
      </div>

      {/* Leader card */}
      {leader && (
        <div className="themed-surface" style={{
          position: "relative", borderRadius: "var(--radius-card)",
          border: "1px solid color-mix(in srgb, var(--accent-400) 30%, transparent)",
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent-400) 10%, var(--ink-900)) 0%, var(--ink-850) 70%)",
          padding: "20px 22px", overflow: "hidden", boxShadow: "var(--shadow-card)",
        }}>
          <div style={{
            position: "absolute", right: -20, top: -20, width: 140, height: 140, borderRadius: "50%",
            background: "radial-gradient(circle, color-mix(in srgb, var(--accent-400) 30%, transparent), transparent 70%)",
          }} />
          <div style={{ position: "relative" }}>
            <div className="eyebrow" style={{ color: "var(--accent-300)" }}>● {scope.kind === "pod" || scope.kind === "event" ? "Winner" : "Current leader"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
              <PlayerAvatar name={leader.display_name} rank={1} size={56} />
              <div style={{ minWidth: 0 }}>
                <div className="font-display" style={{ fontSize: 22, lineHeight: 1.15, color: "var(--parchment)" }}>{leader.display_name}</div>
                <div style={{ fontSize: 12, color: "var(--parchment-muted)", marginTop: 2 }}>
                  {leader.tournaments_played} events · {fmtPct(leader.win_pct)} win rate
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 16, alignItems: "flex-end" }}>
              <div>
                <div className="font-display" style={{ fontSize: 38, lineHeight: 1, color: "var(--accent-300)", fontVariantNumeric: "tabular-nums" }}>{leader.points}</div>
                <div className="eyebrow">Points</div>
              </div>
              <div style={{ width: 1, alignSelf: "stretch", background: "color-mix(in srgb, var(--accent-400) 25%, transparent)" }} />
              <div style={{ flex: 1 }}>
                <Sparkline
                  data={leader.per_event_points.filter((v): v is number => v != null)}
                  width={150} height={36}
                  color="var(--accent-400)"
                />
                <div className="eyebrow" style={{ marginTop: 4 }}>Pts per event</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

interface StatsStripProps {
  stats: SeasonStats;
  totalPlayers: number;
}

export function StatsStrip({ stats, totalPlayers }: StatsStripProps) {
  const items = [
    { label: "Events held",    value: stats.events,                   sub: "in scope" },
    { label: "Active players", value: stats.players,                  sub: `of ${totalPlayers} registered` },
    { label: "Matches played", value: stats.matches,                  sub: `${stats.matchesPerEvent.toFixed(1)} avg / event` },
    { label: "Avg attendance", value: stats.avgAttendance.toFixed(1), sub: "players per event" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
      {items.map((it, i) => (
        <div key={i} className="themed-surface" style={{
          background: "var(--ink-900)", border: "1px solid var(--ink-700)",
          borderRadius: 10, padding: "14px 16px",
        }}>
          <div className="eyebrow">{it.label}</div>
          <div className="font-display" style={{ fontSize: 28, lineHeight: 1.1, color: "var(--parchment)", marginTop: 4, fontVariantNumeric: "tabular-nums" }}>{it.value}</div>
          <div style={{ fontSize: 11, color: "var(--parchment-faint)", marginTop: 2 }}>{it.sub}</div>
        </div>
      ))}
    </div>
  );
}
