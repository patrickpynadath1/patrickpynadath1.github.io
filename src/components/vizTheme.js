// Shared palette for the interactive blog figures.
// The figures read colors from `P` while they render. `withVizTheme` keeps `P`
// in sync with the page's light/dark setting (data-theme on <html>) and
// re-renders the figure when the reader switches themes.
import React, { useEffect, useState } from "react";

export const DARK = {
  bg: "#121321", inset: "#0e0f1b", panel: "#1a1b2b", grid: "#2a2b3d", line: "#2f3044", line2: "#3a3b50",
  faint: "#4f4e66", dim: "#6f6e87", dim2: "#7d7c94", muted: "#aaa9bd", text: "#efedf6",
  accent: "#c29fef", accentSoft: "#decef3", accentDim: "#6d4b9b", accent2: "#f4bd71",
  good: "#4fd08f", bad: "#ef6b7b", warn: "#e8d44d", orange: "#f0a830", orange2: "#f9884a", lime: "#a8e063",
  candi: "#57c27c", mdlm: "#e8686c", duo: "#6aa6e0", highlight: "#f4bd71", pinkText: "#f6d8ef",
  accentRgb: "194, 159, 239", highlightRgb: "244, 189, 113", pinkRgb: "255, 112, 177", panelRgb: "26, 27, 43",
  borderRgb: "50, 50, 64", shadowRgb: "3, 4, 12", orangeRgb: "249, 136, 74", textRgb: "239, 237, 246",
};

export const LIGHT = {
  bg: "#f6f5fa", inset: "#ffffff", panel: "#eeecf5", grid: "#dedbe8", line: "#d8d6e2", line2: "#c9c6d6",
  faint: "#b4b1c4", dim: "#8a879d", dim2: "#7a778e", muted: "#646174", text: "#302e42",
  accent: "#603a92", accentSoft: "#4a2a75", accentDim: "#af9cc9", accent2: "#ae6113",
  good: "#1f8f55", bad: "#c4344a", warn: "#9a7d00", orange: "#b86e00", orange2: "#c2541a", lime: "#5a8f1c",
  candi: "#2f8f4e", mdlm: "#c43c3c", duo: "#2f6fae", highlight: "#9a5a0c", pinkText: "#8a2f63",
  accentRgb: "96, 58, 146", highlightRgb: "174, 97, 19", pinkRgb: "196, 60, 130", panelRgb: "238, 236, 245",
  borderRgb: "216, 214, 226", shadowRgb: "48, 46, 66", orangeRgb: "194, 84, 26", textRgb: "48, 46, 66",
};

// Live palette. Mutated in place so module-level getters always see the current theme.
export const P = { ...DARK };

function readTheme() {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function useVizTheme() {
  // Server render and first client render are always dark, so hydration matches.
  const [theme, setTheme] = useState("dark");
  useEffect(() => {
    const update = () => setTheme(readTheme());
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  Object.assign(P, theme === "light" ? LIGHT : DARK);
  return theme;
}

export function withVizTheme(Component) {
  function Themed(props) {
    const theme = useVizTheme();
    // Remount on a theme switch so memoized drawing picks up the new colors.
    return React.createElement(Component, { key: theme, ...props });
  }
  Themed.displayName = `Themed(${Component.displayName || Component.name || "Figure"})`;
  return Themed;
}
