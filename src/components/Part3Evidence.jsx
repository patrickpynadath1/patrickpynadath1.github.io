// Part 3 evidence figures. Every number is read from the Part 2 data:
// src/data/sc_rerun.json (best tuned and untuned test scores) and
// (The entropy-curve distances quoted in the text come from src/data/sc_ordering.json.)
// All comparisons stay inside one task, since the three task metrics differ.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";
import RERUN from "../data/sc_rerun.json";

const SANS = "Helvetica, Arial, sans-serif";
const TASKS = [
  { id: "sudoku", label: "Sudoku", unit: "accuracy" },
  { id: "text8", label: "text8", unit: "valid words / sample" },
  { id: "tinystories", label: "TinyStories", unit: "MAUVE" },
];
const NOISE = (t) => RERUN.meta.tasks[t].noise;
const fmt = (t, v) => (v == null ? "–" : t === "sudoku" ? `${(v * 100).toFixed(1)}%` : t === "text8" ? v.toFixed(2) : v.toFixed(3));
const fmtD = (t, d) => {
  const s = d >= 0 ? "+" : "−", a = Math.abs(d);
  return t === "sudoku" ? `${s}${(a * 100).toFixed(1)} pts` : t === "text8" ? `${s}${a.toFixed(2)}` : `${s}${a.toFixed(3)}`;
};

const CASE = {};
for (const c of RERUN.cases) CASE[`${c.task}|${c.disc || "-"}|${c.cont || "-"}|${c.arm}`] = c;
const get = (task, disc, cont, arm, kind = "best") => {
  const c = CASE[`${task}|${disc}|${cont}|${arm}`];
  if (!c) return null;
  return kind === "best" ? c.test : c.base?.test ?? null;
};
const CONTS = ["gaussian", "spherical", "vmf", "simplex"];
const CLAB = { gaussian: "Gaussian", spherical: "Spherical", vmf: "vMF", simplex: "Simplex" };

// ─── Figure 3: masked vs uniform, without and with SC ─────────────────────────
function DumbbellRow({ task, label, color, a, b, lo, hi, w }) {
  const x0 = 96, x1 = w - 70;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  return (
    <g>
      <text x={0} y={4} fontSize={12} fill={P.muted}>{label}</text>
      <line x1={X(a)} y1={0} x2={X(b)} y2={0} stroke={color} strokeWidth={2} opacity={0.5} />
      <circle cx={X(a)} cy={0} r={5.5} fill={P.inset} stroke={color} strokeWidth={2} />
      <circle cx={X(b)} cy={0} r={5.5} fill={color} />
      <text x={x1 + 12} y={4} fontSize={11} fill={P.text} fontFamily={FONT}>{fmtD(task, b - a)}</text>
    </g>
  );
}

