"use client";

import { useState } from "react";
import { usePlayers } from "@/components/admin/PlayerPicker";
import PlayerPicker from "@/components/admin/PlayerPicker";
import { adminApi } from "@/lib/adminApi";
import { ConfirmDialog, inputStyle, useToast } from "@/components/admin/ui";

export default function MergeTool({ onClose }: { onClose: () => void }) {
  const { data: players = [] } = usePlayers();
  const toast = useToast();
  const [keep, setKeep] = useState<number | null>(null);
  const [dups, setDups] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  const name = (id: number) => players.find((p) => p.id === id)?.display_name ?? `#${id}`;

  const doMerge = async () => {
    try {
      await adminApi.mergePlayers(keep!, dups);
      toast("Merged");
      onClose();
    } catch (e) {
      toast((e as Error).message, "err");
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
      <div style={{ width: 460, background: "var(--ink-900)", border: "1px solid var(--ink-700)", borderRadius: 12, padding: 20 }}>
        <h3 style={{ marginTop: 0 }}>Merge players</h3>
        <div style={{ marginBottom: 10 }}>
          Keep (canonical): <PlayerPicker value={keep} onChange={setKeep} />
        </div>
        <div style={{ marginBottom: 10 }}>
          Duplicates to fold in:
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0" }}>
            {dups.map((d) => (
              <span key={d} style={{ background: "var(--ink-800)", borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
                {name(d)}{" "}
                <button onClick={() => setDups(dups.filter((x) => x !== d))} style={{ border: "none", background: "none", color: "var(--parchment-faint)", cursor: "pointer" }}>
                  ✕
                </button>
              </span>
            ))}
          </div>
          <PlayerPicker
            value={null}
            onChange={(id) => {
              if (id && id !== keep && !dups.includes(id)) setDups([...dups, id]);
            }}
          />
        </div>
        {keep && dups.length > 0 && (
          <p style={{ fontSize: 12, color: "var(--parchment-muted)" }}>
            Reassign all participations of {dups.map(name).join(", ")} → {name(keep)}, fold their names into aliases, delete them.
          </p>
        )}
        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <button
            disabled={!keep || dups.length === 0}
            onClick={() => setConfirming(true)}
            style={{ ...inputStyle, cursor: "pointer", background: "var(--accent-400)", color: "var(--ink-950)", fontWeight: 700, border: "none" }}
          >
            Merge…
          </button>
          <button onClick={onClose} style={{ ...inputStyle, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Merge players?"
          body="This reassigns participations and deletes the duplicate players."
          confirmWord="merge"
          onConfirm={doMerge}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
