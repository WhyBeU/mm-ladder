"use client";

import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi, type ImportPreview, type ImportCommitRequest } from "@/lib/adminApi";
import { fetchSeasons } from "@/lib/api";
import { Field, inputStyle, useToast } from "@/components/admin/ui";
import PlayerPicker from "@/components/admin/PlayerPicker";
import { useAdminNav } from "@/components/admin/nav";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtEventDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

function composeName(seasonName: string | null, iso: string, pod: number): string {
  const prefix = seasonName ? `${seasonName} - ` : "";
  return `${prefix}${fmtEventDate(iso)} - Pod ${pod}`;
}

interface Row {
  key: number;
  rawName: string;
  points: number;
  playerId: number | null;
  createName: string;
  wins: number;
  losses: number;
  draws: number;
}

function rowsFromPreview(p: ImportPreview): Row[] {
  return p.participants.map((pt, i) => ({
    key: i,
    rawName: pt.raw_name,
    points: pt.points,
    playerId: pt.player_id,
    createName: pt.normalized_name,
    wins: pt.wins,
    losses: pt.losses,
    draws: pt.draws,
  }));
}

export default function UploadSection() {
  const toast = useToast();
  const qc = useQueryClient();
  const { navigate } = useAdminNav();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: seasons = [] } = useQuery({ queryKey: ["seasons"], queryFn: fetchSeasons });

  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [seasonId, setSeasonId] = useState<number | null>(null);
  const [heldOn, setHeldOn] = useState("");
  const [pod, setPod] = useState(1);
  const [venue, setVenue] = useState("");
  const [name, setName] = useState("");
  const [nameDirty, setNameDirty] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);

  const seasonName = useMemo(
    () => seasons.find((s) => s.id === seasonId)?.name ?? null,
    [seasons, seasonId],
  );
  const seasonsByDate = useMemo(
    () => [...seasons].sort((a, b) => b.starts_on.localeCompare(a.starts_on)),
    [seasons],
  );

  // The event name auto-follows set/date/pod until the admin edits it by hand.
  const eventName = nameDirty ? name : heldOn ? composeName(seasonName, heldOn, pod) : "";

  function reset() {
    setPreview(null);
    setRows([]);
    setNameDirty(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onFile(file: File) {
    setBusy(true);
    try {
      const p = await adminApi.previewPdf(file);
      setPreview(p);
      setSeasonId(p.suggested_season_id);
      setHeldOn(p.held_on);
      setPod(p.pod_number);
      setVenue(p.venue ?? "");
      setName("");
      setNameDirty(false);
      setRows(rowsFromPreview(p));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read that PDF", "err");
      reset();
    } finally {
      setBusy(false);
    }
  }

  const blocked = preview?.already_imported_tournament_id ?? null;
  const recordsOk = rows.every((r) => r.wins + r.losses + r.draws === 3);
  const namesOk = rows.every((r) => r.playerId !== null || r.createName.trim().length > 0);
  const canCommit = !!preview && !blocked && seasonId !== null && recordsOk && namesOk && !busy;

  async function commit() {
    if (!preview || seasonId === null) return;
    const payload: ImportCommitRequest = {
      eventlink_id: preview.eventlink_id,
      held_on: heldOn,
      season_id: seasonId,
      name: eventName.trim() || null,
      venue: venue.trim() || null,
      participants: rows.map((r) => ({
        player_id: r.playerId,
        create_name: r.playerId === null ? r.createName.trim() : null,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
      })),
    };
    setBusy(true);
    try {
      const result = await adminApi.commitPdf(payload);
      toast(
        `Imported "${result.name}" — ${result.participant_count} players` +
          (result.created_player_ids.length ? `, ${result.created_player_ids.length} new` : ""),
        "ok",
      );
      qc.invalidateQueries({ queryKey: ["players"] });
      qc.invalidateQueries({ queryKey: ["admin", "audit"] });
      reset();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Upload results</h2>
      <p style={{ fontSize: 13, color: "var(--parchment-muted)", maxWidth: 560 }}>
        Drop an EventLink <strong>“Standings by Rank”</strong> PDF (one per pod). We read the players,
        infer each record from their points, and let you check it before it lands on the ladder.
      </p>

      <input
        ref={fileRef}
        type="file"
        accept="application/pdf,.pdf"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        style={{
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px dashed var(--ink-600)",
          background: "var(--ink-850)",
          color: "var(--parchment)",
          cursor: busy ? "wait" : "pointer",
          fontFamily: "inherit",
        }}
      >
        {busy && !preview ? "Reading…" : preview ? "Choose a different PDF" : "⬆️  Choose PDF"}
      </button>

      {blocked && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 14px",
            borderRadius: 8,
            border: "1px solid var(--loss)",
            background: "color-mix(in srgb, var(--loss) 12%, transparent)",
            fontSize: 13,
          }}
        >
          This event was already imported.{" "}
          <button
            onClick={() => navigate("tournaments", blocked)}
            style={{ background: "none", border: "none", color: "var(--accent-400)", cursor: "pointer", textDecoration: "underline", fontFamily: "inherit", fontSize: 13 }}
          >
            Edit tournament #{blocked} →
          </button>
        </div>
      )}

      {preview && !blocked && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 620, marginTop: 20 }}>
            <Field label="Set / season">
              <select
                value={seasonId ?? ""}
                onChange={(e) => setSeasonId(e.target.value ? Number(e.target.value) : null)}
                style={inputStyle}
              >
                <option value="">— pick a set —</option>
                {seasonsByDate.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Venue">
              <input value={venue} onChange={(e) => setVenue(e.target.value)} style={inputStyle} />
            </Field>
            <div style={{ gridColumn: "1 / -1" }}>
              <Field label="Event name">
                <input
                  value={eventName}
                  onChange={(e) => {
                    setName(e.target.value);
                    setNameDirty(true);
                  }}
                  style={inputStyle}
                />
              </Field>
            </div>
          </div>

          <table style={{ width: "100%", marginTop: 20, borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", color: "var(--parchment-faint)", fontSize: 11 }}>
                <th style={{ padding: "4px 6px" }}>From PDF</th>
                <th style={{ padding: "4px 6px" }}>Player</th>
                <th style={{ padding: "4px 6px", width: 44 }}>W</th>
                <th style={{ padding: "4px 6px", width: 44 }}>L</th>
                <th style={{ padding: "4px 6px", width: 44 }}>D</th>
                <th style={{ padding: "4px 6px", width: 48 }}>Pts</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <ParticipantRow key={r.key} row={r} onChange={(next) => setRows((rs) => rs.map((x, j) => (j === i ? next : x)))} />
              ))}
            </tbody>
          </table>

          <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 18 }}>
            <button
              onClick={commit}
              disabled={!canCommit}
              style={{
                padding: "10px 18px",
                borderRadius: 8,
                border: "none",
                background: canCommit ? "var(--accent-500)" : "var(--ink-700)",
                color: canCommit ? "var(--ink-950)" : "var(--parchment-faint)",
                fontWeight: 700,
                cursor: canCommit ? "pointer" : "not-allowed",
                fontFamily: "inherit",
              }}
            >
              {busy ? "Importing…" : "Commit to ladder"}
            </button>
            {!recordsOk && <span style={{ fontSize: 12, color: "var(--loss)" }}>Each record must add up to 3 rounds.</span>}
            {recordsOk && !namesOk && <span style={{ fontSize: 12, color: "var(--loss)" }}>Every row needs a player.</span>}
          </div>
        </>
      )}

      <UploadHistory />
    </div>
  );
}

