"use client";

import type { StandingEntry } from "@/lib/types";

// ---------- Format helpers ----------
export const fmtPct = (n: number) => `${(n * 100).toFixed(0)}%`;
export const fmtAvg = (n: number) => n.toFixed(1);
export const fmtDate = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" });
};
export const fmtRange = (s: string, e: string) => {
  const ds = new Date(s + "T00:00:00"), de = new Date(e + "T00:00:00");
  return `${ds.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} – ${de.toLocaleDateString("en-AU", { day: "numeric", month: "short" })} ${de.getFullYear()}`;
};
export const initials = (n: string | null) => {
  if (!n) return "??";
  const p = n.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
};

// ---------- PlayerAvatar ----------
interface PlayerAvatarProps {
  name: string;
  rank: number;
  size?: number;
  isVeteran?: boolean;
}

function VeteranLaurel({ size }: { size: number }) {
  const pad = 5;
  const total = size + pad * 2;
  const cx = total / 2, cy = total / 2;
  const r = total / 2 - 1.5;
  // 14 small leaf-ellipses around the ring, alternating Byzantine purple and gold
  const leaves = Array.from({ length: 14 }, (_, i) => {
    const angle = (i / 14) * Math.PI * 2;
    const lx = cx + r * Math.cos(angle);
    const ly = cy + r * Math.sin(angle);
    const deg = (angle * 180) / Math.PI + 90;
    const fill = i % 2 === 0 ? "#5b2a6e" : "var(--accent-400)";
    return <ellipse key={i} cx={lx} cy={ly} rx={1.8} ry={3.2} fill={fill} opacity="0.85" transform={`rotate(${deg},${lx},${ly})`} />;
  });
  return (
    <svg
      style={{ position: "absolute", top: -pad, left: -pad, pointerEvents: "none" }}
      width={total} height={total}
    >
      <title>Veteran</title>
      {leaves}
    </svg>
  );
}

export function PlayerAvatar({ name, rank, size = 36, isVeteran }: PlayerAvatarProps) {
  const label = initials(name);
  const fs = Math.round(size * 0.36);
  const base: React.CSSProperties = {
    position: "relative",
    width: size, height: size, borderRadius: "50%",
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: fs, fontFamily: "var(--font-sans)",
    flexShrink: 0, letterSpacing: "0.03em",
  };
  const inner = isVeteran ? <VeteranLaurel size={size} /> : null;
  if (rank === 1) return (
    <div className="bg-gold-sheen" style={{ ...base, color: "var(--ink-950)", boxShadow: "var(--shadow-gold-glow)" }}>
      {inner}{label}
    </div>
  );
  if (rank === 2) return (
    <div className="bg-silver-sheen" style={{ ...base, color: "var(--ink-950)" }}>
      {inner}{label}
    </div>
  );
  if (rank === 3) return (
    <div className="bg-bronze-sheen" style={{ ...base, color: "var(--ink-950)" }}>
      {inner}{label}
    </div>
  );
  return (
    <div style={{ ...base, background: "var(--primary-700)", boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)", color: "var(--parchment)" }}>
      {inner}{label}
    </div>
  );
}

// ---------- RankDelta ----------
interface RankDeltaProps { delta: number }

export function RankDelta({ delta }: RankDeltaProps) {
  if (delta === 0) {
    return <span style={{ color: "var(--parchment-faint)", fontSize: 11, fontFamily: "var(--font-mono)" }}>—</span>;
  }
  const up = delta > 0;
  return (
    <span style={{
      color: up ? "var(--win)" : "var(--loss)",
      fontSize: 11, fontFamily: "var(--font-mono)",
      display: "inline-flex", alignItems: "center", gap: 2,
    }}>
      <span>{up ? "▲" : "▼"}</span>
      <span>{Math.abs(delta)}</span>
    </span>
  );
}

// ---------- StreakChips ----------
interface StreakChipsProps { streak: string }

export function StreakChips({ streak }: StreakChipsProps) {
  const chars = streak.slice(-5).split("");
  const colorFor = (c: string) =>
    c === "W" ? "var(--win)" : c === "L" ? "var(--loss)" : "var(--draw)";
  return (
    <div style={{ display: "inline-flex", gap: 3 }}>
      {chars.map((c, i) => (
        <span key={i} style={{
          width: 16, height: 16, borderRadius: 4,
          background: `color-mix(in srgb, ${colorFor(c)} 18%, transparent)`,
          color: colorFor(c),
          fontSize: 9, fontWeight: 700, fontFamily: "var(--font-mono)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          border: `1px solid color-mix(in srgb, ${colorFor(c)} 35%, transparent)`,
        }}>{c}</span>
      ))}
    </div>
  );
}

// ---------- Sparkline ----------
interface SparklineProps {
  data: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  showLabels?: boolean;
}

export function Sparkline({ data, width = 80, height = 24, color = "var(--accent-400)", showLabels }: SparklineProps) {
  const valid = data.filter((v): v is number => v != null);
  if (!valid.length) return null;
  const max = Math.max(...valid);
  const min = Math.min(...valid);
  const flat = max === min;
  const labelPad = showLabels ? 16 : 0;
  const chartHeight = height - labelPad;
  const stepX = valid.length > 1 ? width / (valid.length - 1) : 0;
  const pts = valid.map((v, i) => {
    const x = i * stepX;
    const y = labelPad + (flat ? chartHeight / 2 : chartHeight - ((v - min) / (max - min)) * chartHeight * 0.85 - chartHeight * 0.075);
    return [x, y, v] as [number, number, number];
  });
  const path = pts.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(1) + "," + y.toFixed(1)).join(" ");
  const area = path + ` L ${width},${height} L 0,${height} Z`;
  const gradId = `sl-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map(([x, y, v], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={i === pts.length - 1 ? 1.8 : 1.2} fill={color} />
          {showLabels && (
            <text x={x} y={y - 4} textAnchor="middle" fontSize={9} fill={color} opacity="0.9" fontFamily="var(--font-mono)">
              {v}
            </text>
          )}
        </g>
      ))}
    </svg>
  );
}

// ---------- PointsByEventChart ----------
interface PointsByEventChartProps { player: StandingEntry }

export function PointsByEventChart({ player }: PointsByEventChartProps) {
  const pts = player.per_event_points;
  const validValues = pts.filter((v): v is number => v != null);
  const max = Math.max(...validValues, 1);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 60 }}>
        {pts.map((v, idx) => {
          if (v == null) {
            return (
              <div key={idx} style={{ flex: 1, height: "100%", display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                <div style={{ height: 6, borderTop: "2px dashed color-mix(in srgb, var(--parchment-faint) 50%, transparent)" }} />
              </div>
            );
          }
          const h = `${(v / max) * 100}%`;
          const bg = v >= 7
            ? "linear-gradient(180deg, var(--accent-400), var(--accent-500))"
            : "linear-gradient(180deg, var(--primary-400), var(--primary-700))";
          return (
            <div key={idx} title={`Event ${idx + 1}: ${v} pts`}
              style={{ flex: 1, height: h, minHeight: 4, background: bg, borderRadius: 2, position: "relative" }}>
              <div style={{ position: "absolute", top: -16, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "var(--parchment-muted)", fontVariantNumeric: "tabular-nums" }}>{v}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--parchment-faint)", marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
        <span>Event 1</span><span>Event {pts.length}</span>
      </div>
    </>
  );
}
