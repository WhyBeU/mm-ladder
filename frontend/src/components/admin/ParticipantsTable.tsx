"use client";

import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchTournamentParticipants, fetchPlayers, type ApiParticipant } from "@/lib/api";
import { adminApi } from "@/lib/adminApi";
import PlayerPicker from "@/components/admin/PlayerPicker";
import { inputStyle, useToast } from "@/components/admin/ui";

export default function ParticipantsTable({ tournamentId }: { tournamentId: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const key = ["admin", "participants", tournamentId];
  const { data: parts = [] } = useQuery({ queryKey: key, queryFn: () => fetchTournamentParticipants(tournamentId) });
  const { data: players = [] } = useQuery({ queryKey: ["players"], queryFn: fetchPlayers });
  const invalidate = () => qc.invalidateQueries({ queryKey: key });

  const [sortKey, setSortKey] = useState<"name" | "points">("points");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const onSort = (k: "name" | "points") => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(k); setSortDir(k === "name" ? "asc" : "desc"); }
  };
  const nameOf = (id: number) => players.find((pl) => pl.id === id)?.display_name ?? "";
  // View-only sort over a copy — never reorders the stored data or save payloads.
  const sortedParts = useMemo(() => {
    const copy = [...parts];
    copy.sort((a, b) => {
      if (sortKey === "name") {
        const r = nameOf(a.player_id).localeCompare(nameOf(b.player_id));
        return sortDir === "asc" ? r : -r;
      }
      return sortDir === "asc" ? a.points - b.points : b.points - a.points;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parts, players, sortKey, sortDir]);
  const [adding, setAdding] = useState<{ player_id: number | null; w: number; l: number; d: number }>({
    player_id: null,
    w: 0,
    l: 0,
    d: 0,
  });

  const patchWLD = async (p: ApiParticipant, field: "match_wins" | "match_losses" | "match_draws", value: number) => {
    try {
      await adminApi.patchParticipant(tournamentId, p.id, { [field]: value });
      invalidate();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  const reassign = async (p: ApiParticipant, player_id: number | null) => {
    if (!player_id) return;
    try {
      await adminApi.patchParticipant(tournamentId, p.id, { player_id });
      invalidate();
      toast("Reassigned");
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  const remove = async (p: ApiParticipant) => {
    if (!window.confirm("Remove this participant?")) return;
    try {
      await adminApi.deleteParticipant(tournamentId, p.id);
      invalidate();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };
  const add = async () => {
    if (!adding.player_id) return;
    try {
      await adminApi.createParticipant(tournamentId, {
        player_id: adding.player_id,
        match_wins: adding.w,
        match_losses: adding.l,
        match_draws: adding.d,
      });
      setAdding({ player_id: null, w: 0, l: 0, d: 0 });
      invalidate();
    } catch (e) {
      toast((e as Error).message, "err");
    }
  };

  const num = (v: number, on: (n: number) => void) => (
    <input type="number" defaultValue={v} onBlur={(e) => on(Number(e.target.value))} style={{ ...inputStyle, width: 50 }} />
  );

  const thSortStyle: React.CSSProperties = {
    background: "none", border: "none", padding: 0, cursor: "pointer",
    color: "inherit", font: "inherit", fontWeight: 600,
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ textAlign: "left", opacity: 0.7 }}>
          <th>
            <button onClick={() => onSort("name")} style={thSortStyle}>
              Player {sortKey === "name" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
            </button>
          </th>
          <th>W</th>
          <th>L</th>
          <th>D</th>
          <th>
            <button onClick={() => onSort("points")} style={thSortStyle}>
              Pts {sortKey === "points" ? (sortDir === "asc" ? "▲" : "▼") : "⇅"}
            </button>
          </th>
          <th />
        </tr>
      </thead>
      <tbody>
        {sortedParts.map((p) => (
          <tr key={p.id} style={{ borderTop: "1px solid var(--ink-800)" }}>
            <td>
              <PlayerPicker value={p.player_id} onChange={(id) => reassign(p, id)} allowNone={false} />
            </td>
            <td>{num(p.match_wins, (n) => patchWLD(p, "match_wins", n))}</td>
            <td>{num(p.match_losses, (n) => patchWLD(p, "match_losses", n))}</td>
            <td>{num(p.match_draws, (n) => patchWLD(p, "match_draws", n))}</td>
            <td>
              <b>{p.points}</b>
            </td>
            <td>
              <button onClick={() => remove(p)} style={{ border: "none", background: "none", color: "var(--loss)", cursor: "pointer" }}>
                remove
              </button>
            </td>
          </tr>
        ))}
        <tr style={{ borderTop: "1px solid var(--ink-700)" }}>
          <td>
            <PlayerPicker value={adding.player_id} onChange={(id) => setAdding({ ...adding, player_id: id })} />
          </td>
          <td>{num(adding.w, (n) => setAdding({ ...adding, w: n }))}</td>
          <td>{num(adding.l, (n) => setAdding({ ...adding, l: n }))}</td>
          <td>{num(adding.d, (n) => setAdding({ ...adding, d: n }))}</td>
          <td>—</td>
          <td>
            <button onClick={add} style={{ border: "none", background: "none", color: "var(--accent-300)", cursor: "pointer" }}>
              add
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
