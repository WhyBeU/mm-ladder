"use client";

import { useMemo, useState } from "react";

// Initializes once from `initial`; callers remount the editor via `key={entity.id}`
// when switching entities, so there is no need to re-sync on `initial` changes
// (and doing so would clobber in-progress edits on every render / background refetch).
export function useDraft<T>(initial: T) {
  const [snapshot, setSnapshot] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(snapshot), [draft, snapshot]);
  return {
    draft,
    setDraft,
    dirty,
    reset: () => setDraft(snapshot),
    commit: (saved: T) => {
      setSnapshot(saved);
      setDraft(saved);
    },
  };
}

export function SaveResetBar({
  dirty,
  onSave,
  onReset,
  busy,
}: {
  dirty: boolean;
  onSave: () => void;
  onReset: () => void;
  busy?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", margin: "12px 0" }}>
      <button
        disabled={!dirty || busy}
        onClick={onSave}
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          border: "none",
          background: dirty ? "var(--accent-400)" : "var(--ink-700)",
          color: "var(--ink-950)",
          fontWeight: 700,
          cursor: dirty ? "pointer" : "default",
        }}
      >
        {busy ? "Saving…" : "Save changes"}
      </button>
      <button
        disabled={!dirty || busy}
        onClick={onReset}
        style={{
          padding: "6px 14px",
          borderRadius: 8,
          border: "1px solid var(--ink-700)",
          background: "transparent",
          color: "var(--parchment)",
          cursor: dirty ? "pointer" : "default",
        }}
      >
        Reset changes
      </button>
      {dirty && <span style={{ fontSize: 12, color: "var(--bronze-300)" }}>● unsaved edits</span>}
    </div>
  );
}
