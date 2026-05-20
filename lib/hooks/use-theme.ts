"use client";

import { createContext, useContext } from "react";

export type AppTheme = "taskos" | "bloom" | "midnight";

export const APP_THEMES: { value: AppTheme; label: string }[] = [
  { value: "taskos", label: "Worksphere" },
  { value: "bloom", label: "Bloom" },
  { value: "midnight", label: "Midnight" },
];

type ThemeContextValue = {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return ctx;
}
