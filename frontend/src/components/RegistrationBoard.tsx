"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchPlayers, fetchSeasons, fetchSeasonStandings } from "@/lib/api";
import { boardApi, type ApiBoard, type ApiBoardFormat, type ApiBoardPod, type ApiBoardSignup } from "@/lib/boardApi";
import { buildGenerateGroups, type SeedMetrics } from "@/lib/boardGenerate";
import { fmtMetric, podSizePreview, type SeedMethod } from "@/lib/pods";
import Masthead from "@/components/Masthead";
import SeedingSelector from "@/components/SeedingSelector";
import SiteFooter from "@/components/SiteFooter";

const ZERO: SeedMetrics = { total: 0, average: 0, best: 0 };

export default function RegistrationBoard() {
  const qc = useQueryClient();

  const { data: board, isLoading: boardLoading } = useQuery({
    queryKey: ["board"],
    queryFn: boardApi.get,
    refetchInterval: 4000,
  });
  const { data: seasons = [] } = useQuery({ queryKey: ["seasons"], queryFn: fetchSeasons });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: fetchPlayers });

  const formats = useMemo(() => board?.formats ?? [], [board?.formats]);
  const signups = useMemo(() => board?.signups ?? [], [board?.signups]);

  // Standings for each format's season (Other formats have no season → no standings).
  const seasonId1 = formats[0]?.season_id ?? null;
  const seasonId2 = formats[1]?.season_id ?? null;
  const { data: standings1 = [] } = useQuery({
    queryKey: ["season-standings", seasonId1],
    queryFn: () => fetchSeasonStandings(seasonId1!),
    enabled: seasonId1 != null,
  });
  const { data: standings2 = [] } = useQuery({
    queryKey: ["season-standings", seasonId2],
    queryFn: () => fetchSeasonStandings(seasonId2!),
    enabled: seasonId2 != null,
  });

  // format_id -> (player_id -> seed metrics) for that format's season.
  const metricsByFormat = useMemo(() => {
    const toMap = (standings: typeof standings1) => {
      const m = new Map<number, SeedMetrics>();
      for (const s of standings) {
        m.set(s.player_id, {
          total: s.points,
          average: s.avg_pts,
          best: s.comp_avg != null ? Math.round(s.comp_avg * s.comp_avg_n) : 0,
        });
      }
      return m;
    };
    const result = new Map<number, Map<number, SeedMetrics>>();
    if (formats[0]) result.set(formats[0].id, formats[0].season_id != null ? toMap(standings1) : new Map());
    if (formats[1]) result.set(formats[1].id, formats[1].season_id != null ? toMap(standings2) : new Map());
    return result;
  }, [formats, standings1, standings2]);

  // ---------- UI state ----------
  const [method, setMethod] = useState<SeedMethod>("Average");
  const [search, setSearch] = useState("");
  const [extraName, setExtraName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);
  const [addingFormat, setAddingFormat] = useState(false);

  const action = useMutation({
    mutationFn: (run: () => Promise<ApiBoard>) => run(),
    onSuccess: (b) => {
      qc.setQueryData(["board"], b);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });
  const run = (fn: () => Promise<ApiBoard>) => action.mutate(fn);

  const multi = formats.length > 1;
  const defaultFormat = formats[0];
  const presentCount = signups.filter((s) => s.present).length;

  const claimedPlayerIds = useMemo(
    () => new Set(signups.filter((s) => s.player_id != null).map((s) => s.player_id)),
    [signups],
  );

  // Roster active/rest split uses the default format's season metrics.
  const defaultMetrics = defaultFormat ? metricsByFormat.get(defaultFormat.id) : undefined;
  const { activeRows, restRows } = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = players
      .filter((p) => !p.is_hidden)
      .filter((p) => q === "" || p.display_name.toLowerCase().includes(q))
      .map((p) => ({ id: p.id, name: p.display_name, active: defaultMetrics?.has(p.id) ?? false }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return { activeRows: rows.filter((r) => r.active), restRows: rows.filter((r) => !r.active) };
  }, [players, search, defaultMetrics]);

  function metricsForSignup(s: ApiBoardSignup): SeedMetrics {
    const m = s.format_id != null ? metricsByFormat.get(s.format_id) : undefined;
    return (s.player_id != null ? m?.get(s.player_id) : undefined) ?? ZERO;
  }

  function generate() {
    const groups = buildGenerateGroups(formats, signups, metricsByFormat, method);
    run(() => boardApi.generate({ formats: groups }));
  }

  function markAllPresent(formatId: number | null) {
    if (formatId == null) {
      run(() => boardApi.presentAll());
      return;
    }
    const targets = signups.filter((s) => s.format_id === formatId && !s.present);
    run(async () => {
      for (const t of targets) await boardApi.setPresent(t.id, true);
      return boardApi.get();
    });
  }

  function staleFor(formatId: number): boolean {
    if (board?.state.status !== "generated") return false;
    const inFormat = signups.filter((s) => s.format_id === formatId);
    const seated = new Set(inFormat.filter((s) => s.pod_id != null).map((s) => s.id));
    const present = new Set(inFormat.filter((s) => s.present).map((s) => s.id));
    if (seated.size !== present.size) return true;
    for (const id of present) if (!seated.has(id)) return true;
    return false;
  }

  async function copyCode(pod: ApiBoardPod) {
    if (!pod.code) return;
    try {
      await navigator.clipboard.writeText(pod.code);
      setCopied(pod.id);
      setTimeout(() => setCopied((c) => (c === pod.id ? null : c)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  // Seasons available to add as the 2nd format (exclude the active one already in
  // slot 1), ordered newest first.
  const pickableSeasons = useMemo(
    () =>
      seasons
        .filter((s) => s.id !== defaultFormat?.season_id)
        .sort((a, b) => b.starts_on.localeCompare(a.starts_on)),
    [seasons, defaultFormat],
  );

  return (
    <div style={{ minHeight: "100vh", overflowX: "hidden", display: "flex", flexDirection: "column" }}>
      <Masthead
        current="board"
        title="Pod sign-up"
        eyebrow={defaultFormat ? `Seeding from ${defaultFormat.name}` : "Sign-up board"}
      />

      <main className="page-main" style={{ paddingBottom: 48, flex: 1 }}>
        <p style={{ color: "var(--parchment-muted)", fontSize: 14, margin: "0 0 8px", maxWidth: 720 }}>
          Magic Mates draft pod sign-up. Tap your name to sign up, or add yourself as an extra. On the night
          the organiser marks who&apos;s here and generates the pods.
        </p>
        {error && <p style={{ color: "var(--loss)", fontSize: 13, margin: "0 0 8px" }}>{error}</p>}

        {boardLoading ? (
          <p style={{ color: "var(--parchment-faint)" }}>Loading board…</p>
        ) : (
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
            {/* Roster panel */}
            <section style={{ flex: "1 1 420px", minWidth: 320 }}>
              <PanelHeading title="Roster" hint={`${activeRows.length + restRows.length} players`} />
              <input
                type="text"
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={inputStyle}
              />
              <div style={{ maxHeight: 420, overflowY: "auto", marginTop: 10 }}>
                <RosterGroup label="Active this season" rows={activeRows} claimed={claimedPlayerIds} onClaim={(id) => run(() => boardApi.addSignup({ player_id: id }))} />
                <RosterGroup label="Rest of roster" rows={restRows} claimed={claimedPlayerIds} onClaim={(id) => run(() => boardApi.addSignup({ player_id: id }))} />
                {activeRows.length === 0 && restRows.length === 0 && (
                  <p style={{ color: "var(--parchment-faint)", fontSize: 13, padding: "8px 2px" }}>No players match.</p>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = extraName.trim();
                  if (!name) return;
                  run(() => boardApi.addSignup({ display_name: name }));
                  setExtraName("");
                }}
                style={{ display: "flex", gap: 6, marginTop: 12 }}
              >
                <input value={extraName} onChange={(e) => setExtraName(e.target.value)} placeholder="Add as extra (guest name)…" style={{ ...inputStyle, marginTop: 0, flex: 1 }} />
                <button type="submit" disabled={!extraName.trim()} style={smallBtnStyle}>
                  + Add
                </button>
              </form>
            </section>

            {/* Signed-up panel */}
            <section style={{ flex: "1 1 420px", minWidth: 320 }}>
              <PanelHeading title="Signed up" hint={`${presentCount} / ${signups.length} present`} />

              <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
                <SeedingSelector method={method} onChange={setMethod} />
                <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--accent-400)" }}>
                  {multi
                    ? `${presentCount} present`
                    : presentCount > 0
                      ? `${presentCount} → ${podSizePreview(presentCount)}`
                      : "—"}
                </span>
              </div>

              {/* Format controls */}
              {!multi && (
                <AddFormatControl
                  open={addingFormat}
                  seasons={pickableSeasons}
                  onOpen={() => setAddingFormat(true)}
                  onCancel={() => setAddingFormat(false)}
                  onAdd={(body) => {
                    run(() => boardApi.addFormat(body));
                    setAddingFormat(false);
                  }}
                />
              )}

              {signups.length === 0 ? (
                <p style={{ color: "var(--parchment-faint)", fontSize: 13, padding: "8px 2px" }}>No-one has signed up yet.</p>
              ) : multi ? (
                formats.map((fmt) => (
                  <FormatSection
                    key={fmt.id}
                    format={fmt}
                    formats={formats}
                    rows={signups.filter((s) => s.format_id === fmt.id)}
                    metricFor={(s) => fmtMetric(method, metricsForSignup(s))}
                    onTogglePresent={(s) => run(() => boardApi.setPresent(s.id, !s.present))}
                    onRemove={(s) => run(() => boardApi.removeSignup(s.id))}
                    onMove={(s, formatId) => run(() => boardApi.moveSignup(s.id, formatId))}
                    onMarkAll={() => markAllPresent(fmt.id)}
                    onRemoveFormat={fmt.ordinal === 2 ? () => run(() => boardApi.removeFormat(fmt.id)) : undefined}
                  />
                ))
              ) : (
                <>
                  <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
                    <button onClick={() => markAllPresent(null)} style={smallBtnStyle}>
                      Mark all present
                    </button>
                  </div>
                  <ul style={listStyle}>
                    {signups.map((s) => (
                      <SignupRow
                        key={s.id}
                        signup={s}
                        formats={formats}
                        metric={fmtMetric(method, metricsForSignup(s))}
                        onTogglePresent={() => run(() => boardApi.setPresent(s.id, !s.present))}
                        onRemove={() => run(() => boardApi.removeSignup(s.id))}
                        onMove={(formatId) => run(() => boardApi.moveSignup(s.id, formatId))}
                      />
                    ))}
                  </ul>
                </>
              )}

              <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                <button onClick={generate} disabled={presentCount === 0} style={primaryBtnStyle(presentCount === 0)}>
                  Generate pods
                </button>
                <button onClick={() => setConfirmReset(true)} disabled={signups.length === 0} style={ghostBtnStyle(signups.length === 0)}>
                  Clear board
                </button>
              </div>
            </section>
          </div>
        )}

        {/* Pods, grouped by format */}
        {board && board.pods.length > 0 && (
          <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 24 }}>
            {formats
              .map((fmt) => ({ fmt, pods: board.pods.filter((p) => p.format_id === fmt.id) }))
              .filter(({ pods }) => pods.length > 0)
              .map(({ fmt, pods }) => (
                <div key={fmt.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                    <h3 className="font-display" style={{ margin: 0, fontSize: 18, color: "var(--parchment)" }}>
                      {multi ? `${fmt.name} · ` : ""}
                      {pods.length} pod{pods.length === 1 ? "" : "s"}
                    </h3>
                    {staleFor(fmt.id) && (
                      <span style={{ color: "var(--accent-400)", fontSize: 12 }}>Sign-ups changed since generate — regenerate.</span>
                    )}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
                    {pods.map((pod) => (
                      <PodCard
                        key={pod.id}
                        title={`${fmt.name} pod ${pod.ordinal}`}
                        members={signups.filter((s) => s.pod_id === pod.id).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0))}
                        code={pod.code}
                        copied={copied === pod.id}
                        onCopy={() => copyCode(pod)}
                        onSaveCode={(code) => {
                          if (code !== (pod.code ?? "")) run(() => boardApi.setPodCode(pod.id, code));
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Activity feed */}
        {board && board.events.length > 0 && (
          <div style={{ marginTop: 32 }}>
            <button onClick={() => setFeedOpen((o) => !o)} style={{ ...smallBtnStyle, display: "inline-flex", gap: 6 }}>
              {feedOpen ? "▾" : "▸"} Activity ({board.events.length})
            </button>
            {feedOpen && (
              <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 4, maxWidth: 720 }}>
                {board.events.map((ev) => (
                  <li key={ev.id} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--parchment-muted)", padding: "4px 2px" }}>
                    <span style={{ flex: 1 }}>{ev.message}</span>
                    <span style={{ color: "var(--parchment-faint)", fontSize: 11 }}>{new Date(ev.created_at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      <SiteFooter />

      {confirmReset && (
        <ConfirmDialog
          onCancel={() => setConfirmReset(false)}
          onConfirm={() => {
            run(() => boardApi.reset());
            setConfirmReset(false);
          }}
        />
      )}
    </div>
  );
}

// ---------- subcomponents ----------
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
  claimed,
  onClaim,
}: {
  label: string;
  rows: { id: number; name: string }[];
  claimed: Set<number | null>;
  onClaim: (id: number) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ padding: "6px 2px 4px", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--parchment-faint)", fontWeight: 700 }}>
        {label} · {rows.length}
      </div>
      {rows.map((r) => {
        const taken = claimed.has(r.id);
        return (
          <button
            key={r.id}
            onClick={() => !taken && onClaim(r.id)}
            disabled={taken}
            style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "6px 8px", borderRadius: 6, border: "none", cursor: taken ? "default" : "pointer", background: "none", color: taken ? "var(--parchment-faint)" : "var(--parchment)", fontFamily: "inherit" }}
          >
            <span style={{ flex: 1, fontSize: 14, textDecoration: taken ? "line-through" : "none" }}>{r.name}</span>
            {taken && <span style={{ fontSize: 11, color: "var(--parchment-faint)" }}>signed up</span>}
          </button>
        );
      })}
    </div>
  );
}

function FormatSection({
  format,
  formats,
  rows,
  metricFor,
  onTogglePresent,
  onRemove,
  onMove,
  onMarkAll,
  onRemoveFormat,
}: {
  format: ApiBoardFormat;
  formats: ApiBoardFormat[];
  rows: ApiBoardSignup[];
  metricFor: (s: ApiBoardSignup) => string | null;
  onTogglePresent: (s: ApiBoardSignup) => void;
  onRemove: (s: ApiBoardSignup) => void;
  onMove: (s: ApiBoardSignup, formatId: number) => void;
  onMarkAll: () => void;
  onRemoveFormat?: () => void;
}) {
  const present = rows.filter((s) => s.present).length;
  return (
    <div style={{ marginBottom: 14, border: "1px solid var(--ink-700)", borderRadius: 8, padding: "8px 10px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span className="font-display" style={{ fontSize: 14, color: "var(--parchment)" }}>{format.name}</span>
        <span style={{ fontSize: 11, color: "var(--parchment-faint)", fontFamily: "var(--font-mono)" }}>
          {present}/{rows.length}
        </span>
        {present > 0 && (
          <span style={{ fontSize: 11, color: "var(--accent-400)", fontFamily: "var(--font-mono)" }}>
            → {podSizePreview(present)}
          </span>
        )}
        <button onClick={onMarkAll} style={{ ...smallBtnStyle, marginLeft: "auto", padding: "3px 8px", fontSize: 11 }}>
          Mark all present
        </button>
        {onRemoveFormat && (
          <button onClick={onRemoveFormat} style={{ ...smallBtnStyle, padding: "3px 8px", fontSize: 11 }}>
            Remove
          </button>
        )}
      </div>
      {rows.length === 0 ? (
        <p style={{ color: "var(--parchment-faint)", fontSize: 12, padding: "2px" }}>Nobody here yet.</p>
      ) : (
        <ul style={listStyle}>
          {rows.map((s) => (
            <SignupRow
              key={s.id}
              signup={s}
              formats={formats}
              metric={metricFor(s)}
              onTogglePresent={() => onTogglePresent(s)}
              onRemove={() => onRemove(s)}
              onMove={(formatId) => onMove(s, formatId)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SignupRow({
  signup,
  formats,
  metric,
  onTogglePresent,
  onRemove,
  onMove,
}: {
  signup: ApiBoardSignup;
  formats: ApiBoardFormat[];
  metric: string | null;
  onTogglePresent: () => void;
  onRemove: () => void;
  onMove: (formatId: number) => void;
}) {
  const mine = formats.find((f) => f.id === signup.format_id);
  const up = mine ? formats.find((f) => f.ordinal === mine.ordinal - 1) : undefined;
  const down = mine ? formats.find((f) => f.ordinal === mine.ordinal + 1) : undefined;
  const showArrows = formats.length > 1;
  return (
    <li style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 6, background: "var(--ink-850)" }}>
      <button
        onClick={onTogglePresent}
        aria-label={signup.present ? "Mark not present" : "Mark present"}
        style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, cursor: "pointer", border: `1.5px solid ${signup.present ? "var(--accent-400)" : "var(--ink-600)"}`, background: signup.present ? "var(--accent-400)" : "transparent", color: "var(--ink-950)", fontSize: 12, fontWeight: 800, lineHeight: 1 }}
      >
        {signup.present ? "✓" : ""}
      </button>
      <span style={{ flex: 1, fontSize: 14, color: signup.is_extra ? "var(--parchment-muted)" : "var(--parchment)" }}>
        {signup.display_name}
        {signup.is_extra && <span style={{ color: "var(--parchment-faint)", fontSize: 11 }}> · extra</span>}
      </span>
      {metric != null && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--parchment-faint)" }}>{metric}</span>}
      {showArrows && (
        <span style={{ display: "inline-flex", gap: 2 }}>
          <button onClick={() => up && onMove(up.id)} disabled={!up} aria-label="Move up a format" style={arrowBtnStyle(!up)}>
            ▲
          </button>
          <button onClick={() => down && onMove(down.id)} disabled={!down} aria-label="Move down a format" style={arrowBtnStyle(!down)}>
            ▼
          </button>
        </span>
      )}
      <button onClick={onRemove} aria-label={`Remove ${signup.display_name}`} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--parchment-muted)", fontSize: 14, lineHeight: 1, padding: "0 2px" }}>
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
        style={primaryBtnStyle(!canAdd)}
      >
        Add
      </button>
      <button onClick={onCancel} style={ghostBtnStyle(false)}>
        Cancel
      </button>
    </div>
  );
}

function PodCard({
  title,
  members,
  code,
  copied,
  onCopy,
  onSaveCode,
}: {
  title: string;
  members: ApiBoardSignup[];
  code: string | null;
  copied: boolean;
  onCopy: () => void;
  onSaveCode: (code: string) => void;
}) {
  return (
    <div style={{ border: "1px solid var(--ink-700)", borderRadius: 10, background: "var(--ink-900, var(--ink-850))", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: "1px solid var(--ink-700)", background: "var(--ink-850)" }}>
        <span className="font-display" style={{ fontSize: 14, color: "var(--parchment)" }}>
          {title} <span style={{ color: "var(--parchment-faint)", fontFamily: "var(--font-mono)", fontSize: 12 }}>({members.length})</span>
        </span>
      </div>
      <ol style={{ margin: 0, padding: "8px 12px", listStyle: "none" }}>
        {members.map((m, i) => (
          <li key={m.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", fontSize: 14, color: m.is_extra ? "var(--parchment-muted)" : "var(--parchment)" }}>
            <span style={{ width: 16, color: "var(--parchment-faint)", fontFamily: "var(--font-mono)", fontSize: 11 }}>{i + 1}</span>
            <span style={{ flex: 1 }}>
              {m.display_name}
              {m.is_extra && <span style={{ color: "var(--parchment-faint)", fontSize: 11 }}> · extra</span>}
            </span>
          </li>
        ))}
      </ol>
      <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderTop: "1px solid var(--ink-700)" }}>
        <input key={`${title}-${code ?? ""}`} defaultValue={code ?? ""} placeholder="Wizards pod code" onBlur={(e) => onSaveCode(e.target.value.trim())} style={{ ...inputStyle, marginTop: 0, flex: 1, fontFamily: "var(--font-mono)" }} />
        <button onClick={onCopy} disabled={!code} style={{ ...smallBtnStyle, opacity: code ? 1 : 0.5 }}>
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function ConfirmDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div onClick={onCancel} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "var(--ink-900, var(--ink-850))", border: "1px solid var(--ink-600)", borderRadius: 12, padding: 24, maxWidth: 380, width: "100%" }}>
        <h3 className="font-display" style={{ margin: "0 0 8px", color: "var(--parchment)", fontSize: 18 }}>
          Clear the board?
        </h3>
        <p style={{ color: "var(--parchment-muted)", fontSize: 14, margin: "0 0 18px" }}>
          This wipes all sign-ups, pods and the activity feed (formats reset to the active season). It can&apos;t be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={ghostBtnStyle(false)}>
            Cancel
          </button>
          <button onClick={onConfirm} style={{ ...primaryBtnStyle(false), flex: "0 0 auto", background: "var(--loss)", borderColor: "var(--loss)", color: "var(--parchment)" }}>
            Clear everything
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- shared styles ----------
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
