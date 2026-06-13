"use client";

import { createContext, useCallback, useContext, useState } from "react";

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--parchment-muted)" }}>
      <span style={{ textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</span>
      {children}
    </label>
  );
}

export const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  borderRadius: 6,
  border: "1px solid var(--ink-700)",
  background: "var(--ink-850)",
  color: "var(--parchment)",
  fontSize: 14,
  fontFamily: "inherit",
};

export function DangerButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "8px 14px",
        borderRadius: 8,
        background: "transparent",
        color: "var(--loss)",
        border: "1px solid var(--loss)",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmWord,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmWord: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const [typed, setTyped] = useState("");
  const ok = typed.trim().toLowerCase() === confirmWord.toLowerCase();
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div style={{ width: 420, background: "var(--ink-900)", border: "1px solid var(--ink-700)", borderRadius: 12, padding: 20 }}>
        <h3 style={{ margin: "0 0 8px" }}>{title}</h3>
        <p style={{ fontSize: 13, color: "var(--parchment-muted)" }}>{body}</p>
        <p style={{ fontSize: 13 }}>
          Type <code>{confirmWord}</code> to confirm:
        </p>
        <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} style={{ ...inputStyle, width: "60%" }} />
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <button
            disabled={!ok}
            onClick={onConfirm}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "none",
              background: ok ? "var(--loss)" : "var(--ink-700)",
              color: "#fff",
              cursor: ok ? "pointer" : "not-allowed",
            }}
          >
            Confirm
          </button>
          <button
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid var(--ink-700)",
              background: "transparent",
              color: "var(--parchment)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChipEditor({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setDraft("");
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
      {values.map((v) => (
        <span key={v} style={{ background: "var(--ink-800)", border: "1px solid var(--ink-700)", borderRadius: 12, padding: "2px 8px", fontSize: 12 }}>
          {v}{" "}
          <button onClick={() => onChange(values.filter((x) => x !== v))} style={{ border: "none", background: "none", color: "var(--parchment-faint)", cursor: "pointer" }}>
            ✕
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        placeholder={placeholder}
        style={{ ...inputStyle, width: 140 }}
      />
    </div>
  );
}

// --- toasts ---
type Toast = { id: number; msg: string; kind: "ok" | "err" };
const ToastCtx = createContext<(msg: string, kind?: "ok" | "err") => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((msg: string, kind: "ok" | "err" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { id, msg, kind }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div style={{ position: "fixed", bottom: 16, right: 16, display: "flex", flexDirection: "column", gap: 8, zIndex: 60 }}>
        {items.map((t) => (
          <div key={t.id} style={{ padding: "10px 14px", borderRadius: 8, color: "#fff", background: t.kind === "ok" ? "var(--win)" : "var(--loss)", fontSize: 13 }}>
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
