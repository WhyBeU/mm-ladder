"use client";

import { useManaTheme } from "@/context/ManaThemeContext";

const THEMES = ["W", "U", "B", "R", "G"] as const;
type ManaCode = (typeof THEMES)[number];

const THEME_NAMES: Record<ManaCode, string> = {
  W: "White · Plains",
  U: "Blue · Island",
  B: "Black · Swamp",
  R: "Red · Mountain",
  G: "Green · Forest",
};

const PENTAGON_BOX = 72;   // px container
const ORB = 22;            // px per orb (matches mana-cost circle font-size)
const RADIUS = 26;         // px from centre to orb centre

// angle per code, degrees clockwise from top (canonical WUBRG wheel)
const ANGLE: Record<ManaCode, number> = { W: 0, U: 72, B: 144, R: 216, G: 288 };

function orbPos(code: ManaCode): { left: number; top: number } {
  const rad = (ANGLE[code] * Math.PI) / 180;
  const cx = PENTAGON_BOX / 2 + RADIUS * Math.sin(rad);
  const cy = PENTAGON_BOX / 2 - RADIUS * Math.cos(rad);
  return { left: cx - ORB / 2, top: cy - ORB / 2 };
}

export default function ManaSwitcher() {
  const { theme, setTheme } = useManaTheme();

  return (
    <div
      role="radiogroup"
      aria-label="Mana theme"
      style={{ position: "relative", width: PENTAGON_BOX, height: PENTAGON_BOX, flexShrink: 0 }}
    >
      {THEMES.map((code) => {
        const active = theme === code;
        const { left, top } = orbPos(code);
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={THEME_NAMES[code]}
            title={THEME_NAMES[code]}
            onClick={() => setTheme(code)}
            style={{
              position: "absolute", left, top, width: ORB, height: ORB,
              padding: 0, border: "none", background: "none", cursor: "pointer",
              borderRadius: "50%", lineHeight: 0,
              transition: "transform 150ms",
              transform: active ? "scale(1.18)" : "scale(1)",
              boxShadow: active ? "var(--shadow-gold-glow), 0 0 0 2px var(--accent-400)" : "none",
              filter: active ? "none" : "grayscale(0.35) opacity(0.8)",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.filter = "none"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.filter = "grayscale(0.35) opacity(0.8)"; }}
          >
            <i className={`ms ms-${code.toLowerCase()} ms-cost`} style={{ fontSize: ORB }} />
          </button>
        );
      })}
    </div>
  );
}
