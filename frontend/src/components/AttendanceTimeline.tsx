"use client";

import { useEffect, useRef, useState } from "react";
import { rollingAverage, type AttendanceSeries } from "@/lib/attendance";
import { fmtDate } from "@/components/bits";

const ROLLING_WINDOW = 4;
const ROLLING_COLOR = "#b98cf0"; // purple 4-week rolling average

// Chart geometry (pixel space; width is measured from the container).
const H = 240;
const LOGO_ROW = 26; // top band reserved for season logos
const PLOT_TOP = LOGO_ROW + 8;
const BAND_LABEL = 22; // bottom band reserved for cup-year labels
const PLOT_BOTTOM = H - BAND_LABEL;
const PLOT_H = PLOT_BOTTOM - PLOT_TOP;
const PAD_LEFT = 48;
const PAD_RIGHT = 14;
const POD_SIZE = 8; // y gridlines land on pod boundaries (8 players ≈ one pod)

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export default function AttendanceTimeline({ series }: { series: AttendanceSeries }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[0]?.contentRect.width ?? el.clientWidth);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { points, seasonMarkers } = series;
  const n = points.length;
  if (n < 2) return null;

  const avg = Math.round(points.reduce((s, p) => s + p.attendance, 0) / n);

  return (
    <section className="attendance-timeline" style={{ marginTop: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
        <h3 className="font-display" style={{ margin: 0, fontSize: 16, color: "var(--parchment)" }}>
          Attendance over time
        </h3>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
          <LegendSwatch color="var(--accent-400)" label="Weekly" faint />
          <LegendSwatch color={ROLLING_COLOR} label={`${ROLLING_WINDOW}-wk avg`} />
          <span className="eyebrow" style={{ color: "var(--parchment-faint)" }}>
            {n} weeks · avg {avg} players
          </span>
        </div>
      </div>

      <div ref={ref} style={{ position: "relative", width: "100%", height: H }}>
        {width > 0 && <Chart series={series} width={width} />}

        {/* Season-start logos (HTML overlay so keyrune icon fonts + tooltips work).
            Icon brightness alternates with the cup-year band it sits in. */}
        {width > 0 &&
          seasonMarkers.map((m) => {
            const plotW = width - PAD_LEFT - PAD_RIGHT;
            const x = PAD_LEFT + (m.firstIndex / (n - 1)) * plotW;
            const bandIndex = series.cupBands.findIndex((b) => m.firstIndex >= b.startIndex && m.firstIndex <= b.endIndex);
            const color = bandIndex % 2 === 0 ? "var(--primary-200)" : "var(--primary-400)";
            return (
              <span
                key={m.seasonId}
                className="aw"
                style={{ position: "absolute", left: x, top: 0, transform: "translateX(-50%)", fontSize: 18 }}
              >
                <i className={`ss ss-${m.keyrune} ss-fw`} style={{ color }} />
                <span className="aw-tip">{m.setCode}</span>
              </span>
            );
          })}
      </div>
    </section>
  );
}

function LegendSwatch({ color, label, faint }: { color: string; label: string; faint?: boolean }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--parchment-muted)" }}>
      <span style={{ width: 14, height: 0, borderTop: `2px solid ${color}`, opacity: faint ? 0.5 : 1, display: "inline-block" }} />
      {label}
    </span>
  );
}

