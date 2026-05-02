"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "mm-ladder:mana-theme";
const VALID = ["W", "U", "B", "R", "G"] as const;
const DEFAULT = "U";

type ManaColor = (typeof VALID)[number];

interface ManaThemeContextValue {
  theme: ManaColor;
  setTheme: (t: string) => void;
}

const ManaThemeContext = createContext<ManaThemeContextValue>({
  theme: DEFAULT,
  setTheme: () => {},
});

function readSavedTheme(): ManaColor {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && (VALID as readonly string[]).includes(saved)) {
      return saved as ManaColor;
    }
  } catch {}
  return DEFAULT;
}

export function ManaThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ManaColor>(readSavedTheme);

  // Apply to <html> + persist
  useEffect(() => {
    document.documentElement.setAttribute("data-mana", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {}
  }, [theme]);

  const setTheme = (t: string) => {
    if ((VALID as readonly string[]).includes(t)) setThemeState(t as ManaColor);
  };

  return (
    <ManaThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ManaThemeContext.Provider>
  );
}

export const useManaTheme = () => useContext(ManaThemeContext);
