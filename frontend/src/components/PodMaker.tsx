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
import SiteFooter from "@/components/SiteFooter";

// ---------- Local types ----------
/** A seeding group. `seasonId == null` = an "Other" format with no ladder stats. */
interface PodFormat {
  key: string;
  name: string;
  seasonId: number | null;
}

interface SeedMetrics {
  total: number;
  average: number;
  best: number;
}

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
  formatKey: string;
}

interface FormatPods {
  format: PodFormat;
  pods: SeedablePlayer[][];
}

const ZERO: SeedMetrics = { total: 0, average: 0, best: 0 };
const MAX_FORMATS = 2;

// ---------- Helpers ----------
function podToText(pod: SeedablePlayer[], idx: number, formatName?: string): string {
  const header = formatName
    ? `${formatName} — Pod ${idx + 1} (${pod.length})`
    : `Pod ${idx + 1} (${pod.length})`;
  const lines = pod.map((p, i) => `${i + 1}. ${p.name}`);
  return `${header}\n${lines.join("\n")}`;
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

  // ---------- Formats ----------
  // `formats` stays null until the user customises the group set; until then we derive
  // a single default format from the live season. Deriving (rather than seeding state
  // in an effect once data loads) keeps the live season flowing in without a
  // setState-in-effect, and the "f1" key stays stable so selections survive
  // materialisation when a second format is added.
  const derivedFirstFormat = useMemo<PodFormat>(
    () =>
      liveSeason
        ? { key: "f1", name: liveSeason.name, seasonId: liveSeason.id }
        : { key: "f1", name: "Pods", seasonId: null },
    [liveSeason],
  );
  const [formats, setFormats] = useState<PodFormat[] | null>(null);
  const formatCounter = useRef(1);
  const activeFormats = useMemo(() => formats ?? [derivedFirstFormat], [formats, derivedFirstFormat]);

  const multi = activeFormats.length > 1;

  // Standings for each format's season (up to MAX_FORMATS = 2).
  const seasonIdA = activeFormats[0]?.seasonId ?? null;
  const seasonIdB = activeFormats[1]?.seasonId ?? null;
  const { data: standingsA = [] } = useQuery({
    queryKey: ["season-standings", seasonIdA],
    queryFn: () => fetchSeasonStandings(seasonIdA!),
    enabled: seasonIdA != null,
  });
  const { data: standingsB = [] } = useQuery({
    queryKey: ["season-standings", seasonIdB],
    queryFn: () => fetchSeasonStandings(seasonIdB!),
    enabled: seasonIdB != null,
  });

  // format key -> (player id -> seed metrics), for players who played that season.
  const metricsByFormat = useMemo(() => {
    const toMap = (standings: typeof standingsA) => {
      const m = new Map<number, SeedMetrics>();
      for (const s of standings) {
        if (s.tournaments_played < 1) continue;
        m.set(s.player_id, {
          total: s.points,
          average: s.avg_pts,
          // "Best" = sum of the top N event scores, matching the ladder's Best column.
          best: s.comp_avg != null ? Math.round(s.comp_avg * s.comp_avg_n) : 0,
        });
      }
      return m;
    };
    const result = new Map<string, Map<number, SeedMetrics>>();
    if (activeFormats[0]) result.set(activeFormats[0].key, activeFormats[0].seasonId != null ? toMap(standingsA) : new Map());
    if (activeFormats[1]) result.set(activeFormats[1].key, activeFormats[1].seasonId != null ? toMap(standingsB) : new Map());
    return result;
  }, [activeFormats, standingsA, standingsB]);

  const playersById = useMemo(
    () => new Map(players.filter((p) => !p.is_hidden).map((p) => [p.id, p.display_name])),
    [players],
  );

  // Roster active/rest split + displayed metric use the first format's season.
  const defaultKey = activeFormats[0]?.key;
  const defaultMetrics = defaultKey ? metricsByFormat.get(defaultKey) : undefined;
  const roster = useMemo<RosterPlayer[]>(() => {
    return players
      .filter((p) => !p.is_hidden)
      .map((p) => {
        const m = defaultMetrics?.get(p.id);
        return {
          id: p.id,
          name: p.display_name,
          isActive: m != null,
          total: m?.total ?? 0,
          average: m?.average ?? 0,
          best: m?.best ?? 0,
        };
      });
  }, [players, defaultMetrics]);

  // ---------- Selection state ----------
  // player id -> format key it is seeded in.
  const [selected, setSelected] = useState<Map<number, string>>(new Map());
  const [extras, setExtras] = useState<Extra[]>([]);
  const [method, setMethod] = useState<SeedMethod>("Average");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<FormatPods[] | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingFormat, setAddingFormat] = useState(false);
  const extraCounter = useRef(0);

  const selectedIds = useMemo(() => new Set(selected.keys()), [selected]);

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

  const count = selected.size + extras.length;

  const metricsFor = (playerId: number, formatKey: string): SeedMetrics =>
    metricsByFormat.get(formatKey)?.get(playerId) ?? ZERO;

  // Seasons offerable as a new format: not already used, newest first.
  const pickableSeasons = useMemo(
    () =>
      seasons
        .filter((s) => !activeFormats.some((f) => f.seasonId === s.id))
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on)),
    [seasons, activeFormats],
  );

  // ---------- Actions ----------
  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, activeFormats[0]?.key ?? "f1");
      return next;
    });
  }

  function movePlayer(id: number, formatKey: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.set(id, formatKey);
      return next;
    });
  }

  function addExtra(formatKey: string) {
    extraCounter.current += 1;
    const n = extraCounter.current;
    setExtras((prev) => [...prev, { id: n, name: `Extra ${n}`, formatKey }]);
  }

  function removeExtra(id: number) {
    setExtras((prev) => prev.filter((e) => e.id !== id));
  }

  function renameExtra(id: number, name: string) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, name } : e)));
  }

  function moveExtra(id: number, formatKey: string) {
    setExtras((prev) => prev.map((e) => (e.id === id ? { ...e, formatKey } : e)));
  }

  function addFormat(body: { season_id?: number; name?: string }) {
    formatCounter.current += 1;
    const key = `f${formatCounter.current}`;
    const name =
      body.season_id != null
        ? seasons.find((s) => s.id === body.season_id)?.name ?? "Format"
        : body.name?.trim() || "Other";
    setFormats([...activeFormats, { key, name, seasonId: body.season_id ?? null }]);
    setAddingFormat(false);
  }

  function removeFormat(key: string) {
    const fallback = activeFormats[0]?.key ?? "f1";
    setSelected((prev) => {
      const next = new Map(prev);
      for (const [pid, fk] of next) if (fk === key) next.set(pid, fallback);
      return next;
    });
    setExtras((prev) => prev.map((e) => (e.formatKey === key ? { ...e, formatKey: fallback } : e)));
    setFormats(activeFormats.filter((f) => f.key !== key));
  }

  function clearAll() {
    setSelected(new Map());
    setExtras([]);
    setResults(null);
  }

  function generate() {
    const groups: FormatPods[] = activeFormats
      .map((fmt) => {
        const units: SeedablePlayer[] = [];
        for (const [pid, fk] of selected) {
          if (fk !== fmt.key) continue;
          const name = playersById.get(pid);
          if (name == null) continue;
          const m = metricsFor(pid, fmt.key);
          units.push({ key: String(pid), name, total: m.total, average: m.average, best: m.best, isExtra: false });
        }
        for (const e of extras) {
          if (e.formatKey !== fmt.key) continue;
          units.push({ key: `extra-${e.id}`, name: e.name.trim() || `Extra ${e.id}`, total: 0, average: 0, best: 0, isExtra: true });
        }
        return { format: fmt, pods: buildPods(units, method) };
      })
      .filter((g) => g.pods.length > 0);
    setResults(groups);
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

  function copyAll() {
    if (!results) return;
    const text = results
      .flatMap((g) => g.pods.map((pod, i) => podToText(pod, i, multi ? g.format.name : undefined)))
      .join("\n\n");
    copyText(text, "all");
  }

  const loading = seasonsLoading || playersLoading;

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <Masthead
        current="pods"
        title="Pod-maker"
        eyebrow={multi ? "Seeding by format" : activeFormats[0] ? `Seeding from ${activeFormats[0].name}` : "Pod-maker"}
      />

      {/* Main */}
      <main className="page-main" style={{ paddingBottom: 48, flex: 1 }}>
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
                  <RosterGroup label="Active this season" rows={activeRows} selected={selectedIds} method={method} onToggle={toggle} />
                  <RosterGroup label="Rest of roster" rows={restRows} selected={selectedIds} method={method} onToggle={toggle} />
                  {activeRows.length === 0 && restRows.length === 0 && (
                    <p style={{ color: "var(--parchment-faint)", fontSize: 13, padding: "8px 2px" }}>No players match.</p>
                  )}
                </div>
              </section>

              {/* Selected panel */}
              <section style={{ flex: "1 1 420px", minWidth: 320 }}>
                <PanelHeading title="Selected" hint={`${count} player${count === 1 ? "" : "s"}`} />

                {/* Seeding method */}
                <div style={{ marginBottom: 12 }}>
                  <label className="eyebrow" style={{ color: "var(--parchment-muted)", display: "block", marginBottom: 6 }}>
                    Seeding method
                  </label>
                  <SeedingSelector method={method} onChange={setMethod} />
                </div>

                {/* Single-format pod-size preview */}
                {!multi && (
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
                )}

                {/* Add-format control */}
                {activeFormats.length < MAX_FORMATS && (
                  <AddFormatControl
                    open={addingFormat}
                    seasons={pickableSeasons}
                    onOpen={() => setAddingFormat(true)}
                    onCancel={() => setAddingFormat(false)}
                    onAdd={addFormat}
                  />
                )}

                {/* Per-format selected groups */}
                {activeFormats.map((fmt, idx) => (
                  <SelectedGroup
                    key={fmt.key}
                    format={fmt}
                    showHeader={multi}
                    canRemove={multi && idx > 0}
                    method={method}
                    playerRows={[...selected]
                      .filter(([, fk]) => fk === fmt.key)
                      .map(([pid]) => ({ id: pid, name: playersById.get(pid) ?? "—", metrics: metricsFor(pid, fmt.key) }))
                      .sort((a, b) => a.name.localeCompare(b.name))}
                    extras={extras.filter((e) => e.formatKey === fmt.key)}
                    upFormat={activeFormats[idx - 1]}
                    downFormat={activeFormats[idx + 1]}
                    onRemovePlayer={toggle}
                    onMovePlayer={movePlayer}
                    onAddExtra={() => addExtra(fmt.key)}
                    onRenameExtra={renameExtra}
                    onRemoveExtra={removeExtra}
                    onMoveExtra={moveExtra}
                    onRemoveFormat={() => removeFormat(fmt.key)}
                  />
                ))}

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
            {results && (
              <Results
                groups={results}
                multi={multi}
                method={method}
                copied={copied}
                onCopyPod={(pod, i, fmt) => copyText(podToText(pod, i, multi ? fmt.name : undefined), `pod-${fmt.key}-${i}`)}
                onCopyAll={copyAll}
              />
            )}
          </>
        )}
      </main>

      <SiteFooter />
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

