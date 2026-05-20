"use client";

import { createContext, useContext } from "react";

export type AppTheme = "taskos" | "bloom" | "sand" | "stone" | "sage";

export const APP_THEMES: { value: AppTheme; label: string }[] = [
  { value: "taskos", label: "Worksphere" },
  { value: "bloom", label: "Bloom" },
  { value: "sand", label: "Sand" },
  { value: "stone", label: "Stone" },
  { value: "sage", label: "Sage" },
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
