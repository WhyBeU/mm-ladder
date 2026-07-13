"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchSeasons, fetchPlayers, fetchSeasonStandings } from "@/lib/api";
import {
  buildPods,
  fmtMetric,
  podSizePreview,
  type SeedMethod,
  type SeedablePlayer,
} from "@/lib/pods";
import Masthead from "@/components/Masthead";
import SeedingSelector from "@/components/SeedingSelector";

// ---------- Local types ----------
interface RosterPlayer {
  id: number;
  name: string;
  isActive: boolean;
  total: number;
  average: number;
  best: number;
}

interface Extra {
  id: number;
  name: string;
}

// ---------- Helpers ----------
function podToText(pod: SeedablePlayer[], idx: number): string {
  const lines = pod.map((p, i) => `${i + 1}. ${p.name}`);
  return `Pod ${idx + 1} (${pod.length})\n${lines.join("\n")}`;
}

// ---------- Component ----------
export default function PodMaker() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const { data: seasons = [], isLoading: seasonsLoading } = useQuery({
    queryKey: ["seasons"],
    queryFn: fetchSeasons,
  });
  const { data: players = [], isLoading: playersLoading } = useQuery({
    queryKey: ["players"],
    queryFn: fetchPlayers,
  });

  // Live season — current by date, else most recent (matches LeaderboardPage).
  const liveSeason = useMemo(() => {
    if (seasons.length === 0) return null;
    return (
      seasons.find((s) => s.starts_on <= today && today <= s.ends_on) ??
      [...seasons].sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0] ??
      null
    );
  }, [seasons, today]);

  const { data: standings = [] } = useQuery({
    queryKey: ["season-standings", liveSeason?.id],
    queryFn: () => fetchSeasonStandings(liveSeason!.id),
    enabled: liveSeason != null,
  });

  // Roster: every visible player, flagged active if they played the live season.
  const roster = useMemo<RosterPlayer[]>(() => {
    const activeById = new Map(standings.filter((s) => s.tournaments_played >= 1).map((s) => [s.player_id, s]));
    return players
      .filter((p) => !p.is_hidden)
      .map((p) => {
        const s = activeById.get(p.id);
        return {
          id: p.id,
          name: p.display_name,
          isActive: s != null,
          total: s?.points ?? 0,
          average: s?.avg_pts ?? 0,
          // "Best" = sum of the top N event scores, matching the ladder's Best column
          // (comp_avg is that sum divided by comp_avg_n).
          best: s?.comp_avg != null ? Math.round(s.comp_avg * s.comp_avg_n) : 0,
        };
      });
  }, [players, standings]);

  // ---------- UI state ----------
  const [method, setMethod] = useState<SeedMethod>("Average");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [extras, setExtras] = useState<Extra[]>([]);
  const [pods, setPods] = useState<SeedablePlayer[][] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const extraCounter = useRef(0);

  const byId = useMemo(() => new Map(roster.map((r) => [r.id, r])), [roster]);

  // Roster split into active / rest, filtered + alphabetised.
  const { activeRows, restRows } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const match = (r: RosterPlayer) => q === "" || r.name.toLowerCase().includes(q);
    const byName = (a: RosterPlayer, b: RosterPlayer) => a.name.localeCompare(b.name);
    return {
      activeRows: roster.filter((r) => r.isActive && match(r)).sort(byName),
      restRows: roster.filter((r) => !r.isActive && match(r)).sort(byName),
    };
  }, [roster, search]);

  // Selected players + extras as seedable units.
  const selectedPlayers = useMemo<SeedablePlayer[]>(() => {
    const real: SeedablePlayer[] = [...selected]
      .map((id) => byId.get(id))
      .filter((r): r is RosterPlayer => r != null)
      .map((r) => ({ key: String(r.id), name: r.name, total: r.total, average: r.average, best: r.best, isExtra: false }));
    const ex: SeedablePlayer[] = extras.map((e) => ({
      key: `extra-${e.id}`,
      name: e.name.trim() || `Extra ${e.id}`,
      total: 0,
      average: 0,
      best: 0,
      isExtra: true,
    }));
    return [...real, ...ex];
  }, [selected, extras, byId]);

  const count = selected.size + extras.length;

  // ---------- Actions ----------
  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addExtra() {
    extraCounter.current += 1;
    const n = extraCounter.current;
    setExtras((prev) => [...prev, { id: n, name: `Extra ${n}` }]);
  }

  function removeExtra(id: number) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  function renameExtra(id: number, name: string) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  }

  function clearAll() {
    setSelected(new Set());
    setExtras([]);
    setPods(null);
  }

  function generate() {
    setPods(buildPods(selectedPlayers, method));
  }

  async function copyText(text: string, key: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  const loading = seasonsLoading || playersLoading;

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden" }}>
      {/* Header */}
      <Masthead
        current="pods"
        title="Pod-maker"
        eyebrow={liveSeason ? `Seeding from ${liveSeason.name}` : "Pod-maker"}
      />

      {/* Main */}
      <main className="page-main" style={{ paddingBottom: 48 }}>
        {loading ? (
          <p style={{ color: "var(--parchment-faint)" }}>Loading roster…</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
              {/* Roster panel */}
              <section style={{ flex: "1 1 420px", minWidth: 320 }}>
                <PanelHeading title="Roster" hint={`${roster.length} players`} />
                <input
                  type="text"
                  placeholder="Search players…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={inputStyle}
                />
                <div style={{ maxHeight: 540, overflowY: "auto", marginTop: 10 }}>
                  <RosterGroup
                    label="Active this season"
                    rows={activeRows}
                    selected={selected}
                    method={method}
                    onToggle={toggle}
                  />
                  <RosterGroup
                    label="Rest of roster"
                    rows={restRows}
                    selected={selected}
                    method={method}
                    onToggle={toggle}
                  />
                  {activeRows.length === 0 && restRows.length === 0 && (
                    <p style={{ color: "var(--parchment-faint)", fontSize: 13, padding: "8px 2px" }}>No players match.</p>
                  )}
                </div>
              </section>

              {/* Selected panel */}
              <section style={{ flex: "1 1 420px", minWidth: 320 }}>
                <PanelHeading title="Selected" hint={`${count} players`} />

                {/* Seeding method */}
                <div style={{ marginBottom: 12 }}>
                  <label className="eyebrow" style={{ color: "var(--parchment-muted)", display: "block", marginBottom: 6 }}>
                    Seeding method
                  </label>
                  <SeedingSelector method={method} onChange={setMethod} />
                </div>

                {/* Pod-size preview */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "10px 14px",
                    background: "var(--ink-850)",
                    border: "1px solid var(--ink-700)",
                    borderRadius: 8,
                    marginBottom: 12,
                  }}
                >
                  <span className="eyebrow" style={{ color: "var(--parchment-muted)" }}>
                    {count > 0 ? `${count} → ` : "Pods"}
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 15, color: "var(--accent-400)", letterSpacing: "0.04em" }}>
                    {count > 0 ? podSizePreview(count) : "—"}
                  </span>
                </div>

                {/* Selected list */}
                <SelectedList roster={byId} selected={selected} method={method} onRemove={toggle} />

                {/* Extras */}
                <div style={{ marginTop: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <label className="eyebrow" style={{ color: "var(--parchment-muted)" }}>
                      Extras ({extras.length})
                    </label>
                    <button onClick={addExtra} style={smallBtnStyle}>
                      + Add extra
                    </button>
                  </div>
                  {extras.map((e) => (
                    <div key={e.id} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                      <input
                        value={e.name}
                        onChange={(ev) => renameExtra(e.id, ev.target.value)}
                        style={{ ...inputStyle, marginTop: 0, flex: 1 }}
                      />
                      <button onClick={() => removeExtra(e.id)} aria-label="Remove extra" style={removeBtnStyle}>
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button onClick={generate} disabled={count === 0} style={primaryBtnStyle(count === 0)}>
                    Generate pods
                  </button>
                  <button onClick={clearAll} disabled={count === 0} style={ghostBtnStyle(count === 0)}>
                    Clear
                  </button>
                </div>
              </section>
            </div>

            {/* Results */}
            {pods && (
              <Results
                pods={pods}
                method={method}
                copied={copied}
                onCopyPod={(pod, i) => copyText(podToText(pod, i), `pod-${i}`)}
                onCopyAll={() => copyText(pods.map(podToText).join("\n\n"), "all")}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------- Subcomponents ----------
function PanelHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
      <h3 className="font-display" style={{ margin: 0, fontSize: 16, color: "var(--parchment)" }}>
        {title}
      </h3>
      <span className="eyebrow" style={{ color: "var(--parchment-faint)" }}>
        {hint}
      </span>
    </div>
  );
}

function RosterGroup({
  label,
  rows,
  selected,
  method,
  onToggle,
}: {
  label: string;
  rows: RosterPlayer[];
  selected: Set<number>;
  method: SeedMethod;
  onToggle: (id: number) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        style={{
          padding: "6px 2px 4px",
          fontSize: 10,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--parchment-faint)",
          fontWeight: 700,
        }}
      >
        {label} · {rows.length}
      </div>
      {rows.map((r) => {
        const isSel = selected.has(r.id);
        const metric = fmtMetric(method, r);
        return (
          <button
            key={r.id}
            onClick={() => onToggle(r.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              textAlign: "left",
              padding: "6px 8px",
              borderRadius: 6,
              border: "none",
              cursor: "pointer",
              background: isSel ? "color-mix(in srgb, var(--primary-700) 30%, transparent)" : "none",
              color: "var(--parchment)",
              fontFamily: "inherit",
            }}
            onMouseEnter={(e) => {
              if (!isSel) e.currentTarget.style.background = "var(--ink-850)";
            }}
            onMouseLeave={(e) => {
              if (!isSel) e.currentTarget.style.background = "none";
            }}
          >
            <span
              aria-hidden
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                flexShrink: 0,
                border: `1.5px solid ${isSel ? "var(--accent-400)" : "var(--ink-600)"}`,
                background: isSel ? "var(--accent-400)" : "transparent",
                color: "var(--ink-950)",
                fontSize: 11,
                fontWeight: 800,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                lineHeight: 1,
              }}
            >
              {isSel ? "✓" : ""}
            </span>
            <span style={{ flex: 1, fontSize: 14 }}>{r.name}</span>
            {metric != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--parchment-faint)" }}>{metric}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

function SelectedList({
  roster,
  selected,
  method,
  onRemove,
}: {
  roster: Map<number, RosterPlayer>;
  selected: Set<number>;
  method: SeedMethod;
  onRemove: (id: number) => void;
}) {
  const rows = [...selected]
    .map((id) => roster.get(id))
    .filter((r): r is RosterPlayer => r != null)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (rows.length === 0) {
    return (
      <p style={{ color: "var(--parchment-faint)", fontSize: 13, padding: "4px 2px" }}>
        Check players on the left to add them here.
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {rows.map((r) => {
        const metric = fmtMetric(method, r);
        return (
          <span
            key={r.id}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 6px 4px 10px",
              borderRadius: 16,
              background: "var(--ink-850)",
              border: "1px solid var(--ink-600)",
              fontSize: 13,
              color: "var(--parchment)",
            }}
          >
            {r.name}
            {metric != null && (
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--parchment-faint)" }}>{metric}</span>
            )}
            <button
              onClick={() => onRemove(r.id)}
              aria-label={`Remove ${r.name}`}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--parchment-muted)",
                fontSize: 13,
                lineHeight: 1,
                padding: "0 2px",
              }}
            >
              ✕
            </button>
          </span>
        );
      })}
    </div>
  );
}

function Results({
  pods,
  method,
  copied,
  onCopyPod,
  onCopyAll,
}: {
  pods: SeedablePlayer[][];
  method: SeedMethod;
  copied: string | null;
  onCopyPod: (pod: SeedablePlayer[], idx: number) => void;
  onCopyAll: () => void;
}) {
  const total = pods.reduce((s, p) => s + p.length, 0);
  const undersized = pods.some((p) => p.length < 6);
  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 18, color: "var(--parchment)" }}>
          {pods.length} pod{pods.length === 1 ? "" : "s"} · {total} players
        </h3>
        <button onClick={onCopyAll} style={smallBtnStyle}>
          {copied === "all" ? "Copied!" : "Copy all"}
        </button>
      </div>

      {undersized && (
        <p style={{ color: "var(--parchment-faint)", fontSize: 12, marginBottom: 12 }}>
          A pod has fewer than 6 players — below the ideal size.
        </p>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
        {pods.map((pod, idx) => (
          <div
            key={idx}
            style={{
              border: "1px solid var(--ink-700)",
              borderRadius: 10,
              background: "var(--ink-900, var(--ink-850))",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 12px",
                borderBottom: "1px solid var(--ink-700)",
                background: "var(--ink-850)",
              }}
            >
              <span className="font-display" style={{ fontSize: 14, color: "var(--parchment)" }}>
                Pod {idx + 1}{" "}
                <span style={{ color: "var(--parchment-faint)", fontFamily: "var(--font-mono)", fontSize: 12 }}>
                  ({pod.length})
                </span>
              </span>
              <button
                onClick={() => onCopyPod(pod, idx)}
                style={{ ...smallBtnStyle, padding: "3px 8px", fontSize: 11 }}
              >
                {copied === `pod-${idx}` ? "Copied!" : "Copy"}
              </button>
            </div>
            <ol style={{ margin: 0, padding: "8px 12px", listStyle: "none" }}>
              {pod.map((p, i) => {
                const metric = fmtMetric(method, p);
                return (
                  <li
                    key={p.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "3px 0",
                      fontSize: 14,
                      color: p.isExtra ? "var(--parchment-muted)" : "var(--parchment)",
                    }}
                  >
                    <span style={{ width: 16, color: "var(--parchment-faint)", fontFamily: "var(--font-mono)", fontSize: 11 }}>
                      {i + 1}
                    </span>
                    <span style={{ flex: 1 }}>
                      {p.name}
                      {p.isExtra && <span style={{ color: "var(--parchment-faint)", fontSize: 11 }}> · extra</span>}
                    </span>
                    {metric != null && (
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--parchment-faint)" }}>{metric}</span>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Shared styles ----------
const inputStyle: React.CSSProperties = {
  width: "100%",
  marginTop: 0,
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid var(--ink-600)",
  background: "var(--ink-850)",
  color: "var(--parchment)",
  fontFamily: "var(--font-sans)",
  fontSize: 14,
};

const smallBtnStyle: React.CSSProperties = {
  padding: "5px 12px",
  fontSize: 12,
  fontFamily: "var(--font-sans)",
  cursor: "pointer",
  borderRadius: 7,
  border: "1px solid var(--ink-600)",
  background: "var(--ink-850)",
  color: "var(--parchment-muted)",
};

const removeBtnStyle: React.CSSProperties = {
  padding: "0 10px",
  fontSize: 13,
  cursor: "pointer",
  borderRadius: 7,
  border: "1px solid var(--ink-600)",
  background: "var(--ink-850)",
  color: "var(--parchment-muted)",
};

function primaryBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    flex: 1,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    fontFamily: "var(--font-sans)",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8,
    border: "1px solid color-mix(in srgb, var(--accent-400) 50%, transparent)",
    background: disabled ? "var(--ink-850)" : "var(--accent-400)",
    color: disabled ? "var(--parchment-faint)" : "var(--ink-950)",
    opacity: disabled ? 0.6 : 1,
  };
}

function ghostBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "10px 18px",
    fontSize: 14,
    fontFamily: "var(--font-sans)",
    cursor: disabled ? "not-allowed" : "pointer",
    borderRadius: 8,
    border: "1px solid var(--ink-600)",
    background: "none",
    color: "var(--parchment-muted)",
    opacity: disabled ? 0.5 : 1,
  };
}