function Chart({ series, width }: { series: AttendanceSeries; width: number }) {
  const { points, seasonMarkers, cupBands } = series;
  const n = points.length;
  const plotW = width - PAD_LEFT - PAD_RIGHT;
  const halfStep = plotW / (n - 1) / 2;
  const niceMax = Math.max(2 * POD_SIZE, Math.ceil(series.maxAttendance / POD_SIZE) * POD_SIZE);

  const xFor = (i: number) => PAD_LEFT + (i / (n - 1)) * plotW;
  const yFor = (v: number) => PLOT_TOP + PLOT_H - (v / niceMax) * PLOT_H;

  const linePath = points.map((p, i) => `${i ? "L" : "M"}${xFor(i).toFixed(1)},${yFor(p.attendance).toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${xFor(n - 1).toFixed(1)},${PLOT_BOTTOM} L${xFor(0).toFixed(1)},${PLOT_BOTTOM} Z`;
  const avgValues = rollingAverage(points.map((p) => p.attendance), ROLLING_WINDOW);
  const avgPath = avgValues.map((v, i) => `${i ? "L" : "M"}${xFor(i).toFixed(1)},${yFor(v).toFixed(1)}`).join(" ");
  // Gridlines on pod boundaries (8, 16, 24, …) so height reads as pod count.
  const ticks: number[] = [];
  for (let v = POD_SIZE; v <= niceMax; v += POD_SIZE) ticks.push(v);
  const axisMid = PLOT_TOP + PLOT_H / 2;

  return (
    <svg width={width} height={H} style={{ display: "block", position: "absolute", inset: 0 }}>
      <defs>
        <linearGradient id="attn-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--accent-400)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--accent-400)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Cup-year bands (alternating tint) + labels */}
      {cupBands.map((b, i) => {
        const left = clamp(xFor(b.startIndex) - halfStep, PAD_LEFT, PAD_LEFT + plotW);
        const right = clamp(xFor(b.endIndex) + halfStep, PAD_LEFT, PAD_LEFT + plotW);
        return (
          <g key={i}>
            {i % 2 === 0 && (
              <rect x={left} y={PLOT_TOP} width={right - left} height={PLOT_H} fill="color-mix(in srgb, var(--ink-700) 22%, transparent)" />
            )}
            {i > 0 && <line x1={left} y1={PLOT_TOP} x2={left} y2={PLOT_BOTTOM} stroke="var(--ink-700)" strokeWidth="1" strokeDasharray="2 3" />}
            <text x={(left + right) / 2} y={PLOT_BOTTOM + 15} textAnchor="middle" fontSize="11" fontWeight="700" fill="var(--parchment-muted)">
              {b.label}
            </text>
          </g>
        );
      })}

      {/* Pod-boundary gridlines + y labels (8, 16, 24, …) */}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={PAD_LEFT} y1={yFor(t)} x2={PAD_LEFT + plotW} y2={yFor(t)} stroke="color-mix(in srgb, var(--ink-700) 55%, transparent)" strokeWidth="1" />
          <text x={PAD_LEFT - 7} y={yFor(t) + 3} textAnchor="end" fontSize="10" fill="var(--parchment-faint)" fontFamily="var(--font-mono)">
            {t}
          </text>
        </g>
      ))}
      {/* Baseline (0) */}
      <line x1={PAD_LEFT} y1={PLOT_BOTTOM} x2={PAD_LEFT + plotW} y2={PLOT_BOTTOM} stroke="var(--ink-700)" strokeWidth="1" />
      {/* Y-axis title */}
      <text
        x={13}
        y={axisMid}
        transform={`rotate(-90 13 ${axisMid})`}
        textAnchor="middle"
        fontSize="10"
        fill="var(--parchment-faint)"
        style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        players / event
      </text>

      {/* Season-start vertical markers */}
      {seasonMarkers.map((m) => (
        <line
          key={m.seasonId}
          x1={xFor(m.firstIndex)}
          y1={PLOT_TOP}
          x2={xFor(m.firstIndex)}
          y2={PLOT_BOTTOM}
          stroke="color-mix(in srgb, var(--primary-300) 45%, transparent)"
          strokeWidth="1"
        />
      ))}

      {/* Weekly attendance — faint area + thin line */}
      <path d={areaPath} fill="url(#attn-fill)" />
      <path d={linePath} fill="none" stroke="var(--accent-400)" strokeOpacity="0.5" strokeWidth="1.1" strokeLinejoin="round" strokeLinecap="round" />

      {/* 4-week rolling average — the prominent purple line */}
      <path d={avgPath} fill="none" stroke={ROLLING_COLOR} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />

      {/* Weekly points + hover targets */}
      {points.map((p, i) => (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(p.attendance)} r={1.8} fill="var(--accent-400)" fillOpacity="0.55" />
          <circle cx={xFor(i)} cy={yFor(p.attendance)} r={9} fill="transparent" style={{ cursor: "default" }}>
            <title>{`MMM #${p.eventNumber} · ${fmtDate(p.heldOn)} · ${p.attendance} player${p.attendance === 1 ? "" : "s"}`}</title>
          </circle>
        </g>
      ))}
    </svg>
  );
}