interface SelectedPlayerRow {
  id: number;
  name: string;
  metrics: SeedMetrics;
}

function SelectedGroup({
  format,
  showHeader,
  canRemove,
  method,
  playerRows,
  extras,
  upFormat,
  downFormat,
  onRemovePlayer,
  onMovePlayer,
  onAddExtra,
  onRenameExtra,
  onRemoveExtra,
  onMoveExtra,
  onRemoveFormat,
}: {
  format: PodFormat;
  showHeader: boolean;
  canRemove: boolean;
  method: SeedMethod;
  playerRows: SelectedPlayerRow[];
  extras: Extra[];
  upFormat?: PodFormat;
  downFormat?: PodFormat;
  onRemovePlayer: (id: number) => void;
  onMovePlayer: (id: number, formatKey: string) => void;
  onAddExtra: () => void;
  onRenameExtra: (id: number, name: string) => void;
  onRemoveExtra: (id: number) => void;
  onMoveExtra: (id: number, formatKey: string) => void;
  onRemoveFormat: () => void;
}) {
  const total = playerRows.length + extras.length;
  const showArrows = upFormat != null || downFormat != null;
  return (
    <div
      style={{
        marginBottom: 12,
        border: showHeader ? "1px solid var(--ink-700)" : "none",
        borderRadius: 8,
        padding: showHeader ? "8px 10px" : 0,
      }}
    >
      {showHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
          <span className="font-display" style={{ fontSize: 14, color: "var(--parchment)" }}>{format.name}</span>
          <span style={{ fontSize: 11, color: "var(--parchment-faint)", fontFamily: "var(--font-mono)" }}>
            {total} player{total === 1 ? "" : "s"}
          </span>
          {total > 0 && (
            <span style={{ fontSize: 11, color: "var(--accent-400)", fontFamily: "var(--font-mono)" }}>
              → {podSizePreview(total)}
            </span>
          )}
          <button onClick={onAddExtra} style={{ ...smallBtnStyle, marginLeft: "auto", padding: "3px 8px", fontSize: 11 }}>
            + Extra
          </button>
          {canRemove && (
            <button onClick={onRemoveFormat} style={{ ...smallBtnStyle, padding: "3px 8px", fontSize: 11 }}>
              Remove
            </button>
          )}
        </div>
      )}

      {total === 0 ? (
        <p style={{ color: "var(--parchment-faint)", fontSize: 13, padding: "4px 2px" }}>
          {showHeader ? "Nobody here yet." : "Check players on the left to add them here."}
        </p>
      ) : (
        <ul style={listStyle}>
          {playerRows.map((r) => {
            const metric = fmtMetric(method, r.metrics);
            return (
              <SelectedRow
                key={`p-${r.id}`}
                name={r.name}
                metric={metric}
                showArrows={showArrows}
                upFormat={upFormat}
                downFormat={downFormat}
                onMove={(fk) => onMovePlayer(r.id, fk)}
                onRemove={() => onRemovePlayer(r.id)}
              />
            );
          })}
          {extras.map((e) => (
            <SelectedRow
              key={`e-${e.id}`}
              name={e.name}
              isExtra
              editable
              showArrows={showArrows}
              upFormat={upFormat}
              downFormat={downFormat}
              onRename={(name) => onRenameExtra(e.id, name)}
              onMove={(fk) => onMoveExtra(e.id, fk)}
              onRemove={() => onRemoveExtra(e.id)}
            />
          ))}
        </ul>
      )}

      {/* Single-format extras adder (multi-format uses the header button). */}
      {!showHeader && (
        <div style={{ marginTop: 10 }}>
          <button onClick={onAddExtra} style={smallBtnStyle}>
            + Add extra
          </button>
        </div>
      )}
    </div>
  );
}

