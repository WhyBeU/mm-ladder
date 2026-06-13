"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchPlayers, type ApiPlayer } from "@/lib/api";
import { inputStyle } from "@/components/admin/ui";

export function usePlayers() {
  return useQuery({ queryKey: ["admin", "players"], queryFn: fetchPlayers });
}

export default function PlayerPicker({
  value,
  onChange,
  allowNone = true,
}: {
  value: number | null;
  onChange: (id: number | null) => void;
  allowNone?: boolean;
}) {
  const { data: players = [] } = usePlayers();
  const [q, setQ] = useState("");
  const selected = players.find((p) => p.id === value) ?? null;
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? players.filter((p: ApiPlayer) => p.display_name.toLowerCase().includes(needle)).slice(0, 8) : [];
  }, [q, players]);

  if (selected && !q) {
    return (
      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
        <span>{selected.display_name}</span>
        <button
          onClick={() => onChange(allowNone ? null : value)}
          style={{ border: "none", background: "none", color: "var(--parchment-faint)", cursor: "pointer" }}
        >
          change
        </button>
      </span>
    );
  }
  return (
    <div style={{ position: "relative", display: "inline-block" }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="search player…" style={{ ...inputStyle, width: 200 }} />
      {matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, zIndex: 10, background: "var(--ink-900)", border: "1px solid var(--ink-700)", borderRadius: 8, width: 200 }}>
          {matches.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onChange(p.id);
                setQ("");
              }}
              style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 10px", background: "none", border: "none", color: "var(--parchment)", cursor: "pointer" }}
            >
              {p.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
