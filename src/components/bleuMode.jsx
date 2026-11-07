// One switch for every TinyStories BLEU in the post: standard corpus BLEU, or
// BLEU without the brevity (length) penalty. Each figure is its own island, so
// the choice is shared through a window event and remembered per reader.
import { useEffect, useState } from "react";
import { P } from "./vizTheme.js";
import { Pills } from "./SelfCondDepth.jsx";

const KEY = "bleu-mode";
const EVENT = "bleu-mode-change";

export function useBleuMode() {
  const [mode, setMode] = useState("bleu");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "bleu" || saved === "nobp") setMode(saved);
    } catch {}
    const on = (e) => setMode(e.detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  const set = (m) => {
    try { localStorage.setItem(KEY, m); } catch {}
    window.dispatchEvent(new CustomEvent(EVENT, { detail: m }));
  };
  return [mode, set];
}

export const BLEU_OPTIONS = [
  { id: "bleu", label: "BLEU" },
  { id: "nobp", label: "BLEU, no length penalty", color: () => P.highlight },
];

export function BleuPills() {
  const [mode, setMode] = useBleuMode();
  return <Pills value={mode} onChange={setMode} options={BLEU_OPTIONS} />;
}

// Swap a TinyStories row's test score for the length-penalty-free one.
export const withMode = (r, mode) =>
  r && mode === "nobp" && r.score_nobp != null ? { ...r, score: r.score_nobp, seeds: r.seeds_nobp ?? r.seeds } : r;

export const metricName = (mode) => (mode === "nobp" ? "reference BLEU without length penalty" : "reference BLEU");
