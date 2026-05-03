"use client";

import type { StandingEntry } from "@/lib/types";
import { fmtPct, PlayerAvatar } from "@/components/bits";

interface PodiumProps {
  standings: StandingEntry[];
}

export function Podium({ standings }: PodiumProps) {
  if (standings.length < 3) return null;
  const top3 = standings.slice(0, 3);
  const order = [1, 0, 2]; // silver, gold, bronze left-to-right
  const cfg = {
    0: { sheen: "bg-gold-sheen",   shadow: "var(--shadow-gold-glow)",   color: "var(--accent-300)",  label: "1st", height: 168 },
    1: { sheen: "bg-silver-sheen", shadow: "var(--shadow-silver-glow)", color: "var(--silver-300)",  label: "2nd", height: 138 },
    2: { sheen: "bg-bronze-sheen", shadow: "var(--shadow-bronze-glow)", color: "var(--bronze-300)",  label: "3rd", height: 122 },
  } as const;

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="eyebrow">● Podium</div>
        <div style={{ fontSize: 11, color: "var(--parchment-faint)" }}>Top 3 by points · win % tiebreak</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.05fr 1fr", gap: 14, alignItems: "end" }}>
        {order.map(idx => {
          const p = top3[idx];
          const c = cfg[idx as 0 | 1 | 2];
          return (
            <div key={p.player_id} className="themed-surface" style={{
              position: "relative", borderRadius: "var(--radius-card)",
              background: "linear-gradient(180deg, var(--ink-850), var(--ink-900))",
              border: `1px solid color-mix(in srgb, ${c.color} 35%, transparent)`,
              padding: "18px 18px 16px", boxShadow: c.shadow, minHeight: c.height,
              display: "flex", flexDirection: "column", justifyContent: "flex-end",
            }}>
              <div className={c.sheen} style={{
                position: "absolute", top: -10, left: 18, padding: "2px 10px", borderRadius: 4,
                fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700,
                color: "var(--ink-950)", letterSpacing: "0.05em",
              }}>{c.label}</div>

              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <PlayerAvatar name={p.display_name} rank={idx + 1} size={idx === 0 ? 52 : 44} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="font-display" style={{ fontSize: idx === 0 ? 19 : 17, color: "var(--parchment)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</div>
                  <div style={{ fontSize: 11, color: "var(--parchment-muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                    {p.match_wins}W · {p.match_losses}L · {p.match_draws}D
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14, paddingTop: 12, borderTop: `1px solid color-mix(in srgb, ${c.color} 18%, transparent)` }}>
                <div>
                  <div className="font-display" style={{ fontSize: idx === 0 ? 32 : 26, color: c.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{p.points}</div>
                  <div className="eyebrow">Points</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 14, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{fmtPct(p.win_pct)}</div>
                  <div className="eyebrow">Win rate</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
