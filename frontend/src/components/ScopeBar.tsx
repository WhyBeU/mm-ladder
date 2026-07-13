"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import type { Scope, YearlyCup, Season, MMLEvent } from "@/lib/types";

interface ScopeBarProps {
  scope: Scope;
  setScope: (s: Scope) => void;
  yearlyCups: YearlyCup[];
  seasons: Season[];
  events: MMLEvent[];
}

const DROPDOWN_STYLE: React.CSSProperties = {
  position: "fixed", zIndex: 200,
  background: "var(--ink-850)", border: "1px solid var(--ink-700)",
  borderRadius: 8, padding: "4px 0", minWidth: 200, maxHeight: 320, overflowY: "auto",
  boxShadow: "0 8px 24px rgba(0,0,0,0.6)",
};

const ITEM_STYLE: React.CSSProperties = {
  padding: "5px 14px", fontSize: 13, textAlign: "left", cursor: "pointer",
  color: "var(--parchment)", background: "none", border: "none",
  fontFamily: "inherit", width: "100%", whiteSpace: "nowrap", display: "block",
};

type DropdownLevel = "cup" | "season" | "event";

// Portal dropdown — renders at document.body level so it escapes overflow containers
function PortalDropdown({
  anchorRef,
  open,
  children,
}: {
  anchorRef: React.RefObject<HTMLElement | null>;
  open: boolean;
  children: React.ReactNode;
}) {
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open || !anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    // Clamp so the dropdown (min-width 200) never overflows the right viewport edge
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - 200 - 8));
    setCoords({ top: rect.bottom + 6, left });
  }, [open, anchorRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div data-scopebar-portal style={{ ...DROPDOWN_STYLE, top: coords.top, left: coords.left, maxWidth: "calc(100vw - 16px)" }}>
      {children}
    </div>,
    document.body,
  );
}

