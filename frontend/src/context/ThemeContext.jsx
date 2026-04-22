import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

const TOKENS = {
  dark: {
    bgBase:          "#0f172a",
    bgCard:          "#1e293b",
    bgDeep:          "#0f172a",
    bgStripe:        "rgba(15,23,42,0.25)",
    bgInput:         "#0f172a",
    border:          "#334155",
    borderLight:     "#1e293b",
    textPrimary:     "#f1f5f9",
    textSecondary:   "#94a3b8",
    textMuted:       "#64748b",
    textDim:         "#475569",
    gridColor:       "rgba(51,65,85,0.6)",
    axisColor:       "#334155",
    tooltipBg:       "#1e293b",
    tooltipBorder:   "#334155",
    tooltipTitle:    "#f1f5f9",
    tooltipBody:     "#94a3b8",
    btnBg:           "#1e293b",
    btnBgActive:     "rgba(59,130,246,0.15)",
    btnBorder:       "#334155",
    scrollbarThumb:  "#334155",
  },
  light: {
    bgBase:          "#f1f5f9",
    bgCard:          "#ffffff",
    bgDeep:          "#f8fafc",
    bgStripe:        "rgba(241,245,249,0.6)",
    bgInput:         "#f8fafc",
    border:          "#e2e8f0",
    borderLight:     "#f1f5f9",
    textPrimary:     "#0f172a",
    textSecondary:   "#475569",
    textMuted:       "#64748b",
    textDim:         "#94a3b8",
    gridColor:       "rgba(203,213,225,0.7)",
    axisColor:       "#e2e8f0",
    tooltipBg:       "#ffffff",
    tooltipBorder:   "#e2e8f0",
    tooltipTitle:    "#0f172a",
    tooltipBody:     "#475569",
    btnBg:           "#f1f5f9",
    btnBgActive:     "rgba(59,130,246,0.1)",
    btnBorder:       "#e2e8f0",
    scrollbarThumb:  "#cbd5e1",
  },
};

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setMode] = useState(() => localStorage.getItem("soc-theme") || "dark");

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("soc-theme", next);
      return next;
    });
  }, []);

  // body 배경색 동기화
  useEffect(() => {
    document.body.style.background = TOKENS[mode].bgBase;
    document.body.style.color      = TOKENS[mode].textPrimary;
  }, [mode]);

  return (
    <ThemeContext.Provider value={{ mode, tokens: TOKENS[mode], toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
