"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AuditEntry } from "@/lib/adminApi";
import { inputStyle } from "@/components/admin/ui";

const ENTITY_TYPES = ["", "player", "season", "yearly_cup", "tournament", "participant", "match"];
const ACTIONS = ["", "CREATE", "UPDATE", "DELETE"];
const PAGE = 50;

const actionColor = (a: string) => (a === "CREATE" ? "var(--win)" : a === "DELETE" ? "var(--loss)" : "var(--accent-400)");

export default function HistorySection() {
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const [offset, setOffset] = useState(0);
  const { data } = useQuery({
    queryKey: ["admin", "audit", entityType, action, offset],
    queryFn: () => adminApi.listAudit({ entity_type: entityType || undefined, action: action || undefined, limit: PAGE, offset }),
  });
  const items = data?.items ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>History</h2>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={entityType} onChange={(e) => { setEntityType(e.target.value); setOffset(0); }} style={inputStyle}>
          {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t || "all entities"}</option>)}
        </select>
        <select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} style={inputStyle}>
          {ACTIONS.map((a) => <option key={a} value={a}>{a || "all actions"}</option>)}
        </select>
        <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--parchment-faint)", alignSelf: "center" }}>{total} entries</span>
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 4 }}>
        {items.map((e) => <Row key={e.id} entry={e} />)}
        {items.length === 0 && <li style={{ color: "var(--parchment-muted)", padding: 12 }}>No entries.</li>}
      </ul>
      <div style={{ display: "flex", gap: 8, marginTop: 12, alignItems: "center" }}>
        <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))} style={{ ...inputStyle, cursor: "pointer" }}>Prev</button>
        <button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)} style={{ ...inputStyle, cursor: "pointer" }}>Next</button>
        <span style={{ fontSize: 12, color: "var(--parchment-faint)" }}>
          {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE, total)} of {total}
        </span>
      </div>
    </div>
  );
}

function Row({ entry }: { entry: AuditEntry }) {
  const [open, setOpen] = useState(false);
  return (
    <li style={{ border: "1px solid var(--ink-800)", borderRadius: 8 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ display: "flex", gap: 10, alignItems: "center", width: "100%", textAlign: "left", background: "none", border: "none", color: "var(--parchment)", cursor: "pointer", padding: "8px 12px", fontFamily: "inherit", fontSize: 13 }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: actionColor(entry.action), width: 56 }}>{entry.action}</span>
        <span style={{ fontWeight: 600 }}>{entry.label}</span>
        <span style={{ color: "var(--parchment-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{entry.summary}</span>
        <span style={{ color: "var(--parchment-faint)", fontSize: 11 }}>{new Date(entry.created_at).toLocaleString()}</span>
      </button>
      {open && entry.changes.length > 0 && (
        <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse", margin: "0 0 8px" }}>
          <thead>
            <tr style={{ color: "var(--parchment-faint)", textAlign: "left" }}>
              <th style={{ padding: "2px 12px" }}>Field</th>
              <th>Old</th>
              <th>New</th>
            </tr>
          </thead>
          <tbody>
            {entry.changes.map((c) => (
              <tr key={c.field}>
                <td style={{ padding: "2px 12px", color: "var(--parchment-muted)" }}>{c.field}</td>
                <td style={{ color: "var(--loss)" }}>{JSON.stringify(c.old)}</td>
                <td style={{ color: "var(--win)" }}>{JSON.stringify(c.new)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </li>
  );
}
