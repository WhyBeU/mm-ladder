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

const ManaSymbol: Record<ManaCode, () => React.ReactElement> = {
  W: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <circle cx="12" cy="12" r="11" fill="#FFFBEA" stroke="#C9A961" strokeWidth="0.6"/>
      <g fill="#C9A961">
        <path d="M12 4.5 L12.7 8.2 L11.3 8.2 Z"/>
        <path d="M12 19.5 L11.3 15.8 L12.7 15.8 Z"/>
        <path d="M4.5 12 L8.2 11.3 L8.2 12.7 Z"/>
        <path d="M19.5 12 L15.8 12.7 L15.8 11.3 Z"/>
      </g>
      <circle cx="12" cy="12" r="2.5" fill="#E8D88A"/>
    </svg>
  ),
  U: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <circle cx="12" cy="12" r="11" fill="#CFE8F7" stroke="#5089a8" strokeWidth="0.6"/>
      <path
        d="M12 5.5 C12 5.5, 7.5 11, 7.5 14.5 C7.5 17.3, 9.5 19, 12 19 C14.5 19, 16.5 17.3, 16.5 14.5 C16.5 11, 12 5.5, 12 5.5 Z"
        fill="#1a6b80"
      />
      <path
        d="M9.2 14.2 C9.2 16, 10.4 17.2, 11.8 17.4"
        stroke="#7FBFD4" strokeWidth="0.9" fill="none" strokeLinecap="round"
      />
    </svg>
  ),
  B: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <circle cx="12" cy="12" r="11" fill="#D4CFC9" stroke="#6b6359" strokeWidth="0.6"/>
      <path
        d="M12 6.5 C8.7 6.5, 6.3 8.7, 6.3 11.8 C6.3 13.6, 7.2 15, 8.5 15.7 L8.5 17.5 L10 17.5 L10 16.5 L11 16.5 L11 17.5 L13 17.5 L13 16.5 L14 16.5 L14 17.5 L15.5 17.5 L15.5 15.7 C16.8 15, 17.7 13.6, 17.7 11.8 C17.7 8.7, 15.3 6.5, 12 6.5 Z"
        fill="#1a1a1a"
      />
      <circle cx="9.7" cy="11.3" r="1.2" fill="#D4CFC9"/>
      <circle cx="14.3" cy="11.3" r="1.2" fill="#D4CFC9"/>
      <path d="M11 13.5 L13 13.5 L12 15 Z" fill="#D4CFC9"/>
    </svg>
  ),
  R: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <circle cx="12" cy="12" r="11" fill="#F7CEC4" stroke="#a85a44" strokeWidth="0.6"/>
      <path
        d="M12 5 C12.8 7.5, 15.5 9.5, 15.5 13 C15.5 15.8, 14 17.5, 12 17.5 C10 17.5, 8.5 15.8, 8.5 13 C8.5 11.5, 9.3 10.2, 10.2 9.8 C10.3 11.3, 11.2 11.7, 12 10.5 C12 8.8, 11.2 7.5, 12 5 Z"
        fill="#c84a2a"
      />
    </svg>
  ),
  G: () => (
    <svg viewBox="0 0 24 24" className="w-full h-full">
      <circle cx="12" cy="12" r="11" fill="#D4E5D0" stroke="#5c8a5e" strokeWidth="0.6"/>
      <path
        d="M12 5 C9.5 6.8, 8 9.5, 8 11.7 C8 13, 8.8 13.8, 10 13.8 L10 15.5 L8.7 17.5 L15.3 17.5 L14 15.5 L14 13.8 C15.2 13.8, 16 13, 16 11.7 C16 9.5, 14.5 6.8, 12 5 Z"
        fill="#2c6936"
      />
    </svg>
  ),
};

const SIZE_CLASSES = {
  sm:      "w-7 h-7",
  default: "w-7 h-7",
};

interface ManaSwitcherProps {
  size?: "sm" | "default";
}

export default function ManaSwitcher({ size = "default" }: ManaSwitcherProps) {
  const { theme, setTheme } = useManaTheme();
  const sizeClass = SIZE_CLASSES[size] ?? SIZE_CLASSES.default;

  return (
    <div role="radiogroup" aria-label="Mana theme" className="flex items-center gap-1.5">
      {THEMES.map((code) => {
        const Symbol = ManaSymbol[code];
        const active = theme === code;
        return (
          <button
            key={code}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={THEME_NAMES[code]}
            title={THEME_NAMES[code]}
            onClick={() => setTheme(code)}
            className={`${sizeClass} rounded-full inline-flex items-center justify-center
                        bg-ink-800 border-2 cursor-pointer
                        transition-all duration-150 hover:-translate-y-0.5
                        ${active
                          ? "border-accent-400 shadow-gold-glow"
                          : "border-transparent hover:border-ink-600"}`}
          >
            <div className="w-[18px] h-[18px]">
              <Symbol />
            </div>
          </button>
        );
      })}
    </div>
  );
}