function ParticipantRow({ row, onChange }: { row: Row; onChange: (next: Row) => void }) {
  const points = row.wins * 3 + row.draws;
  const sumBad = row.wins + row.losses + row.draws !== 3;
  const num = (v: number, key: "wins" | "losses" | "draws") => (
    <input
      type="number"
      min={0}
      max={3}
      value={v}
      onChange={(e) => onChange({ ...row, [key]: Math.max(0, Math.min(3, Number(e.target.value) || 0)) })}
      style={{ ...inputStyle, width: 40, padding: "4px 6px" }}
    />
  );
  return (
    <tr style={{ borderTop: "1px solid var(--ink-800)" }}>
      <td style={{ padding: "6px", color: "var(--parchment-muted)" }}>{row.rawName}</td>
      <td style={{ padding: "6px" }}>
        {row.playerId === null ? (
          <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
            <input
              value={row.createName}
              onChange={(e) => onChange({ ...row, createName: e.target.value })}
              style={{ ...inputStyle, width: 170, padding: "4px 8px" }}
            />
            <span style={{ fontSize: 10, color: "var(--accent-400)", whiteSpace: "nowrap" }}>＋ new</span>
            <PlayerPicker value={null} onChange={(id) => onChange({ ...row, playerId: id })} />
          </span>
        ) : (
          <PlayerPicker value={row.playerId} onChange={(id) => onChange({ ...row, playerId: id })} />
        )}
      </td>
      <td style={{ padding: "6px" }}>{num(row.wins, "wins")}</td>
      <td style={{ padding: "6px" }}>{num(row.losses, "losses")}</td>
      <td style={{ padding: "6px" }}>{num(row.draws, "draws")}</td>
      <td style={{ padding: "6px", color: sumBad ? "var(--loss)" : "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{points}</td>
    </tr>
  );
}

function UploadHistory() {
  const { navigate } = useAdminNav();
  const [open, setOpen] = useState(false);
  const { data } = useQuery({
    queryKey: ["admin", "audit", "IMPORT"],
    queryFn: () => adminApi.listAudit({ action: "IMPORT", limit: 50, offset: 0 }),
  });
  const items = data?.items ?? [];
  const eventlinkOf = (e: (typeof items)[number]) =>
    (e.changes.find((c) => c.field === "eventlink_id")?.new as string | undefined) ?? "—";

  return (
    <div style={{ marginTop: 32 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "inline-flex", gap: 6, alignItems: "center", background: "none", border: "none", color: "var(--parchment)", cursor: "pointer", fontFamily: "inherit", fontSize: 15, fontWeight: 600, padding: 0 }}
      >
        {open ? "▾" : "▸"} Upload activity ({items.length})
      </button>
      {open &&
        (items.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--parchment-muted)", marginTop: 8 }}>No imports yet.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 4 }}>
            {items.map((e) => (
              <li key={e.id} style={{ display: "flex", gap: 12, alignItems: "center", fontSize: 13, padding: "6px 8px", border: "1px solid var(--ink-800)", borderRadius: 6 }}>
                <span style={{ color: "var(--parchment-faint)", fontSize: 11, whiteSpace: "nowrap" }}>
                  {new Date(e.created_at).toLocaleDateString()}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", color: "var(--parchment-muted)", fontSize: 12 }}>
                  #{eventlinkOf(e)}
                </span>
                <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label}</span>
                {e.entity_id && (
                  <button
                    onClick={() => navigate("tournaments", e.entity_id as number)}
                    style={{ marginLeft: "auto", background: "none", border: "none", color: "var(--accent-400)", cursor: "pointer", fontFamily: "inherit", fontSize: 12, whiteSpace: "nowrap" }}
                  >
                    edit →
                  </button>
                )}
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}
