"use client";

import type { StandingEntry } from "@/lib/types";
import { fmtPct, PlayerAvatar } from "@/components/bits";
import AwardsCluster from "@/components/AwardsCluster";

interface QualifiedCardsProps {
  standings: StandingEntry[];
  qualifiedPlayerIds: number[];
}

function hasAwards(p: StandingEntry): boolean {
  return (
    (p.season_championships?.length ?? 0) +
      (p.player_of_the_year_years?.length ?? 0) +
      (p.cup_champion_years?.length ?? 0) >
    0
  );
}

export function QualifiedCards({ standings, qualifiedPlayerIds }: QualifiedCardsProps) {
  if (qualifiedPlayerIds.length === 0) return null;

  const byId = new Map(standings.map((s) => [s.player_id, s]));
  const cards = qualifiedPlayerIds.map((id) => byId.get(id)).filter((e): e is StandingEntry => e != null);
  if (cards.length === 0) return null;

  return (
    <section style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div className="eyebrow">● Qualified players</div>
        <div style={{ fontSize: 11, color: "var(--parchment-faint)" }}>{cards.length} qualified · set by admin</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {cards.map((p) => (
          <div
            key={p.player_id}
            className="themed-surface"
            style={{
              borderRadius: "var(--radius-card)",
              background: "linear-gradient(180deg, var(--ink-850), var(--ink-900))",
              border: "1px solid color-mix(in srgb, var(--accent-400) 30%, transparent)",
              padding: "16px 16px 14px",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <PlayerAvatar name={p.display_name} rank={p.rank} size={44} isVeteran={p.is_veteran} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div
                  className="font-display"
                  style={{ fontSize: 16, color: "var(--parchment)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {p.display_name}
                </div>
                <div style={{ fontSize: 11, color: "var(--parchment-muted)", marginTop: 2, fontVariantNumeric: "tabular-nums" }}>
                  {p.match_wins}W · {p.match_losses}L · {p.match_draws}D
                </div>
              </div>
            </div>

            {hasAwards(p) && (
              <div style={{ marginTop: 10 }}>
                <AwardsCluster player={p} wrap />
              </div>
            )}

            <div style={{ display: "flex", gap: 10, marginTop: 12, paddingTop: 10, borderTop: "1px solid var(--ink-800)" }}>
              <Stat label="Points" value={p.points} accent />
              <Stat label="Win %" value={fmtPct(p.win_pct)} />
              <Stat label="Trophies" value={p.trophies || "—"} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div style={{ flex: 1 }}>
      <div
        className="font-display"
        style={{ fontSize: 18, lineHeight: 1, color: accent ? "var(--accent-300)" : "var(--parchment)", fontVariantNumeric: "tabular-nums" }}
      >
        {value}
      </div>
      <div className="eyebrow">{label}</div>
    </div>
  );
}
