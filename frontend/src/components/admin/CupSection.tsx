"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchYearlyCups, fetchSeasons, type ApiYearlyCup } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";
import { useDraft, SaveResetBar } from "@/components/admin/DetailForm";
import { Field, inputStyle, DangerButton, ConfirmDialog, useToast } from "@/components/admin/ui";
import PlayerPicker, { usePlayers } from "@/components/admin/PlayerPicker";
import { useAdminNav } from "@/components/admin/nav";

export default function CupSection() {
  const qc = useQueryClient();
  const { data: cups = [] } = useQuery({ queryKey: ["yearly-cups"], queryFn: fetchYearlyCups });
  const [sel, setSel] = useState<number | null>(null);
  const toast = useToast();
  const current = cups.find((c) => c.id === sel);

  const create = async () => {
    // Cups are unique per year — pick the next free year so "+ New" never
    // collides with an existing cup (falls back to the current year).
    const year = cups.length ? Math.max(...cups.map((c) => c.year)) + 1 : new Date().getFullYear();
    try {
      const c = await adminApi.createCup({ year, name: `${year} Cup`, starts_on: `${year}-01-01`, ends_on: `${year}-12-31` });
      qc.invalidateQueries({ queryKey: ["yearly-cups"] });
      setSel(c.id);
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Yearly Cups</h2>
        <button onClick={create} style={{ ...inputStyle, cursor: "pointer" }}>+ New</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 16 }}>
        <div style={{ borderRight: "1px solid var(--ink-700)" }}>
          {[...cups].sort((a, b) => b.year - a.year).map((c) => (
            <button
              key={c.id}
              onClick={() => setSel(c.id)}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", background: sel === c.id ? "var(--ink-800)" : "none", border: "none", color: "var(--parchment)", cursor: "pointer" }}
            >
              {c.name}
            </button>
          ))}
        </div>
        <div>{current ? <CupEditor key={current.id} cup={current} onDeleted={() => setSel(null)} /> : <p style={{ color: "var(--parchment-muted)" }}>Select a cup.</p>}</div>
      </div>
    </div>
  );
}

function CupEditor({ cup, onDeleted }: { cup: ApiYearlyCup; onDeleted: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { navigate } = useAdminNav();
  const { data: players = [] } = usePlayers();
  const { data: seasons = [] } = useQuery({ queryKey: ["seasons"], queryFn: fetchSeasons });
  const { draft, setDraft, dirty, reset, commit } = useDraft({
    year: cup.year,
    name: cup.name,
    starts_on: cup.starts_on,
    ends_on: cup.ends_on,
    player_of_the_year_id: cup.player_of_the_year_id,
    cup_winner_id: cup.cup_winner_id,
    qualified_player_ids: cup.qualified_player_ids ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const childSeasons = seasons.filter((s) => s.yearly_cup_id === cup.id);
  const name = (id: number) => players.find((p) => p.id === id)?.display_name ?? `#${id}`;

  const save = async () => {
    setBusy(true);
    try {
      const saved = await adminApi.patchCup(cup.id, draft);
      commit({
        year: saved.year,
        name: saved.name,
        starts_on: saved.starts_on,
        ends_on: saved.ends_on,
        player_of_the_year_id: saved.player_of_the_year_id,
        cup_winner_id: saved.cup_winner_id,
        qualified_player_ids: saved.qualified_player_ids ?? [],
      });
      qc.invalidateQueries({ queryKey: ["yearly-cups"] });
      toast("Saved");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    try {
      await adminApi.deleteCup(cup.id);
      qc.invalidateQueries({ queryKey: ["yearly-cups"] });
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, maxWidth: 560 }}>
        <Field label="Year">
          <input type="number" value={draft.year} onChange={(e) => setDraft({ ...draft, year: Number(e.target.value) })} style={inputStyle} />
        </Field>
        <Field label="Name">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} style={inputStyle} />
        </Field>
        <span />
        <Field label="Starts">
          <input type="date" value={draft.starts_on} onChange={(e) => setDraft({ ...draft, starts_on: e.target.value })} style={inputStyle} />
        </Field>
        <Field label="Ends">
          <input type="date" value={draft.ends_on} onChange={(e) => setDraft({ ...draft, ends_on: e.target.value })} style={inputStyle} />
        </Field>
        <span />
        <Field label="🏅 Player of the Year">
          <PlayerPicker value={draft.player_of_the_year_id} onChange={(id) => setDraft({ ...draft, player_of_the_year_id: id })} />
        </Field>
        <Field label="🏆 Cup winner">
          <PlayerPicker value={draft.cup_winner_id} onChange={(id) => setDraft({ ...draft, cup_winner_id: id })} />
        </Field>
      </div>

      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--parchment-muted)", margin: "14px 0 6px" }}>Qualified players</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        {draft.qualified_player_ids.map((id) => (
          <span key={id} style={{ background: "var(--ink-800)", borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
            {name(id)}{" "}
            <button onClick={() => setDraft({ ...draft, qualified_player_ids: draft.qualified_player_ids.filter((x) => x !== id) })} style={{ border: "none", background: "none", color: "var(--parchment-faint)", cursor: "pointer" }}>
              ✕
            </button>
          </span>
        ))}
        <PlayerPicker
          value={null}
          onChange={(id) => {
            if (id && !draft.qualified_player_ids.includes(id)) setDraft({ ...draft, qualified_player_ids: [...draft.qualified_player_ids, id] });
          }}
        />
      </div>

      <SaveResetBar dirty={dirty} onSave={save} onReset={reset} busy={busy} />

      <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--parchment-muted)", margin: "12px 0 6px" }}>Seasons in this cup</div>
      <ul style={{ margin: 0, padding: 0, listStyle: "none", fontSize: 13 }}>
        {childSeasons.length === 0 && <li style={{ color: "var(--parchment-faint)" }}>None</li>}
        {childSeasons.map((s) => (
          <li key={s.id}>
            <button
              onClick={() => navigate("seasons", s.id)}
              style={{ background: "none", border: "none", padding: "2px 0", color: "var(--primary-300)", cursor: "pointer", fontFamily: "inherit", fontSize: 13, textAlign: "left" }}
            >
              {s.set_code.toUpperCase()} — {s.name} ›
            </button>
          </li>
        ))}
      </ul>

      <div style={{ marginTop: 16 }}>
        <DangerButton onClick={() => setConfirming(true)}>Delete cup</DangerButton>
      </div>
      {confirming && (
        <ConfirmDialog title={`Delete "${cup.name}"?`} body="This permanently removes the yearly cup." confirmWord="delete" onConfirm={del} onCancel={() => setConfirming(false)} />
      )}
    </div>
  );
}