export default function ScopeBar({ scope, setScope, yearlyCups, seasons, events }: ScopeBarProps) {
  const [openDropdown, setOpenDropdown] = useState<DropdownLevel | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpenDropdown(null), []);

  useEffect(() => {
    if (!openDropdown) return;
    function onMouseDown(e: MouseEvent) {
      const target = e.target as Element;
      // Don't close if clicking inside the bar or inside a portal dropdown
      if (barRef.current?.contains(target)) return;
      if (target.closest?.("[data-scopebar-portal]")) return;
      close();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openDropdown, close]);

  const cup    = scope.cupId    != null ? yearlyCups.find(y => y.id === scope.cupId)  ?? null : null;
  const season = scope.seasonId != null ? seasons.find(s => s.id === scope.seasonId)  ?? null : null;
  const event  = scope.eventId  != null ? events.find(e => e.id === scope.eventId)    ?? null : null;

  const seasonsInCup   = scope.cupId    != null ? seasons.filter(s => s.yearly_cup_id === scope.cupId) : [];
  const eventsInSeason = scope.seasonId != null ? events.filter(e => e.season_id === scope.seasonId)   : [];

  // All seasons grouped by cup year (newest first) for direct-season dropdown
  const seasonsByCup: { cup: YearlyCup | null; seasons: Season[] }[] = [];
  const sortedCups = [...yearlyCups].sort((a, b) => b.year - a.year);
  for (const c of sortedCups) {
    const cs = seasons.filter(s => s.yearly_cup_id === c.id).sort((a, b) => a.starts_on.localeCompare(b.starts_on));
    if (cs.length > 0) seasonsByCup.push({ cup: c, seasons: cs });
  }
  const uncuped = seasons.filter(s => s.yearly_cup_id == null).sort((a, b) => b.starts_on.localeCompare(a.starts_on));
  if (uncuped.length > 0) seasonsByCup.push({ cup: null, seasons: uncuped });

  function toggle(level: DropdownLevel) {
    setOpenDropdown(prev => prev === level ? null : level);
  }

  const showCupLevel = scope.cupId != null || scope.seasonId == null;

  const sep = <span style={{ color: "var(--parchment-faint)", flexShrink: 0, padding: "0 2px" }}>›</span>;

  return (
    <div ref={barRef} className="scope-bar">
      {/* All-time */}
      <button
        onClick={() => { setScope({ kind: "alltime" }); close(); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          fontFamily: "inherit", fontSize: 13, flexShrink: 0,
          color: scope.kind === "alltime" ? "var(--parchment)" : "var(--parchment-muted)",
          padding: "4px 6px", borderRadius: 4,
          fontWeight: scope.kind === "alltime" ? 600 : 400,
        }}
      >
        All-time
      </button>

      {/* Cup level */}
      {showCupLevel && (
        <>
          {sep}
          {cup == null ? (
            <AddChip
              label="+ Cup"
              level="cup"
              open={openDropdown === "cup"}
              onToggle={() => toggle("cup")}
            >
              {yearlyCups.length === 0
                ? <EmptyItem label="No cups yet" />
                : [...yearlyCups].sort((a, b) => b.year - a.year).map(c => (
                    <DropdownItem key={c.id} label={c.name} onClick={() => { setScope({ kind: "cup", cupId: c.id }); close(); }} />
                  ))
              }
            </AddChip>
          ) : (
            <SelectionChip
              label={cup.name}
              level="cup"
              open={openDropdown === "cup"}
              onToggle={() => toggle("cup")}
              onDismiss={() => { setScope({ kind: "alltime" }); close(); }}
            >
              {[...yearlyCups].sort((a, b) => b.year - a.year).map(c => (
                <DropdownItem key={c.id} label={c.name} onClick={() => { setScope({ kind: "cup", cupId: c.id }); close(); }} />
              ))}
            </SelectionChip>
          )}
        </>
      )}

      {/* Season level — shown when cup selected OR already at season/event/pod scope */}
      {(scope.cupId != null || scope.seasonId != null) && (
        <>
          {sep}
          {season == null ? (
            <AddChip
              label="+ Season"
              level="season"
              open={openDropdown === "season"}
              onToggle={() => toggle("season")}
            >
              {scope.cupId != null ? (
                seasonsInCup.length === 0
                  ? <EmptyItem label="No seasons in this cup" />
                  : seasonsInCup.map(s => (
                      <DropdownItem key={s.id} label={s.name} onClick={() => { setScope({ kind: "season", cupId: scope.cupId, seasonId: s.id }); close(); }} />
                    ))
              ) : (
                <GroupedSeasonItems seasonsByCup={seasonsByCup} onSelect={s => { setScope({ kind: "season", cupId: s.yearly_cup_id ?? undefined, seasonId: s.id }); close(); }} />
              )}
            </AddChip>
          ) : (
            <SelectionChip
              label={season.name}
              level="season"
              open={openDropdown === "season"}
              onToggle={() => toggle("season")}
              onDismiss={() => { setScope(scope.cupId != null ? { kind: "cup", cupId: scope.cupId } : { kind: "alltime" }); close(); }}
            >
              {scope.cupId != null ? (
                seasonsInCup.map(s => (
                  <DropdownItem key={s.id} label={s.name} onClick={() => { setScope({ kind: "season", cupId: scope.cupId!, seasonId: s.id }); close(); }} />
                ))
              ) : (
                <GroupedSeasonItems seasonsByCup={seasonsByCup} onSelect={s => { setScope({ kind: "season", cupId: s.yearly_cup_id ?? undefined, seasonId: s.id }); close(); }} />
              )}
            </SelectionChip>
          )}
        </>
      )}

      {/* Direct + Season at alltime scope */}
      {scope.kind === "alltime" && (
        <>
          {sep}
          <AddChip
            label="+ Season"
            level="season"
            open={openDropdown === "season"}
            onToggle={() => toggle("season")}
          >
            <GroupedSeasonItems
              seasonsByCup={seasonsByCup}
              onSelect={s => { setScope({ kind: "season", cupId: s.yearly_cup_id ?? undefined, seasonId: s.id }); close(); }}
            />
          </AddChip>
        </>
      )}

      {/* Tournament level */}
      {scope.seasonId != null && (
        <>
          {sep}
          {event == null ? (
            <AddChip
              label="+ Tournament"
              level="event"
              open={openDropdown === "event"}
              onToggle={() => toggle("event")}
            >
              {eventsInSeason.length === 0
                ? <EmptyItem label="No tournaments yet" />
                : eventsInSeason.map(ev => (
                    <DropdownItem key={ev.id} label={`MMM #${ev.number} · ${ev.held_on}`} onClick={() => { setScope({ kind: "event", cupId: scope.cupId, seasonId: scope.seasonId!, eventId: ev.id }); close(); }} />
                  ))
              }
            </AddChip>
          ) : (
            <SelectionChip
              label={`MMM #${event.number}`}
              level="event"
              open={openDropdown === "event"}
              onToggle={() => toggle("event")}
              onDismiss={() => { setScope({ kind: "season", cupId: scope.cupId, seasonId: scope.seasonId! }); close(); }}
            >
              {eventsInSeason.map(ev => (
                <DropdownItem key={ev.id} label={`MMM #${ev.number} · ${ev.held_on}`} onClick={() => { setScope({ kind: "event", cupId: scope.cupId, seasonId: scope.seasonId!, eventId: ev.id }); close(); }} />
              ))}
            </SelectionChip>
          )}
        </>
      )}
    </div>
  );
}

