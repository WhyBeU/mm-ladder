"use client";

import type { StandingEntry } from "@/lib/types";
import { fmtPct, PlayerAvatar } from "@/components/bits";
import AwardsCluster from "@/components/AwardsCluster";

interface PodiumProps {
  standings: StandingEntry[];
}

export function Podium({ standings }: PodiumProps) {
  if (standings.length < 3) return null;
  const top3 = standings.slice(0, 3);
  const order = [1, 0, 2]; // silver, gold, bronze left-to-right
  // Coin diameter carries the ranking: a bigger gold medallion always reads as the champion,
  // so award count can never invert the podium order. The avatar sits ~30px inside the coin's rim.
  // coin = medallion diameter, plinth = stat-block height, big = "best" figure size — all stepped
  // by rank so the champion towers over the runners-up (grand-hero scaling).
  const cfg = {
    0: { sheen: "bg-gold-sheen",   shadow: "var(--shadow-gold-glow)",   color: "var(--accent-300)",  label: "1st", coin: 120, plinth: 92, big: 30 },
    1: { sheen: "bg-silver-sheen", shadow: "var(--shadow-silver-glow)", color: "var(--silver-300)",  label: "2nd", coin: 92,  plinth: 66, big: 22 },
    2: { sheen: "bg-bronze-sheen", shadow: "var(--shadow-bronze-glow)", color: "var(--bronze-300)",  label: "3rd", coin: 80,  plinth: 52, big: 20 },
  } as const;

  return (
    <section className="podium" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="eyebrow">● Podium</div>
        <div style={{ fontSize: 11, color: "var(--parchment-faint)" }}>Top 3 by points · win % tiebreak</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.15fr 1fr", gap: 16, alignItems: "end" }}>
        {order.map(idx => {
          const p = top3[idx];
          const c = cfg[idx as 0 | 1 | 2];
          const gold = idx === 0;
          const bestTotal = p.comp_avg != null && p.comp_avg_n != null
            ? Math.round(p.comp_avg * p.comp_avg_n)
            : null;
          return (
            <div key={p.player_id} style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
              {/* Medallion coin: metal rim, dark gap, then the sheen avatar (halo if veteran). */}
              <div style={{ position: "relative", width: c.coin, height: c.coin, borderRadius: "50%", boxShadow: c.shadow, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div className={c.sheen} style={{ position: "absolute", inset: 0, borderRadius: "50%" }} />
                <div style={{ position: "absolute", inset: 4, borderRadius: "50%", background: "var(--ink-950)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <PlayerAvatar name={p.display_name} rank={idx + 1} size={c.coin - 30} isVeteran={p.is_veteran} />
                </div>
                <div className={c.sheen} style={{
                  position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)",
                  padding: "1px 10px", borderRadius: 4, zIndex: 2,
                  fontFamily: "var(--font-display)", fontSize: 12, fontWeight: 700,
                  color: "var(--ink-950)", letterSpacing: "0.05em",
                }}>{c.label}</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, minWidth: 0, width: "100%" }}>
                <div className="font-display" style={{ fontSize: gold ? 20 : 17, color: "var(--parchment)", lineHeight: 1.15, maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.display_name}</div>
                <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap" }}>
                  <AwardsCluster player={p} wrap />
                </div>
              </div>

              {/* Plinth — stat block sized & contoured by rank; its stepped height doubles the
                  hierarchy the coins start, so the champion clearly towers. */}
              <div style={{
                width: "100%", minHeight: c.plinth, display: "flex", alignItems: "center", gap: 8,
                background: "linear-gradient(180deg, var(--ink-850), var(--ink-900))",
                border: `1px solid color-mix(in srgb, ${c.color} 50%, transparent)`,
                boxShadow: `inset 0 2px 0 color-mix(in srgb, ${c.color} 22%, transparent)`,
                borderRadius: "var(--radius-card)", padding: "10px 12px",
              }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div className="font-display" style={{ fontSize: c.big, color: c.color, lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{bestTotal ?? p.points}</div>
                  <div className="eyebrow">{bestTotal != null ? "Best" : "Points"}</div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: gold ? 15 : 13, color: "var(--parchment)", fontVariantNumeric: "tabular-nums" }}>{fmtPct(p.win_pct)}</div>
                  <div className="eyebrow">Win %</div>
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: gold ? 15 : 13, color: p.trophies > 0 ? "var(--accent-300)" : "var(--parchment-faint)", fontVariantNumeric: "tabular-nums", fontWeight: p.trophies > 0 ? 700 : 400 }}>{p.trophies || "—"}</div>
                  <div className="eyebrow">Trophies</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
