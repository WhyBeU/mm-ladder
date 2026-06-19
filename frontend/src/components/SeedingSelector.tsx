"use client";

import { SEED_METHODS, type SeedMethod } from "@/lib/pods";

/** Segmented Random / Average / Best / Total selector, shared by /pods and /board. */
export default function SeedingSelector({
  method,
  onChange,
}: {
  method: SeedMethod;
  onChange: (m: SeedMethod) => void;
}) {
  return (
    <div style={{ display: "inline-flex", border: "1px solid var(--ink-600)", borderRadius: 8, overflow: "hidden" }}>
      {SEED_METHODS.map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          style={{
            padding: "6px 14px",
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            cursor: "pointer",
            border: "none",
            borderLeft: m === SEED_METHODS[0] ? "none" : "1px solid var(--ink-700)",
            background: method === m ? "var(--primary-700)" : "var(--ink-850)",
            color: method === m ? "var(--parchment)" : "var(--parchment-muted)",
            fontWeight: method === m ? 600 : 400,
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}
