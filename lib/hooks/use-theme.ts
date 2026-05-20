"use client";

import { createContext, useContext } from "react";

export type AppTheme = "taskos" | "bloom" | "sand";

export const APP_THEMES: { value: AppTheme; label: string }[] = [
  { value: "taskos", label: "Worksphere" },
  { value: "bloom", label: "Bloom" },
  { value: "sand", label: "Sand" },
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
