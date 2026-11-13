// Qualitative trade-off between the three tasks: how easy each is to evaluate vs how close it is
// to real language modeling. Positions are a judgement call, not measurements.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";

const TASKS = [
  { id: "sudoku", label: "Sudoku", x: 0.14, y: 0.86, metric: "exact-solve accuracy",
    info: "Easiest to evaluate: a puzzle is solved or not. Furthest from language: each prompt has one correct answer, and the 9 digits are about equally frequent, unlike the very skewed token frequencies of real text." },
  { id: "text8", label: "text8", x: 0.48, y: 0.55, metric: "distinct valid words of 5+ letters",
    info: "Closer to language: real words, and characters with an uneven frequency distribution. Easier to score than stories, but there are many reasonable ways to score coherence, and our word count only captures short-range coherence. The vocabulary (a few dozen characters) is far from a realistic size." },
  { id: "tinystories", label: "TinyStories", x: 0.84, y: 0.2, metric: "MAUVE (plus SOL and a judge)",
    info: "Closest to the language modeling we care about: real stories over a 10k BPE vocabulary. Also the hardest to evaluate well: there is no single right continuation, and per-story scores can reward short, generic stories, so we compare distributions with MAUVE." },
];

function FrontierInner() {
  const [hover, setHover] = useState("text8");
  const W = 560, H = 300, L = 46, R = 16, T = 16, B = 40;
  const x = (v) => L + v * (W - L - R), y = (v) => T + (1 - v) * (H - T - B);
  const cur = TASKS.find((t) => t.id === hover);
  const pts = TASKS.map((t) => `${x(t.x)},${y(t.y)}`).join(" ");
  return (
    <Frame
      kicker="Figure · choosing tasks"
      title="Easy to evaluate, or close to language?"
      subtitle="Each task trades one for the other; no task we can afford is good at both. Hover a task for why it sits where it does."
      note="Positions are qualitative, not measured. The ideal task would sit in the top right; larger language benchmarks (OpenWebText, TinyGSM) are closer to it but too costly for a study this broad."
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        <defs>
          <marker id="tfa" viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto"><path d="M0,0 L10,5 L0,10 z" fill={P.dim2} /></marker>
        </defs>
        <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke={P.dim2} strokeWidth={1.2} markerEnd="url(#tfa)" />
        <line x1={L} x2={L} y1={H - B} y2={T} stroke={P.dim2} strokeWidth={1.2} markerEnd="url(#tfa)" />
        <text x={W - R} y={H - 12} fill={P.muted} fontSize={11} textAnchor="end">closer to real language modeling →</text>
        <text x={14} y={T + 4} fill={P.muted} fontSize={11} textAnchor="end" transform={`rotate(-90 14 ${T + 4})`}>easier to evaluate →</text>
        <text x={x(0.84)} y={y(0.93) + 4} fill={P.dim2} fontSize={10} textAnchor="end">ideal (out of reach)</text>
        <rect x={x(0.86)} y={y(1)} width={x(1) - x(0.86)} height={y(0.86) - y(1)} rx={6} fill="none" stroke={P.dim2} strokeDasharray="3 3" />
        <polyline points={pts} fill="none" stroke={rgba(P.accent, 0.55)} strokeWidth={2} strokeDasharray="5 4" />
        {TASKS.map((t) => {
          const on = hover === t.id;
          return (
            <g key={t.id} onMouseEnter={() => setHover(t.id)} style={{ cursor: "pointer" }}>
              <circle cx={x(t.x)} cy={y(t.y)} r={18} fill="transparent" />
              <circle cx={x(t.x)} cy={y(t.y)} r={on ? 8 : 6.5} fill={P.accent} stroke={P.bg} strokeWidth={2} />
              <text x={x(t.x) + (t.x > 0.7 ? -13 : 13)} textAnchor={t.x > 0.7 ? "end" : "start"} y={y(t.y) - 8} fill={P.text} fontSize={12.5} fontWeight={700}>{t.label}</text>
              <text x={x(t.x) + (t.x > 0.7 ? -13 : 13)} textAnchor={t.x > 0.7 ? "end" : "start"} y={y(t.y) + 7} fill={P.dim2} fontSize={9.5}>{t.metric}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ minHeight: 58, marginTop: 6, padding: "8px 12px", borderRadius: 10, background: rgba(P.inset, 0.7), border: `1px solid ${P.line}` }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: P.accent, marginBottom: 3 }}>{cur.label}</div>
        <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.45 }}>{cur.info}</div>
      </div>
    </Frame>
  );
}

export const TaskFrontier = withVizTheme(FrontierInner);
export default TaskFrontier;
