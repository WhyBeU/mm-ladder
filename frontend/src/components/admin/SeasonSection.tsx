"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchSeasons, fetchYearlyCups, fetchTournaments, type ApiSeason } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";
import { useDraft, SaveResetBar } from "@/components/admin/DetailForm";
import { Field, inputStyle, DangerButton, ConfirmDialog, useToast } from "@/components/admin/ui";
import PlayerPicker from "@/components/admin/PlayerPicker";
import { useAdminNav } from "@/components/admin/nav";

export default function SeasonSection() {
  const qc = useQueryClient();
  const { data: seasons = [] } = useQuery({ queryKey: ["seasons"], queryFn: fetchSeasons });
  const [sel, setSel] = useState<number | null>(null);
  const toast = useToast();
  const { request } = useAdminNav();
  const [navNonce, setNavNonce] = useState(0);
  if (request && request.section === "seasons" && request.nonce !== navNonce) {
    setNavNonce(request.nonce);
    setSel(request.id);
  }
  const current = seasons.find((s) => s.id === sel);

  const create = async () => {
    const y = new Date().getFullYear();
    try {
      const s = await adminApi.createSeason({ name: "New Season", set_code: "AAA", starts_on: `${y}-01-01`, ends_on: `${y}-03-31` });
      qc.invalidateQueries({ queryKey: ["seasons"] });
      setSel(s.id);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Seasons</h2>
        <button onClick={create} style={{ ...inputStyle, cursor: "pointer" }}>+ New</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16 }}>
        <div style={{ borderRight: "1px solid var(--ink-700)", maxHeight: 520, overflow: "auto" }}>
          {[...seasons].sort((a, b) => b.starts_on.localeCompare(a.starts_on)).map((s) => (
            <button
              key={s.id}
              onClick={() => setSel(s.id)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "7px 8px", background: sel === s.id ? "var(--ink-800)" : "none", border: "none", color: "var(--parchment)", cursor: "pointer" }}
            >
              <div style={{ fontWeight: 600, fontSize: 13 }}>{s.set_code.toUpperCase()} — {s.name}</div>
              <div style={{ fontSize: 11, color: "var(--parchment-faint)", fontVariantNumeric: "tabular-nums" }}>{s.starts_on} – {s.ends_on}</div>
            </button>
          ))}
        </div>
        <div>{current ? <SeasonEditor key={current.id} season={current} onDeleted={() => setSel(null)} /> : <p style={{ color: "var(--parchment-muted)" }}>Select a season.</p>}</div>
      </div>
    </div>
  );
}

function SeasonEditor({ season, onDeleted }: { season: ApiSeason; onDeleted: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { navigate } = useAdminNav();
  const { data: cups = [] } = useQuery({ queryKey: ["yearlyCups"], queryFn: fetchYearlyCups });
  const { data: tournaments = [] } = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const { draft, setDraft, dirty, reset, commit } = useDraft({
    name: season.name,
    set_code: season.set_code,
    starts_on: season.starts_on,
    ends_on: season.ends_on,
    yearly_cup_id: season.yearly_cup_id,
    qualifier_count: season.qualifier_count,
    event_count: season.event_count,
    qualifying_type: season.qualifying_type,
    champion_player_id: season.champion_player_id,
  });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const childTournaments = tournaments
    .filter((t) => t.season_id === season.id)
    .sort((a, b) => a.held_on.localeCompare(b.held_on));

  const save = async () => {
    setBusy(true);
    try {
      const saved = await adminApi.patchSeason(season.id, draft);
      commit({
        name: saved.name,
        set_code: saved.set_code,
        starts_on: saved.starts_on,
        ends_on: saved.ends_on,
        yearly_cup_id: saved.yearly_cup_id,
        qualifier_count: saved.qualifier_count,
        event_count: saved.event_count,
        qualifying_type: saved.qualifying_type,
        champion_player_id: saved.champion_player_id,
      });
      qc.invalidateQueries({ queryKey: ["seasons"] });
      toast("Saved");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    try {
      await adminApi.deleteSeason(season.id);
      qc.invalidateQueries({ queryKey: ["seasons"] });
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, maxWidth: 600 }}>
        <Field label="Name">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Set code">
          <input value={draft.set_code} onChange={(e) => setDraft({ ...draft, set_code: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Yearly cup">
          <select
            value={draft.yearly_cup_id ?? ""}
            onChange={(e) => setDraft({ ...draft, yearly_cup_id: e.target.value ? Number(e.target.value) : null })}
            style={inputStyle}
          >
            <option value="">— none —</option>
            {cups.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts">
          <input type="date" value={draft.starts_on} onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Ends">
          <input type="date" value={draft.ends_on} onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Qualifying type">
          <select value={draft.qualifying_type} onChange={(e) => setDraft({ ...draft, qualifying_type: e.target.value as "POINTS" | "BEST" })} style={inputStyle}>
            <option value="POINTS">POINTS</option>
            <option value="BEST">BEST</option>
          </select>
        </Field>
        <Field label="Qualifier count">
          <input type="number" value={draft.qualifier_count} onChange={(e) => setDraft({ ...draft, qualifier_count: Number(e.target.value) })} style={inputStyle} />
        </Field>
        <Field label="Event count">
          <input type="number" value={draft.event_count} onChange={(e) => setDraft({ ...draft, event_count: Number(e.target.value) })} style={inputStyle} />
        </Field>
        <Field label="🏅 Season champion">
          <PlayerPicker value={draft.champion_player_id} onChange={(id) => setDraft({ ...draft, champion_player_id: id })} />
        </Field>
      </div>

      <SaveResetBar dirty={dirty} onSave={save} onReset={reset} busy={busy} />

      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--parchment-muted)", margin: "12px 0 6px" }}>Tournaments in this season</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13 }}>
        {childTournaments.length === 0 && <li style={{ color: "var(--parchment-faint)" }}>None</li>}
        {childTournaments.map((t) => (
          <li key={t.id}>
            <button
              onClick={() => navigate("tournaments", t.id)}
              style={{ background: "none", border: "none", padding: "2px 0", color: "var(--primary-300)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left" }}
            >
              {t.held_on} · {t.name ?? "—"} ›
            </button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16 }}>
        <DangerButton onClick={() => setConfirming(true)}>Delete season</DangerButton>
      </div>
      {confirming && (
        <ConfirmDialog title={`Delete "${season.name}"?`} body="This permanently removes the season." confirmWord="delete" onConfirm={del} onCancel={() => setConfirming(false)} />
      )}
    </div>
  );
}
