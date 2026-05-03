"use client";

import { useState, useMemo, useEffect } from "react";
import type { Scope, StandingEntry, SeasonStats, MMLEvent } from "@/lib/types";
import {
  yearlyCups, seasons, events, players,
  standings as seasonStandings, allTimeStandings, cupStandings,
  eventStandings, podStandings,
} from "@/lib/mockData";
import NavSidebar from "@/components/NavSidebar";
import ManaSwitcher from "@/components/ManaSwitcher";
import Leaderboard from "@/components/Leaderboard";
import { SeasonHero, StatsStrip } from "@/components/SeasonHero";
import { Podium } from "@/components/Podium";

// ---------- Scope breadcrumb ----------
function ScopeBreadcrumb({ scope, onPart }: { scope: Scope; onPart: (s: Scope) => void }) {
  const parts: { label: string; onClick: () => void }[] = [];
  parts.push({ label: "All-time", onClick: () => onPart({ kind: "alltime" }) });
  if (scope.cupId != null) {
    const cup = yearlyCups.find(y => y.id === scope.cupId);
    if (cup) parts.push({ label: cup.name, onClick: () => onPart({ kind: "cup", cupId: cup.id }) });
  }
  if (scope.seasonId != null) {
    const s = seasons.find(x => x.id === scope.seasonId);
    if (s) parts.push({ label: s.name, onClick: () => onPart({ kind: "season", cupId: s.yearly_cup_id, seasonId: s.id }) });
  }
  if (scope.eventId != null) {
    const e = events.find(x => x.id === scope.eventId);
    if (e) parts.push({ label: `MMM #${e.number}`, onClick: () => onPart({ kind: "event", cupId: scope.cupId, seasonId: scope.seasonId, eventId: e.id }) });
  }
  if (scope.podId != null) {
    const e = events.find(x => x.id === scope.eventId);
    const pod = e?.pods.find(p => p.id === scope.podId);
    if (pod) parts.push({ label: pod.name.replace(/^MMM #\d+\s*·\s*/, "Pod "), onClick: () => {} });
  }

  return (
    <div className="eyebrow" style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", lineHeight: 1.5 }}>
      {parts.map((p, i) => (
        <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          {i > 0 && <span style={{ color: "color-mix(in srgb, var(--parchment-faint) 50%, transparent)" }}>›</span>}
          {i < parts.length - 1
            ? <button onClick={p.onClick} style={{ background: "none", border: "none", color: "var(--parchment-muted)", padding: 0, cursor: "pointer", fontFamily: "inherit", fontSize: "inherit", letterSpacing: "inherit", textTransform: "inherit", fontWeight: "inherit" }}>{p.label}</button>
            : <span style={{ color: "var(--parchment)" }}>{p.label}</span>}
        </span>
      ))}
    </div>
  );
}

// ---------- Helpers ----------
function computeStats(scopedEvents: MMLEvent[], scopeStandings: StandingEntry[]): SeasonStats {
  const totalParticipants = scopedEvents.reduce((s, e) => s + e.pods.reduce((a, p) => a + p.participant_count, 0), 0);
  const totalMatches = scopeStandings.reduce((s, p) => s + p.match_wins + p.match_losses + p.match_draws, 0) / 2;
  const podCount = scopedEvents.reduce((s, e) => s + e.pods.length, 0);
  return {
    events: scopedEvents.length,
    pods: podCount,
    players: scopeStandings.length,
    matches: Math.round(totalMatches),
    matchesPerEvent: podCount ? totalMatches / podCount : 0,
    avgAttendance: podCount ? totalParticipants / podCount : 0,
  };
}

// ---------- Page ----------
export default function LeaderboardPage() {
  const [scope, setScope] = useState<Scope>({ kind: "season", cupId: 1, seasonId: 3 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [lastUpdated] = useState(new Date());
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Resolve context
  const cup    = scope.cupId    ? yearlyCups.find(y => y.id === scope.cupId)   ?? null : null;
  const season = scope.seasonId ? seasons.find(s => s.id === scope.seasonId)   ?? null : null;
  const event  = scope.eventId  ? events.find(e => e.id === scope.eventId)     ?? null : null;

  // Standings for scope
  const scopeStandings = useMemo((): StandingEntry[] => {
    if (scope.kind === "alltime") return allTimeStandings;
    if (scope.kind === "cup")     return cupStandings;
    if (scope.kind === "season")  return seasonStandings;
    if (scope.kind === "event" && scope.eventId)  return eventStandings(scope.eventId);
    if (scope.kind === "pod"   && scope.podId != null) return podStandings(scope.podId);
    return [];
  }, [scope]);

  // Scoped events
  const scopedEvents = useMemo((): MMLEvent[] => {
    if (scope.kind === "alltime") return events;
    if (scope.kind === "cup")     return events.filter(e => seasons.find(s => s.id === e.season_id)?.yearly_cup_id === scope.cupId);
    if (scope.kind === "season")  return events.filter(e => e.season_id === scope.seasonId);
    if (scope.kind === "event" && event) return [event];
    if (scope.kind === "pod"   && event) return [event];
    return [];
  }, [scope, event]);

  const stats = useMemo(() => computeStats(scopedEvents, scopeStandings), [scopedEvents, scopeStandings]);
  const leader = scopeStandings[0];

  const showPodium = (scope.kind === "season" || scope.kind === "cup" || scope.kind === "alltime") && scopeStandings.length >= 3;

  const heroCtx = {
    season: scope.kind === "alltime" ? null : (scope.kind === "cup" ? null : season),
    cup:    scope.kind === "alltime" ? null : cup,
  };

  const relativeTime = (date: Date) => {
    const diff = Date.now() - date.getTime();
    const min = Math.floor(diff / 60000);
    if (min < 1) return "just now";
    if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
    return `${Math.floor(min / 60)} hours ago`;
  };

  return (
    <div style={{ display: "flex", minHeight: "100vh", overflowX: "hidden" }}>

      {/* Desktop sidebar */}
      <div className="hidden md:block" style={{ flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <NavSidebar scope={scope} setScope={setScope} yearlyCups={yearlyCups} seasons={seasons} events={events} />
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="md:hidden"
            onClick={() => setDrawerOpen(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(11,18,32,0.7)", backdropFilter: "blur(4px)", zIndex: 40 }}
          />
          <div className="md:hidden" style={{ position: "fixed", inset: "0 auto 0 0", width: 296, zIndex: 50, boxShadow: "0 24px 64px -8px rgba(0,0,0,0.7)" }}>
            <NavSidebar scope={scope} setScope={(s) => { setScope(s); setDrawerOpen(false); }} yearlyCups={yearlyCups} seasons={seasons} events={events} onClose={() => setDrawerOpen(false)} />
          </div>
        </>
      )}

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>

        {/* Mobile top bar */}
        <div className="md:hidden" style={{
          position: "sticky", top: 0, zIndex: 30,
          background: "color-mix(in srgb, var(--ink-950) 85%, transparent)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--ink-700)",
          padding: "12px 16px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <button onClick={() => setDrawerOpen(true)} style={{ background: "none", border: "none", color: "var(--parchment-muted)", cursor: "pointer", padding: 4, display: "flex" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="18" y2="18"/></svg>
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 16, color: "var(--parchment)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {season?.name ?? cup?.name ?? "MM Ladder"}
            </div>
          </div>
          <ManaSwitcher size="sm" />
        </div>

        {/* Desktop sticky header */}
        <header style={{
          position: "sticky", top: 0, zIndex: 20,
          background: "color-mix(in srgb, var(--ink-950) 88%, transparent)",
          backdropFilter: "blur(8px)",
          borderBottom: "1px solid var(--ink-700)",
          padding: "14px 32px",
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
        }} className="hidden md:flex">
          <div style={{ minWidth: 0, flex: 1 }}>
            <ScopeBreadcrumb scope={scope} onPart={setScope} />
            <h2 className="font-display" style={{ margin: "2px 0 0", fontSize: 22, color: "var(--parchment)", letterSpacing: "0.02em" }}>Magic Mates Draft Ladder</h2>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <ManaSwitcher />
            <button style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "transparent", border: "none", color: "var(--parchment-muted)",
              fontSize: 12, cursor: "pointer", fontFamily: "inherit",
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-3-6.7" /><path d="M21 4v5h-5" /></svg>
              Refresh
            </button>
          </div>
        </header>

        {/* Main content */}
        <main style={{ flex: 1, padding: "28px 32px 32px", maxWidth: 1320, width: "100%", margin: "0 auto" }}>
          <SeasonHero
            scope={scope}
            season={heroCtx.season}
            cup={heroCtx.cup}
            event={event}
            leader={leader}
            stats={stats}
            eventsCount={scopedEvents.length}
          />
          <StatsStrip stats={stats} totalPlayers={players.length} />
          {showPodium && <Podium standings={scopeStandings} />}
          <Leaderboard
            standings={scopeStandings}
            scope={scope}
            season={season}
            scopedEvents={scopedEvents}
          />
        </main>

        {/* Footer */}
        <footer style={{
          marginTop: 24, padding: "20px 32px",
          borderTop: "1px solid color-mix(in srgb, var(--ink-700) 60%, transparent)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: 11, color: "var(--parchment-faint)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse-soft" style={{ width: 6, height: 6, borderRadius: 3, background: "var(--win)", display: "inline-block" }} />
            <span>Last updated <span style={{ color: "var(--parchment-muted)" }}>{relativeTime(lastUpdated)}</span> · {stats.players} players in scope</span>
          </div>
          <div className="eyebrow">Magic Mates Monday @ Chromatic Games</div>
        </footer>
      </div>
    </div>
  );
}
