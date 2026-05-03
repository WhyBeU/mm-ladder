"use client";

import Image from "next/image";
import type { Scope, YearlyCup, Season, MMLEvent } from "@/lib/types";
import { fmtDate } from "@/components/bits";

interface NavSidebarProps {
  scope: Scope;
  setScope: (s: Scope) => void;
  yearlyCups: YearlyCup[];
  seasons: Season[];
  events: MMLEvent[];
  onClose?: () => void;
}

function isActive(scope: Scope, test: Partial<Scope>): boolean {
  return (Object.keys(test) as (keyof Scope)[]).every(k => scope[k] === test[k]);
}

export default function NavSidebar({ scope, setScope, yearlyCups, seasons, events, onClose }: NavSidebarProps) {
  return (
    <aside style={{
      height: "100vh", display: "flex", flexDirection: "column",
      background: "var(--ink-900)", borderRight: "1px solid var(--ink-700)",
      width: 296, flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{
        padding: "20px 20px 16px",
        borderBottom: "1px solid color-mix(in srgb, var(--ink-700) 60%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10, flexShrink: 0,
            background: "var(--parchment)", padding: 4,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 0 1px color-mix(in srgb, var(--accent-400) 40%, transparent), var(--shadow-gold-glow)",
          }}>
            <Image
              src="/magic-mates-logo.png"
              alt="Magic Mates"
              width={36}
              height={36}
              style={{ objectFit: "contain" }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="font-display" style={{ fontSize: 17, lineHeight: 1.05, color: "var(--parchment)", letterSpacing: "0.02em" }}>Draft Ladder</div>
            <div className="eyebrow" style={{ marginTop: 2 }}>Magic Mates</div>
          </div>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--parchment-faint)", cursor: "pointer", fontSize: 18, padding: 4 }} aria-label="Close menu">✕</button>
        )}
      </div>

      {/* Scope tree */}
      <nav className="scroll-pretty" style={{ flex: 1, overflowY: "auto", padding: "12px 10px 16px" }}>
        <div className="eyebrow" style={{ padding: "6px 10px 8px" }}>Scope</div>

        {/* All-time */}
        <ScopeRow
          icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>}
          label="All-time"
          sub="Across every season"
          active={isActive(scope, { kind: "alltime" })}
          onClick={() => setScope({ kind: "alltime" })}
        />

        {/* Yearly cups */}
        {yearlyCups.map(cup => {
          const cupActive = scope.cupId === cup.id;
          const seasonsHere = seasons.filter(s => s.yearly_cup_id === cup.id);
          return (
            <div key={cup.id} style={{ marginTop: 4 }}>
              <ScopeRow
                icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4h14l-1 8a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4L5 4Zm5 13h4l1 3H9l1-3Z"/></svg>}
                label={cup.name}
                sub={`${seasonsHere.length} qualifying seasons`}
                active={isActive(scope, { kind: "cup", cupId: cup.id })}
                expanded={cupActive}
                onClick={() => setScope({ kind: "cup", cupId: cup.id })}
                accent
              />

              {cupActive && (
                <div style={{ marginLeft: 14, marginTop: 4, paddingLeft: 10, borderLeft: "1px solid color-mix(in srgb, var(--ink-700) 80%, transparent)" }}>
                  {seasonsHere.map(season => {
                    const seasonActive = scope.seasonId === season.id;
                    return (
                      <div key={season.id}>
                        <ScopeRow
                          icon={<i className={`ss ss-${season.keyrune}`} style={{ fontSize: 16, color: "var(--parchment)" }} />}
                          label={season.name}
                          sub={`${season.set_code} · ${events.filter(e => e.season_id === season.id).length} events`}
                          active={isActive(scope, { kind: "season", seasonId: season.id })}
                          expanded={seasonActive}
                          current={season.is_current}
                          onClick={() => setScope({ kind: "season", cupId: cup.id, seasonId: season.id })}
                        />

                        {seasonActive && (
                          <div style={{ marginLeft: 14, marginTop: 4, paddingLeft: 10, borderLeft: "1px solid color-mix(in srgb, var(--ink-700) 60%, transparent)" }}>
                            {events.filter(e => e.season_id === season.id).length === 0 && (
                              <div style={{ padding: "8px 12px", fontSize: 11, color: "var(--parchment-faint)" }}>No events yet</div>
                            )}
                            {events.filter(e => e.season_id === season.id).map(ev => {
                              const eventActive = scope.eventId === ev.id;
                              const hasMultiplePods = ev.pods.length > 1;
                              return (
                                <div key={ev.id}>
                                  <EventRow
                                    event={ev}
                                    active={isActive(scope, { kind: "event", eventId: ev.id })}
                                    expanded={eventActive && hasMultiplePods}
                                    onClick={() => setScope({ kind: "event", cupId: cup.id, seasonId: season.id, eventId: ev.id })}
                                  />
                                  {eventActive && hasMultiplePods && (
                                    <div style={{ marginLeft: 12, marginTop: 2, paddingLeft: 10, borderLeft: "1px solid color-mix(in srgb, var(--ink-700) 50%, transparent)" }}>
                                      {ev.pods.map(pod => (
                                        <PodRow
                                          key={pod.id}
                                          pod={pod}
                                          active={scope.kind === "pod" && scope.podId === pod.id}
                                          onClick={() => setScope({ kind: "pod", cupId: cup.id, seasonId: season.id, eventId: ev.id, podId: pod.id })}
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div style={{ padding: "12px 20px", borderTop: "1px solid color-mix(in srgb, var(--ink-700) 60%, transparent)" }} className="eyebrow">
        @ Chromatic Games · since 2016
      </div>
    </aside>
  );
}

interface ScopeRowProps {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  active: boolean;
  expanded?: boolean;
  onClick: () => void;
  accent?: boolean;
  current?: boolean;
}

function ScopeRow({ icon, label, sub, active, expanded, onClick, accent, current }: ScopeRowProps) {
  return (
    <button onClick={onClick} className="themed-surface" style={{
      position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
      display: "flex", alignItems: "center", gap: 10,
      padding: "8px 10px", borderRadius: 8,
      background: active ? (accent ? "color-mix(in srgb, var(--accent-400) 12%, transparent)" : "var(--ink-850)") : "transparent",
      border: active
        ? `1px solid color-mix(in srgb, ${accent ? "var(--accent-400)" : "var(--primary-400)"} 45%, transparent)`
        : "1px solid transparent",
      color: active ? "var(--parchment)" : "var(--parchment-muted)",
      fontFamily: "inherit",
    }}>
      {active && (
        <span style={{
          position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2,
          background: accent
            ? "linear-gradient(180deg, var(--accent-300), var(--accent-500))"
            : "linear-gradient(180deg, var(--primary-300), var(--primary-500))",
        }} />
      )}
      <span style={{ width: 18, display: "inline-flex", justifyContent: "center", color: active && accent ? "var(--accent-300)" : "currentColor" }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 13, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
          {current && (
            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--win) 18%, transparent)", color: "var(--win)", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 700 }}>Live</span>
          )}
        </div>
        {sub && <div style={{ fontSize: 11, color: "var(--parchment-faint)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</div>}
      </span>
      <span style={{ fontSize: 10, color: "var(--parchment-faint)", transform: expanded ? "rotate(90deg)" : "none", transition: "transform 150ms" }}>▸</span>
    </button>
  );
}

interface EventRowProps {
  event: MMLEvent;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}

function EventRow({ event, active, expanded: _expanded, onClick }: EventRowProps) {
  const total = event.pods.reduce((s, p) => s + p.participant_count, 0);
  const allBackfill = event.pods.every(p => !p.has_match_detail);
  return (
    <button onClick={onClick} className="themed-surface" style={{
      position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
      display: "block", padding: "8px 10px", borderRadius: 6,
      background: active ? "var(--ink-850)" : "transparent",
      border: active ? "1px solid color-mix(in srgb, var(--accent-400) 50%, transparent)" : "1px solid transparent",
      color: active ? "var(--parchment)" : "var(--parchment-muted)",
      fontFamily: "inherit", marginTop: 2,
    }}>
      {active && (
        <span style={{ position: "absolute", left: 0, top: 8, bottom: 8, width: 3, borderRadius: 2, background: "linear-gradient(180deg, var(--accent-300), var(--accent-500))" }} />
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>MMM #{event.number}</span>
        <span style={{ fontSize: 10, color: "var(--parchment-faint)", display: "inline-flex", alignItems: "center", gap: 4, fontVariantNumeric: "tabular-nums" }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0Z"/></svg>
          {total}
        </span>
      </div>
      <div style={{ fontSize: 11, color: "var(--parchment-faint)", marginTop: 2, display: "flex", alignItems: "center", gap: 6, fontVariantNumeric: "tabular-nums" }}>
        <span>{fmtDate(event.held_on)}</span>
        {event.pods.length > 1 && (
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--primary-400) 22%, transparent)", color: "var(--primary-300)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{event.pods.length} pods</span>
        )}
        {allBackfill && (
          <span style={{ fontSize: 9, padding: "1px 5px", borderRadius: 3, background: "color-mix(in srgb, var(--parchment-faint) 18%, transparent)", color: "var(--parchment-muted)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Backfill</span>
        )}
      </div>
    </button>
  );
}

interface PodRowProps {
  pod: { id: number; name: string; participant_count: number };
  active: boolean;
  onClick: () => void;
}

function PodRow({ pod, active, onClick }: PodRowProps) {
  return (
    <button onClick={onClick} className="themed-surface" style={{
      position: "relative", width: "100%", textAlign: "left", cursor: "pointer",
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 10px", borderRadius: 6, marginTop: 2,
      background: active ? "var(--ink-850)" : "transparent",
      border: active ? "1px solid color-mix(in srgb, var(--accent-400) 50%, transparent)" : "1px solid transparent",
      color: active ? "var(--parchment)" : "var(--parchment-muted)",
      fontFamily: "inherit", fontSize: 12,
    }}>
      {active && <span style={{ position: "absolute", left: 0, top: 6, bottom: 6, width: 2, borderRadius: 2, background: "var(--accent-400)" }} />}
      <span style={{ fontWeight: 500 }}>{pod.name.replace(/^MMM #\d+\s*·\s*/, "Pod ")}</span>
      <span style={{ fontSize: 10, color: "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>{pod.participant_count}p</span>
    </button>
  );
}
