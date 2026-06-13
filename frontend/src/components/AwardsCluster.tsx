import type { StandingEntry } from "@/lib/types";

function Award({ children, tip, badge }: { children: React.ReactNode; tip: React.ReactNode; badge?: number }) {
  return (
    <span className="aw">
      {children}
      {badge && badge > 1 ? <span className="aw-badge">{badge}</span> : null}
      <span className="aw-tip">{tip}</span>
    </span>
  );
}

interface AwardItem {
  key: string;
  node: React.ReactNode;
  label: string;
}

export default function AwardsCluster({
  player,
  wrap = false,
  max,
}: {
  player: StandingEntry;
  wrap?: boolean;
  max?: number;
}) {
  const champs = player.season_championships ?? [];
  const potyYears = player.player_of_the_year_years ?? [];
  const cupYears = player.cup_champion_years ?? [];

  if (champs.length === 0 && potyYears.length === 0 && cupYears.length === 0) return null;

  const items: AwardItem[] = [];
  for (const c of champs) {
    items.push({
      key: `c-${c.set_code}`,
      label: `${c.season_name} Champion`,
      node: (
        <Award tip={`${c.season_name} Champion`}>
          <i className={`ss ss-${c.set_code.toLowerCase()} aw-mythic`} style={{ fontSize: 20 }} />
        </Award>
      ),
    });
  }
  if (potyYears.length > 0) {
    items.push({
      key: "poty",
      label: potyYears.map((y) => `${y} Player of the Year`).join(", "),
      node: (
        <Award badge={potyYears.length} tip={potyYears.map((y) => <div key={y}>{y} Player of the Year</div>)}>
          <span className="aw-trophy" />
        </Award>
      ),
    });
  }
  if (cupYears.length > 0) {
    items.push({
      key: "cup",
      label: cupYears.map((y) => `MM Cup winner ${y}`).join(", "),
      node: (
        <Award badge={cupYears.length} tip={cupYears.map((y) => <div key={y}>MM Cup winner {y}</div>)}>
          <span className="aw-mm" />
        </Award>
      ),
    });
  }

  // When a max is set and exceeded, keep (max - 1) icons and fold the rest into a "+N" chip
  // whose tooltip labels the hidden awards.
  const showOverflow = max != null && items.length > max;
  const visible = showOverflow ? items.slice(0, max - 1) : items;
  const hidden = showOverflow ? items.slice(max - 1) : [];

  return (
    <span style={{ display: "inline-flex", flexWrap: wrap ? "wrap" : "nowrap", alignItems: "center", gap: 7 }}>
      {visible.map((it) => (
        <span key={it.key} style={{ display: "inline-flex" }}>
          {it.node}
        </span>
      ))}
      {hidden.length > 0 && (
        <span className="aw">
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--parchment-muted)",
              border: "1px solid var(--ink-700)",
              borderRadius: 10,
              padding: "0 6px",
              lineHeight: "18px",
            }}
          >
            +{hidden.length}
          </span>
          <span className="aw-tip">
            {hidden.map((h) => (
              <div key={h.key}>{h.label}</div>
            ))}
          </span>
        </span>
      )}
    </span>
  );
}
