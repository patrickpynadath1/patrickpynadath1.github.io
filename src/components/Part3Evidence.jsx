// Part 3 evidence figures. Every number is read from the Part 2 data:
// src/data/sc_rerun.json (best tuned and untuned test scores) and
// (The entropy-curve distances quoted in the text come from src/data/sc_ordering.json.)
// All comparisons stay inside one task, since the three task metrics differ.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";
import RERUN from "../data/sc_rerun.json";
import LADDER from "../data/sudoku_hint_ladder.json";

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

function MaskedUniformInner({ kicker = "Figure 4" }) {
  const [kind, setKind] = useState("best");
  const W = 520;
  return (
    <Frame
      kicker={kicker}
      title="Masked and uniform respond to self conditioning in opposite ways"
      subtitle="Each line runs from the score without self conditioning (open dot) to the score with it (filled dot). Scales differ by task, so compare within a panel only."
      controls={<Pills value={kind} onChange={setKind} options={[
        { id: "best", label: "Best tuned sampler" },
        { id: "base", label: "Untuned native sampler" },
      ]} />}
      note={<>One training seed per model. One-seed noise levels: about 3 points on Sudoku, 0.5 words on text8 and 0.045 MAUVE on TinyStories.</>}
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

function SCResponseInner({ kicker = "Figure 5" }) {
  return (
    <Frame
      kicker={kicker}
      title="Self conditioning raises the best score of uniform and the continuous methods; masked is the exception"
      subtitle="Each cell is the change in a recipe's best tuned score when self conditioning is added, on that task. Green: higher with self conditioning. Red: lower. A pale cell means the change is within the one-seed noise level."
      note={<>Best tuned sampler, one training seed per model. Noise levels: 3 points on Sudoku, 0.5 words on text8, 0.045 MAUVE on TinyStories.</>}
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

function SpreadInner({ kicker = "Figure 6" }) {
  const [kind, setKind] = useState("base");
  const W = 560, x0 = 96, x1 = W - 16;
  return (
    <Frame
      kicker={kicker}
      title="With self conditioning, the six recipes score more alike"
      subtitle="Each dot is one pure recipe's score on the task. The top strip is without self conditioning, the bottom strip with it. When the dots bunch together, the choice of recipe matters less."
      controls={<Pills value={kind} onChange={setKind} options={[
        { id: "base", label: "Untuned native sampler" },
        { id: "best", label: "Best tuned sampler" },
      ]} />}
      note={<>One training seed per model. On TinyStories, simplex is the one recipe that self conditioning hurts, so it sits apart from the others.</>}
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

// ─── Figure 6: sample diversity on TinyStories, without and with SC ──────────
// Untuned native sampler, 4,096 test stories per model (2,048 prompts x 2 seeds);
// corpus metrics scored per seed and averaged. From Claude outputs/simplex-diversity.
const DIV = {
  masked: { d2: [0.2849, 0.2555], vocab: [6205, 5587], rep4: [0.0023, 0.0052], open: [0.0081, 0.0312] },
  uniform: { d2: [0.2651, 0.2462], vocab: [5594, 5349], rep4: [0.0026, 0.0056], open: [0.0076, 0.0349] },
  gaussian: { d2: [0.2952, 0.2243], vocab: [6226, 4795], rep4: [0.0019, 0.0077], open: [0.0093, 0.0354] },
  spherical: { d2: [0.2912, 0.2079], vocab: [6170, 4508], rep4: [0.0017, 0.0086], open: [0.0081, 0.0564] },
  vmf: { d2: [0.2950, 0.2104], vocab: [6152, 4589], rep4: [0.0014, 0.0082], open: [0.0051, 0.0498] },
  simplex: { d2: [0.2477, 0.1299], vocab: [4852, 3196], rep4: [0.0055, 0.0225], open: [0.0325, 0.1104] },
};
const DIV_REF = { d2: 0.2532, vocab: 5635, rep4: 0.0084, open: 0.0186 };
const DIV_METRICS = [
  { id: "d2", label: "Bigrams", long: "distinct bigrams across all stories (higher = more diverse)", f: (v) => v.toFixed(3) },
  { id: "vocab", label: "Vocabulary", long: "distinct words used across all stories (higher = more diverse)", f: (v) => Math.round(v).toLocaleString("en-US") },
  { id: "rep4", label: "Repeats", long: "share of 4-grams repeated within a story (lower = more diverse)", f: (v) => `${(v * 100).toFixed(2)}%` },
  { id: "open", label: "Openings", long: "stories whose first 10 words match another story (lower = more diverse)", f: (v) => `${(v * 100).toFixed(1)}%` },
];
const DIV_ROWS = [
  { id: "masked", label: "Masked", color: () => P.mdlm },
  { id: "uniform", label: "Uniform", color: () => P.duo },
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "spherical", label: "Spherical", color: () => P.orange },
  { id: "vmf", label: "vMF", color: () => P.lime },
  { id: "simplex", label: "Simplex", color: () => P.pinkText, hi: true },
];

function DiversityInner({ kicker = "Figure 6" }) {
  const [m, setM] = useState("d2");
  const met = DIV_METRICS.find((x) => x.id === m);
  const W = 600, x0 = 92, x1 = W - 128, rowH = 30, top = 18;
  const vals = [...DIV_ROWS.flatMap((r) => DIV[r.id][m]), DIV_REF[m]];
  const pad = (Math.max(...vals) - Math.min(...vals)) * 0.08;
  const lo = Math.max(0, Math.min(...vals) - pad), hi = Math.max(...vals) + pad;
  const X = (v) => x0 + ((v - lo) / (hi - lo)) * (x1 - x0);
  const H = top + DIV_ROWS.length * rowH + 24;
  return (
    <Frame
      kicker={kicker}
      title="With self conditioning, simplex loses far more diversity than any other recipe"
      subtitle={`TinyStories samples from each model's untuned sampler. Each line runs from the value without self conditioning (open dot) to the value with it (filled dot). The dashed line marks real stories. Shown: ${met.long}.`}
      controls={<Pills value={m} onChange={setM} options={DIV_METRICS.map((x) => ({ id: x.id, label: x.label }))} />}
      note={<>4,096 stories per model (2,048 test prompts, two sampling seeds), one training seed per model. The other recipes lose some diversity too but end near real stories; simplex starts lowest and ends far below.</>}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", fontFamily: SANS, maxWidth: 680 }}>
        <line x1={X(DIV_REF[m])} y1={6} x2={X(DIV_REF[m])} y2={H - 20} stroke={P.muted} strokeDasharray="4 4" />
        <text x={X(DIV_REF[m])} y={H - 6} fontSize={10.5} fill={P.muted} fontFamily={FONT} textAnchor="middle">real stories {met.f(DIV_REF[m])}</text>
        {DIV_ROWS.map((r, i) => {
          const [a, b] = DIV[r.id][m], y = top + i * rowH + 6, c = r.color();
          return (
            <g key={r.id}>
              {r.hi && <rect x={0} y={y - 13} width={W} height={26} rx={6} fill={rgba(c, 0.10)} />}
              <text x={6} y={y + 4} fontSize={12.5} fontWeight={r.hi ? 700 : 500} fill={r.hi ? P.text : P.muted}>{r.label}</text>
              <line x1={X(a)} y1={y} x2={X(b)} y2={y} stroke={c} strokeWidth={r.hi ? 3 : 2} opacity={0.7} />
              <circle cx={X(a)} cy={y} r={5.5} fill={P.inset} stroke={c} strokeWidth={2}><title>{`${r.label} without SC: ${met.f(a)}`}</title></circle>
              <circle cx={X(b)} cy={y} r={5.5} fill={c}><title>{`${r.label} with SC: ${met.f(b)}`}</title></circle>
              <text x={W - 4} y={y + 4} fontSize={11} fill={r.hi ? P.text : P.dim2} fontFamily={FONT} textAnchor="end">{met.f(a)} → {met.f(b)}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

export const SimplexDiversity = withVizTheme(DiversityInner);

// ─── Sudoku hint ladder (Part 2) (src/data/sudoku_hint_ladder.json) ─────
// Built by scripts/build_sudoku_hint_ladder.py from 672 runs: 28 Part 2 Sudoku models,
// 4 samplers each (top 3 tuned Part 2 winners + untuned native), 6 hint levels.

const LADDER_GROUPS = {
  pure: [
    { d: "masked", c: null, label: "Masked", color: () => P.mdlm },
    { d: "uniform", c: null, label: "Uniform", color: () => P.duo },
    { d: null, c: "gaussian", label: "Gaussian", color: () => P.accent },
    { d: null, c: "spherical", label: "Spherical", color: () => P.orange },
    { d: null, c: "vmf", label: "vMF", color: () => P.lime },
    { d: null, c: "simplex", label: "Simplex", color: () => P.pinkText },
  ],
  masked: ["gaussian", "spherical", "vmf", "simplex"].map((c) => ({ d: "masked", c })),
  uniform: ["gaussian", "spherical", "vmf", "simplex"].map((c) => ({ d: "uniform", c })),
};
const CONT_STYLE = { gaussian: ["Gaussian", () => P.accent], spherical: ["Spherical", () => P.orange],
  vmf: ["vMF", () => P.lime], simplex: ["Simplex", () => P.pinkText] };
for (const g of ["masked", "uniform"]) {
  LADDER_GROUPS[g] = LADDER_GROUPS[g].map((r) => ({ ...r, label: `${g === "masked" ? "Masked" : "Uniform"} + ${CONT_STYLE[r.c][0]}`, color: CONT_STYLE[r.c][1] }));
}
const SAMPLER_LABEL = { native: "native", native_greedy: "native greedy", renoising: "renoising",
  renoising_greedy: "renoising greedy", eb_greedy: "EB greedy", eb_churn: "EB churn",
  psi_corruption: "Ψ (corruption clock)", psi_controller: "Ψ (controller clock)", native_untuned: "native, untuned" };

// Fixed color per sampler, so a sampler keeps its color across recipes.
const SAMPLER_COLOR = { native: () => P.accent, native_greedy: () => P.accentDim, renoising: () => P.duo,
  renoising_greedy: () => P.candi, eb_greedy: () => P.mdlm, eb_churn: () => P.orange,
  psi_corruption: () => P.lime, psi_controller: () => P.pinkText, native_untuned: () => P.muted };
const SAMPLER_SHORT = { native: "native", native_greedy: "native greedy", renoising: "renoising",
  renoising_greedy: "renoise greedy", eb_greedy: "EB greedy", eb_churn: "EB churn",
  psi_corruption: "Ψ corruption", psi_controller: "Ψ controller" };
const LADDER_RECIPES = [...LADDER_GROUPS.pure, ...LADDER_GROUPS.masked, ...LADDER_GROUPS.uniform];

function ladderPoint(row, arm, metric, kind, level) {
  const c = LADDER.cases.find((x) => x.disc === row.d && x.cont === row.c && x.arm === arm);
  const pool = c.samplers.filter((s) => (kind === "best" ? s.tuned : !s.tuned));
  const best = pool.reduce((a, s) => (s.levels[level][metric] > a.levels[level][metric] ? s : a), pool[0]);
  return { v: best.levels[level][metric], sampler: best.name };
}

function HintLadderInner({ kicker = "Figure · Sudoku hint ladder" }) {
  const [metric, setMetric] = useState("dv");
  const [arm, setArm] = useState("none");
  const [kind, setKind] = useState("best");
  const [group, setGroup] = useState("pure");
  const [view, setView] = useState("recipes");
  const [recipe, setRecipe] = useState(0);
  const [hover, setHover] = useState(null);
  const { hints, peeled } = LADDER.meta;
  const rows = LADDER_GROUPS[group];
  const picked = LADDER_RECIPES[recipe];
  const pickedCase = LADDER.cases.find((x) => x.disc === picked.d && x.cont === picked.c && x.arm === arm);
  const W = 600, x0 = 44, x1 = W - (view === "samplers" ? 132 : 118), yTop = 14, yBot = 214, stripY = 280, H = 314;
  const X = (i) => x0 + (i / (hints.length - 1)) * (x1 - x0);
  const Y = (v) => yBot - v * (yBot - yTop);
  const series = view === "recipes"
    ? rows.map((r) => ({ ...r, pts: hints.map((_, i) => ladderPoint(r, arm, metric, kind, i)) }))
    : pickedCase.samplers.map((sm) => ({
      label: sm.tuned ? `#${pickedCase.samplers.indexOf(sm) + 1} ${SAMPLER_SHORT[sm.name]}` : "untuned native",
      color: SAMPLER_COLOR[sm.name], dashed: !sm.tuned, val: sm.val,
      pts: sm.levels.map((l) => ({ v: l[metric], sampler: sm.name })),
    }));
  // direct labels at the right end, nudged apart so they do not overlap
  const ends = series.map((s) => ({ label: s.label, color: s.color(), y: Y(s.pts[s.pts.length - 1].v) }))
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 13);
  const mlabel = metric === "dv" ? "distinct and valid" : "valid";
  return (
    <Frame
      kicker={kicker}
      title="As hints are removed, Sudoku goes from redundant to synergistic, and the families split"
      subtitle={`Share of samples that are ${mlabel} solutions of the weakened puzzle${metric === "dv" ? ", counting each distinct board once" : ""}. Below the chart: share of blank cells that peeling (erasure-channel belief propagation) fills from the hints alone.`}
      controls={<>
        <Pills value={metric} onChange={setMetric} options={[{ id: "dv", label: "Distinct and valid" }, { id: "valid", label: "Valid" }]} />
        <Pills value={arm} onChange={setArm} options={[{ id: "none", label: "Without SC" }, { id: "sc", label: "With SC" }]} />
        <Pills value={view} onChange={setView} options={[{ id: "recipes", label: "Compare recipes" }, { id: "samplers", label: "Compare samplers" }]} />
        {view === "recipes" ? <>
          <Pills value={kind} onChange={setKind} options={[{ id: "best", label: "Best of top 3 tuned" }, { id: "base", label: "Untuned native" }]} />
          <Pills value={group} onChange={setGroup} options={[{ id: "pure", label: "Pure" }, { id: "masked", label: "Masked hybrids" }, { id: "uniform", label: "Uniform hybrids" }]} />
        </> : (
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 11.5, color: P.dim2 }}>
            recipe
            <select value={recipe} onChange={(e) => setRecipe(Number(e.target.value))} style={{
              fontFamily: FONT, fontSize: 12, color: P.text, background: P.inset, border: `1px solid ${P.line2}`,
              borderRadius: 999, padding: "5px 10px" }}>
              {LADDER_RECIPES.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}
            </select>
          </label>
        )}
      </>}
      note={<>The Sudoku models above, trained only on 30-hint puzzles, evaluated on the first 32 validation puzzles with nested subsets of their hints, 16 samples each, NFE 128; no retraining or retuning. "Best of top 3 tuned" takes, at each point, the best of the model's three best tuned samplers (hover for which). "Compare samplers" shows one model's samplers: #1 to #3 in the order of their 30-hint validation accuracy from the tuning, each at its tuned settings, and the native sampler untuned (dashed). Distinct counts are per puzzle out of 16; at 0 hints all puzzles are the same empty grid, so they are pooled over all 512 samples. At 30 hints each puzzle has one solution, so the distinct-and-valid ceiling is 1/16; from 23 hints down every puzzle has at least 16 solutions. One training seed per model; rates move by about ±0.05.</>}
    >
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", fontFamily: SANS, maxWidth: 680 }}>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={x0} x2={x1} y1={Y(t)} y2={Y(t)} stroke={P.grid} strokeWidth={1} />
            <text x={x0 - 8} y={Y(t) + 4} fontSize={11} fill={P.dim2} fontFamily={FONT} textAnchor="end">{t.toFixed(2)}</text>
          </g>
        ))}
        {hints.map((h, i) => (
          <text key={i} x={X(i)} y={yBot + 20} fontSize={11.5} fill={P.muted} fontFamily={FONT} textAnchor="middle">{h}</text>
        ))}
        <text x={(x0 + x1) / 2} y={yBot + 36} fontSize={11.5} fill={P.dim2} textAnchor="middle">hints kept (of 30)</text>
        {series.map((s) => {
          const c = s.color(), dim = hover && hover !== s.label;
          return (
            <g key={s.label} opacity={dim ? 0.18 : 1} onMouseEnter={() => setHover(s.label)} onMouseLeave={() => setHover(null)}>
              <polyline points={s.pts.map((p, i) => `${X(i)},${Y(p.v)}`).join(" ")} fill="none" stroke={c} strokeWidth={2} strokeLinejoin="round" strokeDasharray={s.dashed ? "5 4" : undefined} />
              {s.pts.map((p, i) => (
                <g key={i}>
                  <circle cx={X(i)} cy={Y(p.v)} r={4.5} fill={c} stroke={P.inset} strokeWidth={2} />
                  <circle cx={X(i)} cy={Y(p.v)} r={11} fill="transparent" style={{ cursor: "help" }}>
                    <title>{view === "recipes"
                      ? `${s.label}, ${arm === "sc" ? "with" : "without"} SC, ${hints[i]} hints: ${p.v.toFixed(2)} ${mlabel} (${SAMPLER_LABEL[p.sampler]})`
                      : `${picked.label}, ${arm === "sc" ? "with" : "without"} SC, ${SAMPLER_LABEL[p.sampler]}${s.val != null ? ` (30-hint validation accuracy ${s.val.toFixed(2)})` : ""}, ${hints[i]} hints: ${p.v.toFixed(2)} ${mlabel}`}</title>
                  </circle>
                </g>
              ))}
            </g>
          );
        })}
        {ends.map((e) => (
          <text key={e.label} x={x1 + 12} y={e.y + 4} fontSize={11.5} fill={P.text} opacity={hover && hover !== e.label ? 0.3 : 1}>
            <tspan fill={e.color}>● </tspan>{e.label}
          </text>
        ))}
        <text x={X(0) - 26} y={stripY - 7} fontSize={11} fill={P.dim2}>blank cells peeling fills from the hints</text>
        {hints.map((_, i) => {
          const v = peeled[i];
          return (
            <g key={i}>
              <rect x={X(i) - 26} y={stripY} width={52} height={14} rx={4} fill={P.inset} stroke={P.line2} />
              <rect x={X(i) - 26} y={stripY} width={Math.max(v * 52, v > 0 ? 3 : 0)} height={14} rx={4} fill={rgba(P.accent2, 0.75)} />
              <text x={X(i)} y={stripY + 28} fontSize={11} fill={P.muted} fontFamily={FONT} textAnchor="middle">{`${Math.round(v * 100)}%`}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

export const HintLadder = withVizTheme(HintLadderInner);