function MaskedUniformInner() {
  const [kind, setKind] = useState("best");
  const W = 520;
  return (
    <Frame
      kicker="Figure 3"
      title="Masked and uniform respond to self conditioning in opposite ways"
      subtitle="Each line runs from the score without self conditioning (open dot) to the score with it (filled dot). Scales differ by task, so compare within a panel only."
      controls={<Pills value={kind} onChange={setKind} options={[
        { id: "best", label: "Best tuned sampler" },
        { id: "base", label: "Untuned native sampler" },
      ]} />}
      note={<>Data from Part 2, one training seed per model. One-seed noise levels: about 3 points on Sudoku, 0.5 words on text8 and 0.045 MAUVE on TinyStories.</>}
    >
      {TASKS.map((t) => {
        const rows = [
          { id: "masked", label: "Masked", color: P.mdlm },
          { id: "uniform", label: "Uniform", color: P.duo },
        ].map((r) => ({ ...r, a: get(t.id, r.id, "-", "none", kind), b: get(t.id, r.id, "-", "sc", kind) }));
        const vals = rows.flatMap((r) => [r.a, r.b]);
        const pad = (Math.max(...vals) - Math.min(...vals)) * 0.15 || 0.01;
        const lo = Math.min(...vals) - pad, hi = Math.max(...vals) + pad;
        return (
          <div key={t.id} style={{ margin: "10px 0 6px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: P.text }}>{t.label} <span style={{ fontWeight: 400, color: P.dim2, fontSize: 12 }}>· {t.unit}</span></div>
            <svg viewBox={`0 -10 ${W} 56`} width="100%" style={{ display: "block", fontFamily: SANS, maxWidth: 620 }}>
              {rows.map((r, i) => (
                <g key={r.id} transform={`translate(0, ${i * 26})`}>
                  <DumbbellRow task={t.id} label={r.label} color={r.color} a={r.a} b={r.b} lo={lo} hi={hi} w={W} />
                </g>
              ))}
            </svg>
          </div>
        );
      })}
    </Frame>
  );
}

// ─── Figure 4: how each recipe's best score responds to self conditioning ────
const SC_ROWS = [
  { d: "uniform", c: "-", label: "Uniform", color: () => P.duo },
  { d: "-", c: "gaussian", label: "Gaussian", color: () => P.accent },
  { d: "-", c: "spherical", label: "Spherical", color: () => P.accent },
  { d: "-", c: "vmf", label: "vMF", color: () => P.accent },
  { d: "-", c: "simplex", label: "Simplex", color: () => P.accent },
  { d: "masked", c: "-", label: "Masked", color: () => P.mdlm, sep: true },
];

function SCResponseInner() {
  return (
    <Frame
      kicker="Figure 4"
      title="Self conditioning raises the best score of uniform and the continuous methods; masked is the exception"
      subtitle="Each cell is the change in a recipe's best tuned score when self conditioning is added, on that task. Green: higher with self conditioning. Red: lower. A pale cell means the change is within the one-seed noise level."
      note={<>Part 2 data, best tuned sampler, one training seed per model. Noise levels: 3 points on Sudoku, 0.5 words on text8, 0.045 MAUVE on TinyStories.</>}
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ display: "table", width: "100%", tableLayout: "fixed", borderCollapse: "collapse", minWidth: 0, margin: 0, fontFamily: SANS }}>
          <thead>
            <tr>
              <th style={{ width: "26%" }}></th>
              {TASKS.map((t) => <th key={t.id} style={{ fontSize: 12.5, color: P.text, fontWeight: 600, padding: "6px 4px", textTransform: "none", letterSpacing: 0 }}>{t.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {SC_ROWS.map((r) => (
              <tr key={r.label} style={{ borderTop: r.sep ? `2px solid ${P.line2}` : `1px solid ${P.line}` }}>
                <td style={{ padding: "8px 6px", fontSize: 13, fontWeight: 600, color: r.color() }}>{r.label}</td>
                {TASKS.map((t) => {
                  const a = get(t.id, r.d, r.c, "none"), b = get(t.id, r.d, r.c, "sc");
                  const dd = b - a, big = Math.abs(dd) > NOISE(t.id);
                  const col = dd >= 0 ? P.good : P.bad;
                  return (
                    <td key={t.id} style={{ padding: "8px 3px", textAlign: "center", background: rgba(col, big ? 0.2 : 0.07) }}>
                      <span style={{ fontFamily: FONT, fontSize: 12.5, color: big ? col : P.muted, fontWeight: big ? 600 : 400 }}>{fmtD(t.id, dd)}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Frame>
  );
}

// ─── Figure 5: self conditioning pulls the six pure recipes together ─────────
const PURE6 = [
  { d: "masked", c: "-", label: "Masked", color: () => P.mdlm },
  { d: "uniform", c: "-", label: "Uniform", color: () => P.duo },
  { d: "-", c: "gaussian", label: "Gaussian", color: () => P.accent },
  { d: "-", c: "spherical", label: "Spherical", color: () => P.orange },
  { d: "-", c: "vmf", label: "vMF", color: () => P.lime },
  { d: "-", c: "simplex", label: "Simplex", color: () => P.pinkText },
];

function SpreadInner() {
  const [kind, setKind] = useState("base");
  const W = 560, x0 = 96, x1 = W - 16;
  return (
    <Frame
      kicker="Figure 5"
      title="With self conditioning, the six recipes score more alike"
      subtitle="Each dot is one pure recipe's score on the task. The top strip is without self conditioning, the bottom strip with it. When the dots bunch together, the choice of recipe matters less."
      controls={<Pills value={kind} onChange={setKind} options={[
        { id: "base", label: "Untuned native sampler" },
        { id: "best", label: "Best tuned sampler" },
      ]} />}
      note={<>Part 2 data, one training seed per model. On TinyStories, simplex is the one recipe that self conditioning hurts, so it sits apart from the others.</>}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", margin: "2px 0 8px" }}>
        {PURE6.map((m) => (
          <span key={m.label} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: P.muted }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: m.color(), display: "inline-block" }} />{m.label}
          </span>
        ))}
      </div>
      {TASKS.map((t) => {
        const rows = ["none", "sc"].map((arm) => PURE6.map((m) => ({ m, v: get(t.id, m.d, m.c, arm, kind) })).filter((x) => x.v != null));
        const vals = rows.flat().map((x) => x.v);
        const pad = (Math.max(...vals) - Math.min(...vals)) * 0.06;
        const lo = Math.min(...vals) - pad, hi = Math.max(...vals) + pad;
        const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
        const gap = (r) => Math.max(...r.map((x) => x.v)) - Math.min(...r.map((x) => x.v));
        return (
          <div key={t.id} style={{ margin: "12px 0 4px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: P.text }}>{t.label} <span style={{ fontWeight: 400, color: P.dim2, fontSize: 12 }}>· {t.unit}</span></div>
            <svg viewBox={`0 0 ${W} 86`} width="100%" style={{ display: "block", fontFamily: SANS, maxWidth: 680 }}>
              {rows.map((r, i) => {
                const y = 18 + i * 34;
                const mn = Math.min(...r.map((x) => x.v)), mx = Math.max(...r.map((x) => x.v));
                return (
                  <g key={i}>
                    <text x={0} y={y + 4} fontSize={11.5} fill={i ? P.candi : P.muted}>{i ? "with SC" : "without SC"}</text>
                    <line x1={x0} y1={y} x2={x1} y2={y} stroke={P.line} />
                    <rect x={X(mn)} y={y - 9} width={Math.max(X(mx) - X(mn), 1)} height={18} rx={9} fill={rgba(i ? P.candi : P.text, 0.08)} />
                    {r.map(({ m, v }) => <circle key={m.label} cx={X(v)} cy={y} r={6} fill={m.color()} stroke={P.inset} strokeWidth={1.5}><title>{`${m.label}: ${fmt(t.id, v)}`}</title></circle>)}
                  </g>
                );
              })}
              <text x={x0} y={84} fontSize={10.5} fill={P.dim2} fontFamily={FONT}>{fmt(t.id, lo)}</text>
              <text x={x1} y={84} fontSize={10.5} fill={P.dim2} fontFamily={FONT} textAnchor="end">{fmt(t.id, hi)}</text>
              <text x={(x0 + x1) / 2} y={84} fontSize={10.5} fill={P.text} fontFamily={FONT} textAnchor="middle">
                {`spread ${fmt(t.id, gap(rows[0])).replace("%", " pts")} → ${fmt(t.id, gap(rows[1])).replace("%", " pts")}`}
                {gap(rows[1]) > gap(rows[0]) ? ` (${fmt(t.id, gap(rows[0].filter((x) => x.m.label !== "Simplex")))} → ${fmt(t.id, gap(rows[1].filter((x) => x.m.label !== "Simplex")))} without simplex)` : ""}
              </text>
            </svg>
          </div>
        );
      })}
    </Frame>
  );
}

export const MaskedUniformSC = withVizTheme(MaskedUniformInner);
export const SCResponse = withVizTheme(SCResponseInner);
export const RecipeSpread = withVizTheme(SpreadInner);