function SelectedRow({
  name,
  metric,
  isExtra,
  editable,
  showArrows,
  upFormat,
  downFormat,
  onRename,
  onMove,
  onRemove,
}: {
  name: string;
  metric?: string | null;
  isExtra?: boolean;
  editable?: boolean;
  showArrows: boolean;
  upFormat?: PodFormat;
  downFormat?: PodFormat;
  onRename?: (name: string) => void;
  onMove: (formatKey: string) => void;
  onRemove: () => void;
}) {
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 8px", borderRadius: 6, background: "var(--ink-850)" }}>
      {editable ? (
        <input
          value={name}
          onChange={(e) => onRename?.(e.target.value)}
          aria-label="Extra name"
          style={{ ...inputStyle, marginTop: 0, flex: 1, padding: "4px 8px", background: "var(--ink-900, var(--ink-850))" }}
        />
      ) : (
        <span style={{ flex: 1, fontSize: 14, color: isExtra ? "var(--parchment-muted)" : "var(--parchment)" }}>
          {name}
          {isExtra && <span style={{ color: "var(--parchment-faint)", fontSize: 11 }}> · extra</span>}
        </span>
      )}
      {metric != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--parchment-faint)" }}>{metric}</span>
      )}
      {showArrows && (
        <span style={{ display: "inline-flex", gap: 2 }}>
          <button onClick={() => upFormat && onMove(upFormat.key)} disabled={!upFormat} aria-label="Move up a format" style={arrowBtnStyle(!upFormat)}>
            ▲
          </button>
          <button onClick={() => downFormat && onMove(downFormat.key)} disabled={!downFormat} aria-label="Move down a format" style={arrowBtnStyle(!downFormat)}>
            ▼
          </button>
        </span>
      )}
      <button onClick={onRemove} aria-label={`Remove ${name}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--parchment-muted)", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>
        ✕
      </button>
    </li>
  );
}

function AddFormatControl({
  open,
  seasons,
  onOpen,
  onCancel,
  onAdd,
}: {
  open: boolean;
  seasons: { id: number; name: string; set_code: string }[];
  onOpen: () => void;
  onCancel: () => void;
  onAdd: (body: { season_id?: number; name?: string }) => void;
}) {
  const [choice, setChoice] = useState("");
  const [otherName, setOtherName] = useState("");

  if (!open) {
    return (
      <div style={{ marginBottom: 12 }}>
        <button onClick={onOpen} style={smallBtnStyle}>
          + Add format
        </button>
      </div>
    );
  }

  const canAdd = choice === "other" ? otherName.trim().length > 0 : choice !== "";
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
      <select value={choice} onChange={(e) => setChoice(e.target.value)} style={{ ...inputStyle, marginTop: 0, flex: "1 1 160px", width: "auto" }}>
        <option value="">Choose a format…</option>
        {seasons.map((s) => (
          <option key={s.id} value={String(s.id)}>
            {s.set_code} — {s.name}
          </option>
        ))}
        <option value="other">Other…</option>
      </select>
      {choice === "other" && (
        <input value={otherName} onChange={(e) => setOtherName(e.target.value)} placeholder="Format name" style={{ ...inputStyle, marginTop: 0, flex: "1 1 120px", width: "auto" }} />
      )}
      <button
        disabled={!canAdd}
        onClick={() => (choice === "other" ? onAdd({ name: otherName.trim() }) : onAdd({ season_id: Number(choice) }))}
        style={{ ...primaryBtnStyle(!canAdd), flex: "0 0 auto" }}
      >
        Add
      </button>
      <button onClick={onCancel} style={ghostBtnStyle(false)}>
        Cancel
      </button>
    </div>
  );
}

function Results({
  groups,
  multi,
  method,
  copied,
  onCopyPod,
  onCopyAll,
}: {
  groups: FormatPods[];
  multi: boolean;
  method: SeedMethod;
  copied: string | null;
  onCopyPod: (pod: SeedablePlayer[], idx: number, format: PodFormat) => void;
  onCopyAll: () => void;
}) {
  const totalPods = groups.reduce((s, g) => s + g.pods.length, 0);
  const totalPlayers = groups.reduce((s, g) => s + g.pods.reduce((n, p) => n + p.length, 0), 0);
  const undersized = groups.some((g) => g.pods.some((p) => p.length < 6));

  if (totalPods === 0) return null;

  return (
    <div style={{ marginTop: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 18, color: "var(--parchment)" }}>
          {totalPods} pod{totalPods === 1 ? "" : "s"} · {totalPlayers} players
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

      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {groups.map((g) => (
          <div key={g.format.key}>
            {multi && (
              <h4 className="font-display" style={{ margin: "0 0 10px", fontSize: 15, color: "var(--parchment-muted)" }}>
                {g.format.name} · {g.pods.length} pod{g.pods.length === 1 ? "" : "s"}
              </h4>
            )}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 16 }}>
              {g.pods.map((pod, idx) => (
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
                      onClick={() => onCopyPod(pod, idx, g.format)}
                      style={{ ...smallBtnStyle, padding: "3px 8px", fontSize: 11 }}
                    >
                      {copied === `pod-${g.format.key}-${idx}` ? "Copied!" : "Copy"}
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

const listStyle: React.CSSProperties = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: 4,
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

function arrowBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "0 6px",
    fontSize: 10,
    cursor: disabled ? "default" : "pointer",
    borderRadius: 5,
    border: "1px solid var(--ink-600)",
    background: "var(--ink-850)",
    color: disabled ? "var(--ink-600)" : "var(--parchment-muted)",
    lineHeight: 1.6,
  };
}

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
