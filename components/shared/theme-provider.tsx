"use client";

import { useEffect, useMemo, useState } from "react";
import { APP_THEMES, AppTheme, ThemeContext } from "@/lib/hooks/use-theme";

const STORAGE_KEY = "employee-tracker-theme";
const DEFAULT_THEME: AppTheme = "taskos";

function isAppTheme(value: string): value is AppTheme {
  return APP_THEMES.some((theme) => theme.value === value);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<AppTheme>(DEFAULT_THEME);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && isAppTheme(saved)) {
      setTheme(saved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      setTheme,
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
