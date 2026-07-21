"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTournaments, fetchSeasons, type ApiTournament, type ApiSeason } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";
import { useDraft, SaveResetBar } from "@/components/admin/DetailForm";
import { Field, inputStyle, DangerButton, ConfirmDialog, useToast } from "@/components/admin/ui";
import ParticipantsTable from "@/components/admin/ParticipantsTable";
import { useAdminNav } from "@/components/admin/nav";

export default function TournamentSection() {
  const qc = useQueryClient();
  const { data: tournaments = [] } = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const { data: seasons = [] } = useQuery({ queryKey: ["seasons"], queryFn: fetchSeasons });
  const [sel, setSel] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState<number | "">("");
  const toast = useToast();
  const { request } = useAdminNav();
  const [navNonce, setNavNonce] = useState(0);
  if (request && request.section === "tournaments" && request.nonce !== navNonce) {
    setNavNonce(request.nonce);
    setSel(request.id);
  }
  const current = tournaments.find((t) => t.id === sel);
  const sorted = [...tournaments].sort((a, b) => b.held_on.localeCompare(a.held_on) || b.id - a.id);
  const q = search.trim().toLowerCase();
  const filtered = sorted.filter((t) => {
    if (seasonFilter !== "" && t.season_id !== seasonFilter) return false;
    if (q && !`${t.held_on} ${t.name ?? ""}`.toLowerCase().includes(q)) return false;
    return true;
  });

  // The season a manually-created tournament should default to: the one covering today, else the
  // most recent by end date (mirrors the PDF importer's suggestion).
  const todayIso = new Date().toISOString().slice(0, 10);
  const currentSeason =
    seasons.find((s) => s.starts_on <= todayIso && todayIso <= s.ends_on) ??
    [...seasons].sort((a, b) => b.ends_on.localeCompare(a.ends_on))[0];
  const seasonsByDate = [...seasons].sort((a, b) => b.starts_on.localeCompare(a.starts_on));

  const create = async () => {
    if (seasons.length === 0) {
      toast("Create a season first", "err");
      return;
    }
    try {
      const t = await adminApi.createTournament({ held_on: todayIso, season_id: currentSeason.id });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      setSel(t.id);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Tournaments</h2>
        <button onClick={create} style={{ ...inputStyle, cursor: "pointer" }}>+ New</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 16 }}>
        <div style={{ borderRight: "1px solid var(--ink-700)", display: "flex", flexDirection: "column", maxHeight: 560 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 8px 8px 0" }}>
            <input
              type="text"
              placeholder="Search date or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...inputStyle, padding: "6px 8px" }}
            />
            <select
              value={seasonFilter}
              onChange={(e) => setSeasonFilter(e.target.value ? Number(e.target.value) : "")}
              style={{ ...inputStyle, padding: "6px 8px" }}
            >
              <option value="">All seasons</option>
              {seasonsByDate.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.set_code})
                </option>
              ))}
            </select>
          </div>
          <div style={{ overflow: "auto", minHeight: 0 }}>
            {filtered.map((t) => (
              <button
                key={t.id}
                onClick={() => setSel(t.id)}
                style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", padding: "6px 8px", background: sel === t.id ? "var(--ink-800)" : "none", border: "none", color: "var(--parchment)", cursor: "pointer" }}
              >
                {t.eventlink_id && <span title={`Imported from EventLink #${t.eventlink_id}`}>📄</span>}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.held_on} · {t.name ?? "—"}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <p style={{ color: "var(--parchment-faint)", fontSize: 12, padding: "8px" }}>No tournaments match.</p>
            )}
          </div>
        </div>
        <div>
          {current ? (
            <TournamentEditor key={current.id} tournament={current} seasons={seasonsByDate} onDeleted={() => setSel(null)} />
          ) : (
            <p style={{ color: "var(--parchment-muted)" }}>Select a tournament.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TournamentEditor({
  tournament,
  seasons,
  onDeleted,
}: {
  tournament: ApiTournament;
  seasons: ApiSeason[];
  onDeleted: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const { draft, setDraft, dirty, reset, commit } = useDraft({
    held_on: tournament.held_on,
    name: tournament.name ?? "",
    notes: tournament.notes ?? "",
    season_id: tournament.season_id,
  });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await adminApi.patchTournament(tournament.id, {
        held_on: draft.held_on,
        name: draft.name || null,
        notes: draft.notes || null,
        season_id: draft.season_id,
      });
      commit({ held_on: saved.held_on, name: saved.name ?? "", notes: saved.notes ?? "", season_id: saved.season_id });
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast("Saved");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    try {
      await adminApi.deleteTournament(tournament.id);
      qc.invalidateQueries({ queryKey: ["tournaments"] });
      toast("Deleted");
      onDeleted();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, maxWidth: 520 }}>
        <Field label="Date">
          <input type="date" value={draft.held_on} onChange={(e) => setDraft({ ...draft, held_on: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Season">
          <select value={draft.season_id} onChange={(e) => setDraft({ ...draft, season_id: Number(e.target.value) })} style={inputStyle}>
            {seasons.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.set_code})
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Notes">
          <input value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} style={inputStyle} />
        </Field>
      </div>
      {tournament.eventlink_id && (
        <div style={{ marginTop: 10, maxWidth: 520 }}>
          <Field label="EventLink id (imported)">
            <input
              value={tournament.eventlink_id}
              readOnly
              disabled
              style={{ ...inputStyle, opacity: 0.7, cursor: "not-allowed" }}
            />
          </Field>
        </div>
      )}
      <div style={{ fontSize: 11, color: "var(--parchment-faint)", marginTop: 6 }}>has_match_detail: {String(tournament.has_match_detail)}</div>
      <SaveResetBar dirty={dirty} onSave={save} onReset={reset} busy={busy} />

      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--parchment-muted)", margin: "16px 0 6px" }}>Participants</div>
      <ParticipantsTable tournamentId={tournament.id} />
      <div style={{ fontSize: 11, color: "var(--parchment-faint)", margin: "4px 0 16px" }}>Pts is computed from W/L/D (read-only). The player dropdown reassigns a result.</div>

      <DangerButton onClick={() => setConfirming(true)}>Delete tournament</DangerButton>
      {confirming && (
        <ConfirmDialog
          title={`Delete tournament ${tournament.held_on}?`}
          body="This removes the tournament and all its participant rows. Used for duplicate entries."
          confirmWord="delete"
          onConfirm={del}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