// ---------- Grouped season items ----------

function GroupedSeasonItems({
  seasonsByCup,
  onSelect,
}: {
  seasonsByCup: { cup: YearlyCup | null; seasons: Season[] }[];
  onSelect: (s: Season) => void;
}) {
  if (seasonsByCup.length === 0) return <EmptyItem label="No seasons available" />;
  return (
    <>
      {seasonsByCup.map(({ cup, seasons: ss }) => (
        <div key={cup?.id ?? "other"}>
          <div style={{ padding: "6px 14px 2px", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--parchment-faint)", fontWeight: 700 }}>
            {cup ? cup.name : "Other seasons"}
          </div>
          {ss.map(s => (
            <DropdownItem key={s.id} label={s.name} onClick={() => onSelect(s)} indent />
          ))}
        </div>
      ))}
    </>
  );
}

// ---------- AddChip ----------

function AddChip({
  label,
  level,
  open,
  onToggle,
  children,
}: {
  label: string;
  level: DropdownLevel;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={onToggle}
        style={{
          background: "none", border: "1px dashed color-mix(in srgb, var(--ink-600) 70%, transparent)", cursor: "pointer",
          fontFamily: "inherit", fontSize: 12, color: "var(--parchment-faint)",
          padding: "2px 8px", borderRadius: 6,
        }}
      >
        {label}
      </button>
      <PortalDropdown anchorRef={ref} open={open}>
        {children}
      </PortalDropdown>
    </div>
  );
}

// ---------- SelectionChip ----------

function SelectionChip({
  label,
  level,
  open,
  onToggle,
  onDismiss,
  children,
}: {
  label: string;
  level: DropdownLevel;
  open: boolean;
  onToggle: () => void;
  onDismiss: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <div style={{
        display: "inline-flex", alignItems: "center",
        border: "1px solid transparent", borderRadius: 6, overflow: "hidden",
        background: "none",
      }}>
        <button
          onClick={onToggle}
          style={{
            background: "none", border: "none", cursor: "pointer", borderRadius: 6,
            fontFamily: "inherit", fontSize: 13, color: "var(--parchment)",
            padding: "3px 6px 3px 8px", display: "flex", alignItems: "center", gap: 5,
          }}
        >
          {label}
          <span style={{ fontSize: 10, color: "var(--parchment-faint)" }}>▾</span>
        </button>
        <span style={{ width: 1, height: 14, background: "var(--ink-700)", flexShrink: 0 }} />
        <button
          onClick={onDismiss}
          aria-label={`Remove ${label}`}
          style={{
            background: "none", border: "none", cursor: "pointer",
            fontFamily: "inherit", fontSize: 13, color: "var(--parchment-muted)",
            padding: "4px 10px", lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>
      <PortalDropdown anchorRef={ref} open={open}>
        {children}
      </PortalDropdown>
    </div>
  );
}

// ---------- Leaf components ----------

function DropdownItem({ label, onClick, indent }: { label: string; onClick: () => void; indent?: boolean }) {
  return (
    <button
      style={{ ...ITEM_STYLE, paddingLeft: indent ? 22 : 14 }}
      onClick={onClick}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--ink-800)")}
      onMouseLeave={e => (e.currentTarget.style.background = "none")}
    >
      {label}
    </button>
  );
}

function EmptyItem({ label }: { label: string }) {
  return (
    <div style={{ padding: "8px 14px", fontSize: 12, color: "var(--parchment-faint)" }}>
      {label}
    </div>
  );
}
