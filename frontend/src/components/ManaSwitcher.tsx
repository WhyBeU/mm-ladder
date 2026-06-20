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
const ORB = 12;            // px per orb (matches mana-cost circle font-size)
const RADIUS = 19;         // px from centre to orb centre

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
              display: "flex", alignItems: "center", justifyContent: "center",
              zIndex: active ? 2 : 1,
              transition: "transform 150ms",
              transform: active ? "scale(1.35)" : "scale(1)",
              boxShadow: active ? "0 0 0 1.5px var(--accent-300)" : "none",
              filter: active ? "none" : "grayscale(0.6) opacity(0.55)",
            }}
            onMouseEnter={(e) => { if (!active) e.currentTarget.style.filter = "grayscale(0.2) opacity(0.85)"; }}
            onMouseLeave={(e) => { if (!active) e.currentTarget.style.filter = "grayscale(0.6) opacity(0.55)"; }}
          >
            {/* Soft gold glow halo behind the selected pip — makes the active colour obvious */}
            {active && (
              <span
                aria-hidden
                style={{
                  position: "absolute", inset: -8, borderRadius: "50%", zIndex: 0,
                  background: "radial-gradient(circle, color-mix(in srgb, var(--accent-400) 65%, transparent) 0%, color-mix(in srgb, var(--accent-400) 25%, transparent) 45%, transparent 72%)",
                  filter: "blur(1.5px)",
                  pointerEvents: "none",
                }}
              />
            )}
            {/* ms-cost renders a 1.3em coloured disc, so size the font to ORB/1.3 → a
                disc of exactly ORB px, centred in the button so ring + halo line up. */}
            <i className={`ms ms-${code.toLowerCase()} ms-cost`} style={{ fontSize: ORB / 1.3, position: "relative", zIndex: 1 }} />
          </button>
        );
      })}
    </div>
  );
}
