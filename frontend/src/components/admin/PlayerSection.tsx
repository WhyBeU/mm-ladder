"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { usePlayers } from "@/components/admin/PlayerPicker";
import { adminApi, type AdminPlayer } from "@/lib/adminApi";
import { useDraft, SaveResetBar } from "@/components/admin/DetailForm";
import { Field, inputStyle, ChipEditor, DangerButton, ConfirmDialog, useToast } from "@/components/admin/ui";
import MergeTool from "@/components/admin/MergeTool";

export default function PlayerSection() {
  const { data: players = [], refetch } = usePlayers();
  const [sel, setSel] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [merging, setMerging] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const toast = useToast();
  const current = players.find((p) => p.id === sel) as AdminPlayer | undefined;

  const addPlayer = async () => {
    const display_name = newName.trim();
    if (!display_name || adding) return;
    setAdding(true);
    try {
      const p = await adminApi.createPlayer({ display_name });
      setNewName("");
      await refetch();
      setSel(p.id);
      toast("Player added");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
        <h2 style={{ margin: 0 }}>Players</h2>
        <button onClick={() => setMerging(true)} style={{ ...inputStyle, cursor: "pointer" }}>
          ⚙ Merge players
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addPlayer();
            }
          }}
          placeholder="new player name…"
          style={{ ...inputStyle, flex: 1 }}
        />
        <button onClick={addPlayer} disabled={adding || !newName.trim()} style={{ ...inputStyle, cursor: adding || !newName.trim() ? "not-allowed" : "pointer", opacity: adding || !newName.trim() ? 0.5 : 1 }}>
          + Add
        </button>
      </div>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search…" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        <div style={{ borderRight: "1px solid var(--ink-700)", maxHeight: 480, overflow: "auto" }}>
          {players
            .filter((p) => p.display_name.toLowerCase().includes(q.toLowerCase()))
            .map((p) => (
              <button
                key={p.id}
                onClick={() => setSel(p.id)}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", background: sel === p.id ? "var(--ink-800)" : "none", border: "none", color: "var(--parchment)", cursor: "pointer" }}
              >
                {p.display_name}
                {p.is_hidden ? " · hidden" : ""}
              </button>
            ))}
        </div>
        <div>
          {current ? (
            <PlayerEditor
              key={current.id}
              player={current}
              onChanged={refetch}
              onDeleted={() => {
                setSel(null);
                refetch();
              }}
            />
          ) : (
            <p style={{ color: "var(--parchment-muted)" }}>Select a player.</p>
          )}
        </div>
      </div>
      {merging && (
        <MergeTool
          onClose={() => {
            setMerging(false);
            refetch();
          }}
        />
      )}
    </div>
  );
}

function PlayerEditor({ player, onChanged, onDeleted }: { player: AdminPlayer; onChanged: () => void; onDeleted: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const { draft, setDraft, dirty, reset, commit } = useDraft({
    display_name: player.display_name,
    is_hidden: player.is_hidden,
    aliases: player.aliases ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      const saved = await adminApi.patchPlayer(player.id, draft);
      commit({ display_name: saved.display_name, is_hidden: saved.is_hidden, aliases: saved.aliases ?? [] });
      qc.invalidateQueries({ queryKey: ["players"] });
      onChanged();
      toast("Saved");
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setBusy(false);
    }
  };
  const del = async () => {
    try {
      await adminApi.deletePlayer(player.id);
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
      <div style={{ display: "grid", gap: 10, maxWidth: 420 }}>
        <Field label="Display name">
          <input value={draft.display_name} onChange={(e) => setDraft({ ...draft, display_name: e.target.value })} style={inputStyle} />
        </Field>
        <label style={{ fontSize: 13 }}>
          <input type="checkbox" checked={draft.is_hidden} onChange={(e) => setDraft({ ...draft, is_hidden: e.target.checked })} /> hidden from leaderboard
        </label>
        <Field label="Aliases">
          <ChipEditor values={draft.aliases} onChange={(aliases) => setDraft({ ...draft, aliases })} placeholder="+ add alias" />
        </Field>
      </div>
      <SaveResetBar dirty={dirty} onSave={save} onReset={reset} busy={busy} />
      <DangerButton onClick={() => setConfirming(true)}>Delete player</DangerButton>
      <p style={{ fontSize: 11, color: "var(--parchment-faint)" }}>
        Awards are set in the Season &amp; Cup editors. Delete is blocked when the player has participations — merge instead.
      </p>
      {confirming && (
        <ConfirmDialog
          title={`Delete "${player.display_name}"?`}
          body="This permanently removes the player."
          confirmWord="delete"
          onConfirm={del}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
