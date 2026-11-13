// Self conditioning figures for Part 2, from the rerun protocol (eight samplers, two-stage
// validation selection, one test of the winner at NFE 128, plus every sampler's winner at
// NFE 512 on 128 test prompts) and the random-anchoring runs.
// Data: src/data/sc_rerun.json, built by build_data.py from rerun-20261110 (99 cases) and
// anchoring-20261111 (24 cases). Every panel is drawn at its real pixel width, so text
// keeps its size on a phone; panels stack when the figure is narrow.
import { useEffect, useRef, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import DATA from "../data/sc_rerun.json";
import ANCHOR_P from "../data/anchor_power.json";

const META = DATA.meta;
const CASES = DATA.cases;
const TK = META.tasks;
const TASKS = ["sudoku", "text8", "tinystories"];
const isMin = (t) => TK[t].dir === "min";
const MINUS = "−";
const sgn = (d, s) => `${d >= 0 ? "+" : MINUS}${s}`;

export const POL = {
  native: "native", native_greedy: "native greedy", renoising: "renoise", renoising_greedy: "renoise greedy",
  eb_greedy: "EB greedy", eb_churn: "EB churn", psi_corruption: "Ψ·c (corruption clock)", psi_controller: "Ψ·t (controller clock)", anchor_native: "anchor native", anchor_renoising: "anchor renoise",
};
const POL_SHORT = {
  native: "nat", native_greedy: "nat·g", renoising: "ren", renoising_greedy: "ren·g", eb_greedy: "EB·g", eb_churn: "EB·c",
  psi_corruption: "Ψ·c", psi_controller: "Ψ·t", anchor_native: "anc·n", anchor_renoising: "anc·r",
};
const CONT = [
  { id: "gaussian", label: "Gaussian" }, { id: "simplex", label: "Simplex" },
  { id: "spherical", label: "Spherical" }, { id: "vmf", label: "vMF" },
];
const CONT_COLOR = { gaussian: () => P.accent, simplex: () => P.warn, spherical: () => P.duo, vmf: () => P.pinkText };
const DISC = [{ id: "masked", label: "Masked" }, { id: "uniform", label: "Uniform" }];
const DISC_COLOR = { masked: () => P.mdlm, uniform: () => P.duo };
// Family colors used across the post: pure discrete red, pure continuous blue, hybrid purple.
export const FAMILY_COLOR = { discrete: () => P.mdlm, continuous: () => P.duo, hybrid: () => P.accent };
const label = (list, id) => list.find((m) => m.id === id)?.label ?? id;

export function find(q) {
  return CASES.find((c) => Object.entries(q).every(([k, v]) => (c[k] ?? null) === v));
}

export function caseLabel(c) {
  const sc = c.arm === "sc" ? " + SC" : c.arm === "depth" ? ", 16 layers" : "";
  if (c.family === "hybrid") return `${label(DISC, c.disc)} + ${label(CONT, c.cont)}${sc}`;
  if (c.family === "discrete") return `${label(DISC, c.disc)}${sc}`;
  return `${label(CONT, c.cont)}${sc}`;
}

// Test scores (Sudoku accuracy, text8 words, TinyStories SOL) and validation scores (TinyStories ref_w1).
export function fmt(task, v, split = "test") {
  if (v == null) return "–";
  if (task === "sudoku") return `${(v * 100).toFixed(1)}%`;
  if (task === "text8") return v.toFixed(2);
  return split === "test" ? v.toFixed(3) : v >= 100 ? v.toFixed(0) : v.toFixed(1);
}
function fmtD(task, d, split = "test") {
  if (task === "sudoku") return sgn(d, `${Math.abs(d * 100).toFixed(1)} pts`);
  if (task === "text8") return sgn(d, Math.abs(d).toFixed(2));
  return sgn(d, Math.abs(d).toFixed(split === "test" ? 3 : 1));
}
const metricName = (task, split = "test") =>
  task === "sudoku" ? "accuracy" : task === "text8" ? "valid words / sample" : split === "test" ? "SOL" : "ref_w1";
const dirWord = (task) => (isMin(task) ? "lower is better" : "higher is better");
// Positive = better, whatever the metric's direction.
const gain = (task, a, b) => (isMin(task) ? a - b : b - a);

// ─── Layout and interaction helpers ───────────────────────────────────────────
function useWidth(init = 320) {
  const ref = useRef(null);
  const [w, setW] = useState(init);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(180, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

export function useTip() {
  const box = useRef(null);
  const [tip, setTip] = useState(null);
  const show = (e, lines) => {
    if (!box.current) return;
    const r = box.current.getBoundingClientRect();
    setTip({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, lines });
  };
  const hide = () => setTip(null);
  const hit = (lines) => ({
    onMouseEnter: (e) => show(e, lines), onMouseMove: (e) => show(e, lines), onMouseLeave: hide,
    onClick: (e) => show(e, lines), onBlur: hide, tabIndex: 0, role: "img", "aria-label": lines.join(". "),
    onFocus: (e) => {
      const b = e.currentTarget.getBoundingClientRect();
      show({ clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }, lines);
    },
    style: { cursor: "pointer", outline: "none" },
  });
  const TW = 250;
  const el = tip && (
    <div style={{
      position: "absolute", zIndex: 5, pointerEvents: "none", maxWidth: TW,
      left: tip.x + 14 + TW < tip.w ? tip.x + 14 : Math.max(0, tip.x - 14 - TW), top: tip.y + 14,
      background: P.inset, color: P.text, border: `1px solid ${P.line2}`, borderRadius: 8, padding: "7px 10px",
      fontFamily: FONT, fontSize: 11.5, lineHeight: 1.5, boxShadow: `0 6px 18px rgba(${P.shadowRgb}, 0.35)`,
    }}>
      {tip.lines.map((l, i) => <div key={i} style={i ? { color: P.muted } : { fontWeight: 700 }}>{l}</div>)}
    </div>
  );
  return { box, hit, el, hide, show };
}

function niceTicks(lo, hi, n) {
  const step0 = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const e = step0 / mag;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
  const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step;
  const ticks = [];
  for (let v = a; v <= b + step * 1e-6; v += step) ticks.push(+v.toFixed(10));
  return { lo: a, hi: b, ticks };
}

function Shape({ shape, cx, cy, color, s = 5.5 }) {
  const ring = { stroke: P.bg, strokeWidth: 2, paintOrder: "stroke" };
  if (shape === "ring") return <circle cx={cx} cy={cy} r={s} fill={P.bg} stroke={color} strokeWidth={2.2} />;
  if (shape === "dot") return <circle cx={cx} cy={cy} r={s + 0.5} fill={color} {...ring} />;
  if (shape === "square") return <rect x={cx - s} y={cy - s} width={2 * s} height={2 * s} rx={1.5} fill={color} {...ring} />;
  if (shape === "diamond") {
    const d = s * 1.35;
    return <path d={`M${cx},${cy - d}L${cx + d},${cy}L${cx},${cy + d}L${cx - d},${cy}Z`} fill={color} {...ring} />;
  }
  if (shape === "triangle") {
    const d = s * 1.3;
    return <path d={`M${cx},${cy - d}L${cx + d},${cy + d * 0.75}L${cx - d},${cy + d * 0.75}Z`} fill={color} {...ring} />;
  }
  if (shape === "tick") return <line x1={cx} x2={cx} y1={cy - s - 1} y2={cy + s + 1} stroke={color} strokeWidth={2} />;
  return null;
}

export function Legend({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "4px 0 10px", fontFamily: FONT, fontSize: 11, color: P.muted }}>
      {items.map((it) => (
        <span key={it.label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={it.wide ? 26 : 16} height={16} style={{ overflow: "visible" }}>
            {it.line ? <line x1={0} x2={26} y1={8} y2={8} stroke={it.color} strokeWidth={2} strokeDasharray={it.dash} />
              : <Shape shape={it.shape} cx={8} cy={8} color={it.color} s={4.5} />}
          </svg>
          {it.label}
        </span>
      ))}
    </div>
  );
}

function Grid({ min = 240, children }) {
  return <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fit, minmax(${min}px, 1fr))`, gap: "18px 22px" }}>{children}</div>;
}

// A panel of labelled strips on one shared axis. Each row: a label line (with an optional
// note on the right, or under it when space is short) and up to `lanes` marks.
function StripPanel({ title, sub, rows, values, log = false, rev = false, tip, laneGap = 9, refs = [], axisLabel, zero = false, clamp = null }) {
  const [ref, w] = useWidth();
  const L = 6, R = 12;
  let lo, hi, ticks;
  const vs = values.filter((v) => v != null && Number.isFinite(v));
  if (log) {
    lo = 10 ** Math.floor(Math.log10(Math.min(...vs)));
    hi = 10 ** Math.ceil(Math.log10(Math.max(...vs)));
    ticks = [];
    for (let d = lo; d <= hi; d *= 10) for (const m of [1, 2, 5]) if (d * m <= hi) ticks.push(d * m);
    if (w < 300) ticks = ticks.filter((t) => [1, 5].some((m) => Math.abs(t / 10 ** Math.floor(Math.log10(t)) - m) < 1e-9));
  } else {
    let a = Math.min(...vs), b = Math.max(...vs);
    if (zero) { const m = Math.max(Math.abs(a), Math.abs(b)); a = -m; b = m; }
    const pad = (b - a) * 0.05 || 0.1;
    ({ lo, hi, ticks } = niceTicks(a - pad, b + pad, w < 300 ? 4 : 5));
    if (clamp) { lo = Math.max(lo, clamp[0]); hi = Math.min(hi, clamp[1]); ticks = ticks.filter((t) => t >= lo - 1e-9 && t <= hi + 1e-9); }
  }
  const f = log ? Math.log10 : (v) => v;
  const x = (v) => {
    let t = (f(v) - f(lo)) / (f(hi) - f(lo));
    t = Math.max(0, Math.min(1, t));
    if (rev) t = 1 - t;
    return L + t * (w - L - R);
  };
  const charW = 6.4;
  let y = 4;
  const laid = rows.map((r) => {
    if (r.header) { const o = { ...r, y, h: 22 }; y += 22; return o; }
    const lanes = r.lanes ?? 3;
    const wrap = r.note && (r.label.length * 7.2 + r.note.length * charW + 34 > w);
    const lh = wrap ? 30 : 17;
    const h = lh + (lanes - 1) * laneGap + 19;
    const o = { ...r, y, h, lh, lanes, wrap };
    y += h;
    return o;
  });
  const plotBottom = y + 2;
  const H = plotBottom + 34;
  return (
    <div ref={ref} style={{ minWidth: 0 }}>
      {title && <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.text }}>{title}</div>}
      {sub && <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.dim2, marginBottom: 2 }}>{sub}</div>}
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} style={{ display: "block", fontFamily: FONT, overflow: "visible" }}>
        {ticks.map((t) => (
          <line key={t} x1={x(t)} x2={x(t)} y1={0} y2={plotBottom} stroke={P.grid} strokeWidth={t === 0 && zero ? 1.2 : 0.6} />
        ))}
        {refs.map((r) => (
          <g key={r.label}>
            <line x1={x(r.v)} x2={x(r.v)} y1={0} y2={plotBottom} stroke={r.color || P.muted} strokeWidth={1.2} strokeDasharray="3 3" opacity={0.85} />
            <text x={x(r.v) + (r.anchor === "end" ? -4 : 4)} y={plotBottom - 4} fill={r.color || P.muted} fontSize={9.5} textAnchor={r.anchor || "start"}>{r.label}</text>
          </g>
        ))}
        {laid.map((r, ri) => {
          if (r.header) return (
            <g key={`h${ri}`}>
              <text x={L} y={r.y + 15} fill={r.color ? r.color() : P.dim2} fontSize={10} letterSpacing="0.08em" fontWeight={700}>{r.label.toUpperCase()}</text>
            </g>
          );
          const y0 = r.y + r.lh + 7;
          const laneY = (i) => y0 + i * laneGap;
          return (
            <g key={`r${ri}`}>
              {ri % 2 === 0 && <rect x={0} y={r.y} width={w} height={r.h} fill={rgba(P.panel, 0.45)} rx={6} />}
              {r.color && <circle cx={L + 4} cy={r.y + 11} r={4} fill={r.color()} />}
              <text x={L + (r.color ? 13 : 0)} y={r.y + 15} fill={P.text} fontSize={11.5} fontWeight={600}>{r.label}</text>
              {r.note && (
                <text x={r.wrap ? L + (r.color ? 13 : 0) : w - R} y={r.wrap ? r.y + 28 : r.y + 15} fontSize={10.5}
                  textAnchor={r.wrap ? "start" : "end"} fill={P.muted}>
                  {r.noteParts ? r.noteParts.map((p, i) => <tspan key={i} fill={p.color || P.muted} fontWeight={p.bold ? 700 : 400}>{p.text}</tspan>) : r.note}
                </text>
              )}
              {r.marks.map((m, mi) => m.v == null ? null : (
                <g key={mi} opacity={m.faded ? 0.45 : 1}>
                  {m.from != null && (
                    <line x1={x(m.from)} x2={x(m.v)} y1={laneY(m.lane)} y2={laneY(m.lane)} stroke={m.color} strokeWidth={1.2} opacity={0.35} />
                  )}
                </g>
              ))}
              {r.marks.map((m, mi) => m.v == null ? null : (
                <g key={`m${mi}`} {...(tip && m.tip ? tip.hit(m.tip) : {})} opacity={m.faded ? 0.45 : 1}>
                  <circle cx={x(m.v)} cy={laneY(m.lane)} r={11} fill="transparent" />
                  <Shape shape={m.shape} cx={x(m.v)} cy={laneY(m.lane)} color={m.color} s={m.size || 5} />
                  {m.off && <text x={x(m.v) + (x(m.v) > w / 2 ? -9 : 9)} y={laneY(m.lane) + 3.5} fontSize={9} fill={P.muted}
                    textAnchor={x(m.v) > w / 2 ? "end" : "start"}>{m.off}</text>}
                </g>
              ))}
            </g>
          );
        })}
        {ticks.map((t) => (
          <text key={t} x={x(t)} y={plotBottom + 13} fill={P.dim} fontSize={9.5} textAnchor="middle">
            {axisLabel?.tick ? axisLabel.tick(t) : t}
          </text>
        ))}
        {axisLabel && (
          <text x={w - R} y={plotBottom + 29} fill={P.muted} fontSize={10} textAnchor="end">{axisLabel.text}  better →</text>
        )}
      </svg>
    </div>
  );
}

const tickFor = (task, split = "test") => (v) => task === "sudoku" ? `${Math.round(v * 100)}%` : split === "val" && task === "tinystories" ? `${v}` : `${+v.toFixed(2)}`;
const taskTitle = (t, split = "test") => `${TK[t].label} · ${metricName(t, split)}`;

// Colors that say whether a gap clears the noise level: better (green), worse (red) or neither.
function gapColor(task, g, noise) {
  if (g > noise) return P.good;
  if (g < -noise) return P.bad;
  return P.muted;
}
const ivNoOverlap = (a, b) => a.lo != null && b.lo != null && (a.hi < b.lo || b.hi < a.lo);

const TASK_OPTS = TASKS.map((t) => ({ id: t, label: TK[t].label }));
const ARM_OPTS = [{ id: "all", label: "All" }, { id: "none", label: "No SC" }, { id: "sc", label: "SC" }];
const FAM_OPTS = [{ id: "all", label: "All" }, { id: "continuous", label: "Continuous" }, { id: "discrete", label: "Discrete" }, { id: "hybrid", label: "Hybrid" }];
const ok = (sel, v) => sel === "all" || sel === v;
// A task being re-tuned: its tuning-dependent numbers are hidden until the new results land.
const pending = (t) => !!TK[t]?.pending;
function Pending({ task }) {
  return (
    <div style={{ fontFamily: FONT, fontSize: 12, color: P.muted, border: `1px dashed ${P.line2}`, borderRadius: 6, padding: "28px 16px", textAlign: "center", lineHeight: 1.6 }}>
      <div style={{ fontSize: 22, color: P.dim2, fontWeight: 700 }}>--</div>
      {TK[task].label}: being re-tuned with MAUVE. Results will appear here when the re-tune finishes.
    </div>
  );
}

// ─── Figure A: SC or depth ────────────────────────────────────────────────────
const ARM3 = {
  none: { label: "8 layers", shape: "ring", color: () => P.dim2, lane: 1 },
  depth: { label: "16 layers", shape: "diamond", color: () => P.highlight, lane: 0 },
  sc: { label: "8 layers + SC", shape: "dot", color: () => P.candi, lane: 2 },
};

function ScVsDepthInner() {
  const [mode, setMode] = useState("test");
  const [task, setTask] = useState("sudoku");
  const [cmp, setCmp] = useState("all");
  const arms = cmp === "all" ? ["depth", "none", "sc"] : ["none", cmp];
  const tip = useTip();
  const split = mode === "test" ? "test" : "val";
  const methods = [
    { q: { family: "continuous", cont: "gaussian" }, label: "Gaussian", color: CONT_COLOR.gaussian },
    { q: { family: "discrete", disc: "masked" }, label: "Masked", color: DISC_COLOR.masked },
    { q: { family: "discrete", disc: "uniform" }, label: "Uniform", color: DISC_COLOR.uniform },
  ];
  return (
    <Frame
      kicker="Figure A · self conditioning or depth"
      title="Does SC buy what doubling the depth buys?"
      subtitle="Each row is one corruption type on one task: the 8-layer model, the same model with SC, and a 16-layer model without SC. Every axis points right for better."
      controls={<>
        <Pills value={task} onChange={setTask} options={TASK_OPTS} />
        <Pills value={cmp} onChange={setCmp} options={[{ id: "all", label: "All three" }, { id: "sc", label: "8L vs SC" }, { id: "depth", label: "8L vs 16L" }]} />
        <Pills value={mode} onChange={setMode} options={[
          { id: "test", label: "Test score" }, { id: "native", label: "Native sampler (val)" },
        ]} />
      </>}
      note={mode === "test"
        ? `Test score of each model's validation-selected sampler at 128 network calls (Sudoku: 976 puzzles; text8 and TinyStories: 2,048 prompts; two sampling seeds). Labels on the right: change over the 8-layer model, green or red when it is larger than the noise level for one training seed (${TK.sudoku.noise * 100} pts, ${TK.text8.noise} words, ${TK.tinystories.noise} SOL). Gaussian models use 512-dimensional embeddings.`
        : "Stage-2 validation score (256 prompts) of each model's best native-sampler setting. Hover a mark for its 95% bootstrap interval. TinyStories is in ref_w1 here, the metric samplers are tuned on (lower is better, so its axis is flipped). Labels: change over the 8-layer model, colored when the two models' intervals do not overlap."}
    >
      {pending(task) ? <Pending task={task} /> : <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[
          { shape: "ring", color: P.dim2, label: "8 layers" },
          ...(arms.includes("sc") ? [{ shape: "dot", color: P.candi, label: "8 layers + SC" }] : []),
          ...(arms.includes("depth") ? [{ shape: "diamond", color: P.highlight, label: "16 layers" }] : []),
        ]} />
        <Grid min={250}>
          {[task].map((t) => {
            const vals = [];
            const rows = methods.map((m) => {
              const get = (arm) => find({ task: t, ...m.q, arm });
              const sc = (c) => (mode === "test" ? { v: c.test } : c.pol.native);
              const base = sc(get("none"));
              const marks = arms.map((arm) => {
                const c = get(arm), s = sc(c), a = ARM3[arm];
                vals.push(s.v); if (arm === "none" && mode !== "test") vals.push(s.lo, s.hi);
                const tipL = [`${m.label} · ${a.label}`, `${metricName(t, split)}: ${fmt(t, s.v, split)}`];
                if (mode === "test") {
                  tipL.push(`sampler: ${POL[c.selected]}`, `two seeds: ${(c.test_seeds ? c.test_seeds.map((v) => fmt(t, v)).join(" / ") : "test pending")}`);
                  if (arm !== "none") tipL.push(`vs 8 layers: ${fmtD(t, s.v - base.v)}`);
                } else {
                  tipL.push(`95% interval: ${fmt(t, s.lo, split)} to ${fmt(t, s.hi, split)}`);
                }
                return { shape: a.shape, color: a.color(), lane: a.lane, v: s.v, tip: tipL, from: arm === "none" ? null : base.v };
              });
              const parts = [];
              for (const arm of ["sc", "depth"].filter((a) => arms.includes(a))) {
                const s = sc(get(arm));
                const g = gain(t, base.v, s.v);
                const col = mode === "test" ? gapColor(t, g, TK[t].noise) : ivNoOverlap(s, base) ? (g > 0 ? P.good : P.bad) : P.muted;
                parts.push({ text: arm === "sc" ? "SC " : "  16L ", color: P.dim2 }, { text: fmtD(t, s.v - base.v, split), color: col, bold: true });
              }
              return {
                label: m.label, color: m.color, lanes: arms.length, marks: marks.map((k) => ({ ...k, lane: arms.length === 3 ? k.lane : k.lane === 1 ? 0 : 1 })), noteParts: parts, note: parts.map((p) => p.text).join(""),
              };
            });
            return (
              <StripPanel key={t} clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t, split)} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)}
                axisLabel={{ text: metricName(t, split), tick: tickFor(t, split) }}
                refs={t === "text8" && mode === "test" ? [{ v: TK.text8.heldout, label: "real text", anchor: "end" }] : []} />
            );
          })}
        </Grid>
        {tip.el}
      </div>}
    </Frame>
  );
}

// ─── Figure B: the sampler landscape ──────────────────────────────────────────
const LAND_GROUPS = [
  { label: "Pure continuous", rows: [
    ...CONT.flatMap((m) => ["none", "sc"].map((arm) => ({ family: "continuous", cont: m.id, arm })))] },
  { label: "Pure discrete", rows: DISC.flatMap((m) => ["none", "sc"].map((arm) => ({ family: "discrete", disc: m.id, arm }))) },
  { label: "Hybrid · masked view", rows: CONT.flatMap((m) => ["none", "sc"].map((arm) => ({ family: "hybrid", disc: "masked", cont: m.id, arm }))) },
  { label: "Hybrid · uniform view", rows: CONT.flatMap((m) => ["none", "sc"].map((arm) => ({ family: "hybrid", disc: "uniform", cont: m.id, arm }))) },
];
const BINS = [
  { id: "best", label: "best", s: 1 },
  { id: "tie", label: "inside best's 95% interval", s: 0.78 },
  { id: "q90", label: "≥ 90% of best", s: 0.52 },
  { id: "q75", label: "75–90%", s: 0.32 },
  { id: "q50", label: "50–75%", s: 0.17 },
  { id: "low", label: "< 50%", s: 0.06 },
];
const GROUP_FAM = { "Pure continuous": "continuous", "Pure discrete": "discrete", "Hybrid · masked view": "hybrid", "Hybrid · uniform view": "hybrid" };
const filteredGroups = (fam, arm) => LAND_GROUPS.filter((g) => ok(fam, GROUP_FAM[g.label]))
  .map((g) => ({ ...g, rows: g.rows.filter((q) => ok(arm, q.arm)) })).filter((g) => g.rows.length);

function binOf(task, v, best) {
  if (v === best.v) return BINS[0];
  if (best.lo != null && v >= best.lo && v <= best.hi) return BINS[1];
  const q = isMin(task) ? best.v / v : v / best.v;
  return q >= 0.9 ? BINS[2] : q >= 0.75 ? BINS[3] : q >= 0.5 ? BINS[4] : BINS[5];
}
function mix(a, b, s) {
  const p = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * s)).join(",")})`;
}

function LandscapeInner() {
  const [task, setTask] = useState("text8");
  const [fam, setFam] = useState("continuous");
  const [arm, setArm] = useState("all");
  const groups = filteredGroups(fam, arm);
  const [ref, w] = useWidth(680);
  const tip = useTip();
  const cols = [...META.policies, ...META.anchor_policies];
  const narrow = w < 560;
  const all = groups.flatMap((g) => g.rows.map((q) => find({ task, ...q })));
  const picks = Object.fromEntries(cols.map((p) => [p, all.filter((c) => c.selected === p).length]));
  const cell = { padding: 0, height: narrow ? 20 : 22, textAlign: "center", fontSize: narrow ? 9.5 : 10.5, fontVariantNumeric: "tabular-nums" };
  const rowLabel = (c) => {
    const arm = c.arm === "sc" ? "SC" : c.arm === "depth" ? "16L" : "no SC";
    const name = c.family === "hybrid" ? `+ ${label(CONT, c.cont)}` : label(c.family === "discrete" ? DISC : CONT, c.family === "discrete" ? c.disc : c.cont);
    return { name, arm };
  };
  return (
    <Frame
      kicker="Figure C · the sampler landscape"
      title="Which samplers work for which model?"
      subtitle="One row per model, one column per sampler. Darker cells come closer to the best sampler for that model. The outlined cell is the one validation selected."
      controls={<>
        <Pills value={task} onChange={setTask} options={TASK_OPTS} />
        <Pills value={fam} onChange={setFam} options={FAM_OPTS} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS} />
      </>}
      note={`Stage-2 validation score (256 prompts, NFE 128) of each sampler's best setting, compared within the row: ${task === "tinystories" ? "ref_w1, lower is better, so the share is best ÷ score" : task === "sudoku" ? "accuracy, higher is better, share = score ÷ best" : "valid words per sample, higher is better, share = score ÷ best"}. "Inside best's 95% interval" means the bootstrap interval of the row's best sampler contains this score. The two anchoring samplers apply only to the pure continuous models (from a separate run with the same prompts and seeds); they were never better than the best of the other samplers, so they never change a selection. Ψ·c: Ψ on the corruption clock; Ψ·t: Ψ on the controller clock. ${narrow ? "Tap a cell for its value." : "Hover a cell for its interval and the NFE 512 check."}`}
    >
      {pending(task) ? <Pending task={task} /> : <div ref={tip.box} style={{ position: "relative" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 12px", margin: "2px 0 10px", fontFamily: FONT, fontSize: 10.5, color: P.muted }}>
          {BINS.map((b) => (
            <span key={b.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 14, height: 12, borderRadius: 3, background: mix(P.bg, P.accent, b.s), boxShadow: b.id === "best" ? `inset 0 0 0 1px ${P.line2}` : "none" }} />{b.label}
            </span>
          ))}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <span style={{ width: 14, height: 12, borderRadius: 3, boxShadow: `inset 0 0 0 2px ${P.text}` }} />selected
          </span>
        </div>
        <div ref={ref}>
          {/* display/boxShadow/borderRadius override post.css's `.prose table` (display: block breaks fixed layout) */}
          <table style={{ display: "table", boxShadow: "none", borderRadius: 0, width: "100%", borderCollapse: "separate", borderSpacing: 2, tableLayout: "fixed", fontFamily: FONT, margin: 0 }}>
            <colgroup>
              <col style={{ width: narrow ? 92 : 150 }} />
              {cols.map((p) => <col key={p} style={{ width: p.startsWith("anchor") ? (narrow ? "8%" : "9%") : undefined }} />)}
            </colgroup>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 9.5, color: P.dim2, fontWeight: 400, padding: "0 0 2px" }}>{narrow ? "" : "picked in"}</th>
                {cols.map((p) => (
                  <th key={p} style={{ fontSize: 9.5, color: picks[p] ? P.text : P.dim, fontWeight: 600, padding: "0 0 2px", textAlign: "center" }}>
                    {picks[p] || "·"}
                  </th>
                ))}
              </tr>
              <tr>
                <th />
                {cols.map((p) => (
                  <th key={p} style={{ fontSize: narrow ? 9 : 10, color: P.muted, fontWeight: 600, padding: "0 0 4px", textAlign: "center", whiteSpace: "nowrap", overflow: "hidden", borderBottom: `1px solid ${P.line}` }}>
                    {narrow || p.startsWith("psi") ? POL_SHORT[p] : POL[p].replace("renoise greedy", "ren. greedy").replace("native greedy", "nat. greedy").replace("anchor renoise", "anch. ren.").replace("anchor native", "anch. nat.")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => [
                <tr key={g.label}>
                  <td colSpan={cols.length + 1} style={{ fontSize: 9.5, letterSpacing: "0.08em", color: P.dim2, fontWeight: 700, padding: "8px 0 2px", textTransform: "uppercase" }}>{g.label}</td>
                </tr>,
                ...g.rows.map((q) => {
                  const c = find({ task, ...q });
                  const best = c.pol[c.selected];
                  const { name, arm } = rowLabel(c);
                  const tone = c.family === "hybrid" ? CONT_COLOR[c.cont] : c.family === "discrete" ? DISC_COLOR[c.disc] : CONT_COLOR[c.cont];
                  return (
                    <tr key={c.id}>
                      <td style={{ fontSize: narrow ? 10 : 11, color: P.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", paddingRight: 4 }}>
                        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: tone(), marginRight: 5, verticalAlign: "middle" }} />
                        {name} <span style={{ color: arm === "SC" ? P.candi : arm === "16L" ? P.highlight : P.dim2 }}>{arm}</span>
                      </td>
                      {cols.map((p) => {
                        const s = c.pol[p];
                        if (!s) return <td key={p} style={{ ...cell, color: P.faint }}>–</td>;
                        const b = binOf(task, s.v, best);
                        const bg = mix(P.bg, P.accent, b.s);
                        const sel = c.selected === p;
                        const dark = b.s >= 0.5;
                        const lines = [`${caseLabel(c)} · ${POL[p]}`,
                          `validation ${metricName(task, "val")}: ${fmt(task, s.v, "val")}${s.lo != null ? ` (${fmt(task, s.lo, "val")} to ${fmt(task, s.hi, "val")})` : ""}`,
                          sel ? `selected · test ${metricName(task)} ${fmt(task, c.test)}` : `best here: ${POL[c.selected]} ${fmt(task, best.v, "val")}`,
                          b.label === "best" ? "the row's best" : `${b.label}`];
                        if (s.n512 != null) lines.push(`NFE 512, 128 test prompts: ${fmt(task, s.n512)}`);
                        if (p.startsWith("anchor") && c.anchor?.status === "test_pending") lines.push("anchoring: validation done, test still running");
                        return (
                          <td key={p} {...tip.hit(lines)} style={{ ...cell, ...tip.hit(lines).style, background: bg, borderRadius: 4,
                            color: dark ? P.bg : P.muted, boxShadow: sel ? `inset 0 0 0 2px ${P.text}` : "none", fontWeight: sel ? 700 : 400 }}>
                            {narrow ? "" : task === "sudoku" ? (s.v * 100).toFixed(0) : s.v >= 100 ? s.v.toFixed(0) : s.v.toFixed(1)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                }),
              ])}
            </tbody>
          </table>
        </div>
        {narrow && (
          <div style={{ fontFamily: FONT, fontSize: 10, color: P.dim2, marginTop: 8, lineHeight: 1.6 }}>
            {[...META.policies, ...META.anchor_policies].map((p) => `${POL_SHORT[p]} = ${POL[p]}`).join(" · ")}
          </div>
        )}
        {tip.el}
      </div>}
    </Frame>
  );
}

// ─── Figure C: anchoring needs SC ─────────────────────────────────────────────
const OTHER5 = ["native", "native_greedy", "renoising", "renoising_greedy", "psi_corruption", "psi_controller"];
const bestOf = (task, c, ps) => ps.filter((p) => c.pol[p]).reduce((a, p) => (!a || (isMin(task) ? c.pol[p].v < c.pol[a].v : c.pol[p].v > c.pol[a].v) ? p : a), null);

function AnchoringInner() {
  const tip = useTip();
  const [kind, setKind] = useState("both");
  const [task, setTask] = useState("sudoku");
  const [arm, setArm] = useState("all");
  return (
    <Frame
      kicker="Figure E · anchoring and SC"
      title="Can a continuous model commit tokens, and does it need SC to?"
      subtitle="For each continuous model: the best sampler that never commits positions (ring), the better of the two entropy-bounded samplers (EB, which commit the positions the model is surest about), the better random-anchoring sampler (commits random positions on a schedule), and the untuned native sampler (diamond)."
      controls={<>
        <Pills value={task} onChange={setTask} options={TASK_OPTS} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS.map((o) => (o.id === "all" ? { ...o, label: "SC and no SC" } : o))} />
        <Pills value={kind} onChange={setKind} options={[{ id: "both", label: "Both kinds" }, { id: "eb", label: "EB only" }, { id: "anchor", label: "Random only" }]} />
      </>}
      note="Stage-2 validation scores (256 prompts, NFE 128); hover a mark for its 95% bootstrap interval. TinyStories is in ref_w1 on a log axis (lower is better, so the axis is flipped). Diamond: the untuned native sampler (temperature 1, no search) on the same prompts. Labels on the right: each committing sampler's gap to the ring, green or red when it clears the ring's interval; then random anchoring's gap to the untuned sampler, green or red when it clears the untuned sampler's interval."
    >
      {pending(task) ? <Pending task={task} /> : <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[
          { shape: "diamond", color: P.text, label: "untuned native (T = 1)" },
          { shape: "ring", color: P.muted, label: "best non-committing sampler" },
          ...(kind !== "anchor" ? [{ shape: "triangle", color: P.highlight, label: "EB (greedy or churn)" }] : []),
          ...(kind !== "eb" ? [{ shape: "square", color: P.accent, label: "random anchoring" }] : []),
        ]} />
        <Grid min={250}>
          {[task].map((t) => {
            const vals = [];
            const rows = [];
            for (const m of CONT) {
              rows.push({ header: true, label: m.label, color: CONT_COLOR[m.id] });
              for (const armId of ["none", "sc"].filter((x) => ok(arm, x))) {
                const c = find({ task: t, family: "continuous", cont: m.id, arm: armId });
                const po = bestOf(t, c, OTHER5), pe = bestOf(t, c, ["eb_greedy", "eb_churn"]), pa = bestOf(t, c, META.anchor_policies);
                const o = c.pol[po], e = c.pol[pe], a = c.pol[pa];
                vals.push(o.v, o.lo, o.hi, e.v, a.v);
                const u = c.base;
                if (u) vals.push(u.v, u.lo, u.hi);
                const marks = [{ shape: "ring", color: P.muted, lane: 1, v: o.v,
                  tip: [`${caseLabel(c)} · ${POL[po]}`, `best non-committing sampler: ${fmt(t, o.v, "val")}`, `95% interval: ${fmt(t, o.lo, "val")} to ${fmt(t, o.hi, "val")}`] }];
                const parts = [];
                const add = (shape, color, lane, p, s, name) => {
                  const g = gain(t, o.v, s.v);
                  const clear = isMin(t) ? (s.v < o.lo ? 1 : s.v > o.hi ? -1 : 0) : (s.v > o.hi ? 1 : s.v < o.lo ? -1 : 0);
                  marks.push({ shape, color, lane, v: s.v, from: o.v, tip: [`${caseLabel(c)} · ${POL[p]}`, `${metricName(t, "val")}: ${fmt(t, s.v, "val")}`, `95% interval: ${fmt(t, s.lo, "val")} to ${fmt(t, s.hi, "val")}`, `vs ring: ${fmtD(t, s.v - o.v, "val")}`, ...(p.startsWith("anchor") && c.anchor.status !== "done" ? ["test still running"] : [])] });
                  parts.push({ text: `${name} `, color: P.dim2 }, { text: isMin(t) && Math.abs(s.v - o.v) > 50 ? `${(s.v / o.v).toFixed(0)}× worse` : fmtD(t, s.v - o.v, "val"), color: clear > 0 ? P.good : clear < 0 ? P.bad : P.muted, bold: true }, { text: "  " });
                  return g;
                };
                if (kind !== "anchor") add("triangle", P.highlight, 2, pe, e, "EB");
                if (kind !== "eb") add("square", P.accent, kind === "both" ? 3 : 2, pa, a, "rand");
                if (u) {
                  marks.unshift({ shape: "diamond", color: P.text, lane: 0, v: u.v,
                    tip: [`${caseLabel(c)} · untuned native (T = 1)`, `${metricName(t, "val")}: ${fmt(t, u.v, "val")}`, `95% interval: ${fmt(t, u.lo, "val")} to ${fmt(t, u.hi, "val")}`] });
                  if (kind !== "eb") {
                    const clear = isMin(t) ? (a.v < u.lo ? 1 : a.v > u.hi ? -1 : 0) : (a.v > u.hi ? 1 : a.v < u.lo ? -1 : 0);
                    parts.push({ text: "rand vs untuned ", color: P.dim2 }, { text: isMin(t) && Math.abs(a.v - u.v) > 50 ? `${(a.v / u.v).toFixed(0)}× worse` : fmtD(t, a.v - u.v, "val"), color: clear > 0 ? P.good : clear < 0 ? P.bad : P.muted, bold: true });
                  }
                }
                rows.push({ label: armId === "sc" ? "SC" : "no SC", lanes: kind === "both" ? 4 : 3, marks, noteParts: parts, note: parts.map((p) => p.text).join("") });
              }
            }
            return (
              <StripPanel key={t} clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t, "val")} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)} log={t === "tinystories"} laneGap={8}
                axisLabel={{ text: metricName(t, "val"), tick: tickFor(t, "val") }} />
            );
          })}
        </Grid>
        {tip.el}
      </div>}
    </Frame>
  );
}

// ─── Figure D: SC across continuous methods ───────────────────────────────────
function SamplerTag(c) { return POL[c.selected]; }

function ContinuousInner() {
  const tip = useTip();
  const [task, setTask] = useState("sudoku");
  return (
    <Frame
      kicker="Figure F · SC across continuous methods"
      title="Does SC help every continuous method?"
      subtitle="Grey ring: no SC. Green dot: with SC. Same 8-layer backbone and learned clock; each model uses its own validation-selected sampler. Dashed lines: the 8-layer masked and uniform models, for scale."
      controls={<Pills value={task} onChange={setTask} options={TASK_OPTS} />}
      note={`Test scores at 128 network calls (Sudoku 976 puzzles, text and stories 2,048 prompts, two sampling seeds). Labels: change from SC, green or red when it is larger than the noise level for one training seed (${TK.sudoku.noise * 100} pts, ${TK.text8.noise} words, ${TK.tinystories.noise} SOL), then the sampler each model selected.`}
    >
      {pending(task) ? <Pending task={task} /> : <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[
          { shape: "ring", color: P.dim2, label: "no SC" }, { shape: "dot", color: P.candi, label: "SC" }, { line: true, color: P.muted, dash: "3 3", label: "masked / uniform, 8 layers" },
        ]} />
        <Grid min={250}>
          {[task].map((t) => {
            const vals = [];
            const rows = CONT.map((m) => {
              const a = find({ task: t, family: "continuous", cont: m.id, arm: "none" });
              const b = find({ task: t, family: "continuous", cont: m.id, arm: "sc" });
              vals.push(a.test, b.test);
              const g = gain(t, a.test, b.test);
              const mk = (c, shape, color, lane) => ({ shape, color, lane, v: c.test, from: c === b ? a.test : null,
                tip: [caseLabel(c), `${metricName(t)}: ${fmt(t, c.test)}`, `sampler: ${SamplerTag(c)}`, `two seeds: ${(c.test_seeds ? c.test_seeds.map((v) => fmt(t, v)).join(" / ") : "test pending")}`] });
              const parts = [{ text: fmtD(t, b.test - a.test), color: gapColor(t, g, TK[t].noise), bold: true },
                { text: `  ${POL_SHORT[a.selected]} → ${POL_SHORT[b.selected]}`, color: P.dim2 }];
              return { label: m.label, color: CONT_COLOR[m.id], lanes: 2, marks: [mk(a, "ring", P.dim2, 0), mk(b, "dot", P.candi, 1)], noteParts: parts, note: parts.map((p) => p.text).join("") };
            });
            const refs = DISC.map((d) => {
              const c = find({ task: t, family: "discrete", disc: d.id, arm: "none" });
              vals.push(c.test);
              return { v: c.test, label: d.label.toLowerCase(), color: DISC_COLOR[d.id]() };
            });
            refs.sort((p, q) => p.v - q.v);
            refs[0].anchor = isMin(t) ? "start" : "end";
            refs[1].anchor = isMin(t) ? "end" : "start";
            return (
              <StripPanel key={t} clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t)} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)} refs={refs}
                axisLabel={{ text: metricName(t), tick: tickFor(t) }} />
            );
          })}
        </Grid>
        {tip.el}
      </div>}
    </Frame>
  );
}

// ─── Figure E: hybrids and SC ─────────────────────────────────────────────────
function HybridInner() {
  const tip = useTip();
  const [task, setTask] = useState("sudoku");
  const [view, setView] = useState("masked");
  const [arm, setArm] = useState("all");
  return (
    <Frame
      kicker="Figure G · hybrids and SC"
      title="What does SC do once a discrete view is added?"
      subtitle="Each hybrid pairs one continuous method with a masked or a uniform view. Grey ring: no SC. Green dot: SC. The first row of each group is the discrete model alone; the last group is the continuous model alone."
      controls={<>
        <Pills value={task} onChange={setTask} options={TASK_OPTS} />
        <Pills value={view} onChange={setView} options={[{ id: "masked", label: "Masked view" }, { id: "uniform", label: "Uniform view" }, { id: "none", label: "Pure continuous" }, { id: "all", label: "All" }]} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS.map((o) => (o.id === "all" ? { ...o, label: "SC and no SC" } : o))} />
      </>}
      note={`Test scores at 128 network calls, each model with its validation-selected sampler. Labels: change from SC, green or red when it is larger than the noise level for one training seed (${TK.sudoku.noise * 100} pts, ${TK.text8.noise} words, ${TK.tinystories.noise} SOL). On text8, the dashed line is held-out real text (${TK.text8.heldout.toFixed(1)} words); scores past it reward diversity past fluency. Gaussian hybrids use 512-dimensional embeddings.`}
    >
      {pending(task) ? <Pending task={task} /> : <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[...(arm !== "sc" ? [{ shape: "ring", color: P.dim2, label: "no SC" }] : []), ...(arm !== "none" ? [{ shape: "dot", color: P.candi, label: "SC" }] : []), ]} />
        <Grid min={250}>
          {[task].map((t) => {
            const vals = [];
            const pair = (q, name, color) => {
              const a = find({ task: t, ...q, arm: "none" }), b = find({ task: t, ...q, arm: "sc" });
              vals.push(a.test, b.test);
              const g = gain(t, a.test, b.test);
              const mk = (c, shape, col, lane) => ({ shape, color: col, lane, v: c.test, from: c === b ? a.test : null,
                tip: [caseLabel(c), `${metricName(t)}: ${fmt(t, c.test)}`, `sampler: ${POL[c.selected]}`, `two seeds: ${(c.test_seeds ? c.test_seeds.map((v) => fmt(t, v)).join(" / ") : "test pending")}`] });
              const parts = arm === "all" ? [{ text: "SC ", color: P.dim2 }, { text: fmtD(t, b.test - a.test), color: gapColor(t, g, TK[t].noise), bold: true }]
                : [{ text: POL[(arm === "sc" ? b : a).selected], color: P.dim2 }];
              const marks = arm === "all" ? [mk(a, "ring", P.dim2, 0), mk(b, "dot", P.candi, 1)]
                : arm === "none" ? [{ ...mk(a, "ring", P.dim2, 0) }] : [{ ...mk(b, "dot", P.candi, 0), from: null }];
              return { label: name, color, lanes: arm === "all" ? 2 : 1, marks,
                noteParts: parts, note: parts.map((p) => p.text).join("") };
            };
            const rows = [];
            for (const d of DISC.filter((x) => view === "all" || view === x.id)) {
              rows.push({ header: true, label: `${d.label} view`, color: DISC_COLOR[d.id] });
              rows.push(pair({ family: "discrete", disc: d.id }, `${d.label.toLowerCase()} alone`, null));
              for (const m of CONT) rows.push(pair({ family: "hybrid", disc: d.id, cont: m.id }, `+ ${m.label}`, CONT_COLOR[m.id]));
            }
            if (view === "all" || view === "none") {
              rows.push({ header: true, label: "No discrete view" });
              for (const m of CONT) rows.push(pair({ family: "continuous", cont: m.id }, m.label, CONT_COLOR[m.id]));
            }
            return (
              <StripPanel key={t} clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t)} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)} laneGap={8}
                axisLabel={{ text: metricName(t), tick: tickFor(t) }}
                refs={t === "text8" ? [{ v: TK.text8.heldout, label: "real text", anchor: "end" }] : []} />
            );
          })}
        </Grid>
        {tip.el}
      </div>}
    </Frame>
  );
}

// ─── Figure D: how much the sampler matters ───────────────────────────────────
function SpreadInner() {
  const tip = useTip();
  const [task, setTask] = useState("text8");
  const [fam, setFam] = useState("continuous");
  const [arm, setArm] = useState("all");
  const groups = filteredGroups(fam, arm);
  const t = task;
  const better = (a, b) => (isMin(t) ? a < b : a > b);
  const vals = [];
  const rows = [];
  const gaps = [];
  for (const g of groups) {
    if (groups.length > 1) rows.push({ header: true, label: g.label });
    for (const q of g.rows) {
      const c = find({ task: t, ...q });
      const ps = Object.keys(c.pol);
      const best = ps.reduce((a, p) => (better(c.pol[p].v, c.pol[a].v) ? p : a));
      const worst = ps.reduce((a, p) => (better(c.pol[a].v, c.pol[p].v) ? p : a));
      const bv = c.pol[best].v, wv = c.pol[worst].v, nv = c.pol.native.v;
      gaps.push({ bw: Math.abs(bv - wv), bn: Math.abs(bv - nv), c });
      const marks = ps.map((p) => {
        const s = c.pol[p];
        vals.push(s.v);
        const role = p === best ? "best" : p === worst ? "worst" : p === "native" ? "native" : "other";
        return {
          shape: role === "native" ? "ring" : "dot", lane: 0, v: s.v, size: role === "other" ? 3.5 : 5,
          color: role === "best" ? P.good : role === "worst" ? P.bad : role === "native" ? P.text : P.dim2,
          tip: [`${caseLabel(c)} · ${POL[p]}`, `validation ${metricName(t, "val")}: ${fmt(t, s.v, "val")}`,
            `95% interval: ${fmt(t, s.lo, "val")} to ${fmt(t, s.hi, "val")}`, role === "best" ? "best sampler" : role === "worst" ? "worst sampler" : `best is ${POL[best]}: ${fmt(t, bv, "val")}`],
        };
      });
      marks.unshift({ shape: "tick", lane: 0, v: wv, color: P.faint, from: bv, size: 0.1 });
      if (c.base) {
        vals.push(c.base.v);
        gaps[gaps.length - 1].bu = Math.abs(bv - c.base.v);
        marks.push({ shape: "square", lane: 0, v: c.base.v, size: 4.5, color: P.highlight,
          tip: [`${caseLabel(c)} · untuned native (T = 1)`, `validation ${metricName(t, "val")}: ${fmt(t, c.base.v, "val")}`, `95% interval: ${fmt(t, c.base.lo, "val")} to ${fmt(t, c.base.hi, "val")}`, `best tuned: ${POL[best]} ${fmt(t, bv, "val")}`] });
      }
      const parts = [{ text: `${POL_SHORT[worst]} `, color: P.bad }, { text: fmt(t, wv, "val"), color: P.muted },
        { text: " → ", color: P.dim2 }, { text: `${POL_SHORT[best]} `, color: P.good }, { text: fmt(t, bv, "val"), color: P.text, bold: true }];
      rows.push({ label: caseLabel(c), color: c.family === "discrete" ? DISC_COLOR[c.disc] : CONT_COLOR[c.cont], lanes: 1, marks, noteParts: parts, note: parts.map((x) => x.text).join("") });
    }
  }
  const med = (xs) => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor((a.length - 1) / 2)] : 0; };
  const unit = t === "sudoku" ? (v) => `${(v * 100).toFixed(1)} pts` : t === "text8" ? (v) => `${v.toFixed(2)} words` : (v) => `${v.toFixed(1)} ref_w1`;
  return (
    <Frame
      kicker="Figure D · how much the sampler matters"
      title="For each model: its best and worst sampler, both tuned"
      subtitle="One row per model. Each dot is one sampler's best setting on the same validation prompts. Green: best sampler. Red: worst. Ring: native. The line spans worst to best."
      controls={<>
        <Pills value={task} onChange={setTask} options={TASK_OPTS} />
        <Pills value={fam} onChange={setFam} options={FAM_OPTS} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS} />
      </>}
      note={`Stage-2 validation (256 prompts, NFE 128), every sampler tuned on validation (2 to 24 trials). Pure continuous rows include the two random-anchoring samplers. ${t === "tinystories" ? "ref_w1 on a log axis, lower is better (axis flipped). " : ""}Median over the ${gaps.length} models shown: best − worst ${unit(med(gaps.map((g) => g.bw)))}, best − native ${unit(med(gaps.map((g) => g.bn)))}${gaps.some((g) => g.bu != null) ? `, best − untuned native ${unit(med(gaps.filter((g) => g.bu != null).map((g) => g.bu)))} (${gaps.filter((g) => g.bu != null).length} models)` : ". Untuned native (temperature 1): evaluation pending"}.`}
    >
      {pending(task) ? <Pending task={task} /> : <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "dot", color: P.good, label: "best sampler" }, { shape: "dot", color: P.bad, label: "worst sampler" }, { shape: "ring", color: P.text, label: "native (tuned)" }, { shape: "square", color: P.highlight, label: "native, untuned" }, { shape: "dot", color: P.dim2, label: "other samplers" }]} />
        <StripPanel clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t, "val")} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)} log={t === "tinystories"}
          axisLabel={{ text: metricName(t, "val"), tick: tickFor(t, "val") }} />
        {tip.el}
      </div>}
    </Frame>
  );
}

// ─── Figure P: every result ───────────────────────────────────────────────────
function ResultsInner() {
  const [task, setTask] = useState("sudoku");
  const [fam, setFam] = useState("all");
  const [arm, setArm] = useState("all");
  const th = { fontSize: 10, color: P.muted, fontWeight: 600, textTransform: "none", letterSpacing: 0, padding: "4px 8px", textAlign: "right", whiteSpace: "nowrap", borderBottom: `1px solid ${P.line}` };
  const td = { fontSize: 11, padding: "3px 8px", textAlign: "right", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums", borderBottom: `1px solid ${rgba(P.line, 0.5)}`, color: P.text };
  const iv = (s) => (s?.lo != null ? `${fmt(task, s.lo, "val")}–${fmt(task, s.hi, "val")}` : "");
  return (
    <Frame
      kicker="Figure Q · every result"
      title="Every model's numbers in one place"
      subtitle="One row per 8-layer model (the 16-layer models are in Figure A). Test: the validation-selected sampler at 128 network calls. Validation: that sampler's stage-2 score with its 95% bootstrap interval."
      controls={<>
        <Pills value={task} onChange={setTask} options={TASK_OPTS} />
        <Pills value={fam} onChange={setFam} options={FAM_OPTS} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS} />
      </>}
      note={`Test ${metricName(task)} (${dirWord(task)}) on ${TK[task].test_n.toLocaleString()} test ${task === "sudoku" ? "puzzles" : "prompts"}, two sampling seeds. Validation ${metricName(task, "val")} on 256 prompts. NFE 512: the selected sampler's settings at 512 calls on 128 test prompts, one seed (reported only)${task === "tinystories" ? "; on 128 stories SOL reads higher than on 2,048, so it is not comparable with the test column" : ""}. Best anchoring: the better random-anchoring sampler on validation (pure continuous only). Gaussian models use 512-dimensional embeddings.`}
    >
      {pending(task) ? <Pending task={task} /> : <div style={{ overflowX: "auto" }}>
        <table style={{ display: "table", boxShadow: "none", borderRadius: 0, width: "100%", borderCollapse: "collapse", fontFamily: FONT, margin: 0 }}>
          <thead>
            <tr>
              <th style={{ ...th, textAlign: "left" }}>model</th>
              <th style={{ ...th, textAlign: "left" }}>selected</th>
              <th style={th}>test</th>
              <th style={th}>seeds</th>
              <th style={th}>validation</th>
              <th style={th}>95% interval</th>
              <th style={th}>NFE 512</th>
              <th style={th}>best anchoring</th>
              <th style={th}>untuned native (val / test)</th>
              <th style={{ ...th, textAlign: "left" }}>top 3 families (test)</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups(fam, arm).map((g) => [
              <tr key={g.label}><td colSpan={10} style={{ ...td, textAlign: "left", fontSize: 9.5, letterSpacing: "0.08em", color: P.dim2, fontWeight: 700, padding: "10px 8px 3px", textTransform: "uppercase" }}>{g.label}</td></tr>,
              ...g.rows.flatMap((q) => {
                const c = find({ task, ...q });
                return [c].map((r) => {
                  const s = r.pol[r.selected];
                  const pa = r.anchor ? bestOf(task, r, META.anchor_policies) : null;
                  return (
                    <tr key={r.id}>
                      <td style={{ ...td, textAlign: "left", color: P.text }}>{caseLabel(r)}</td>
                      <td style={{ ...td, textAlign: "left", color: P.muted }}>{POL[r.selected]}</td>
                      <td style={{ ...td, fontWeight: 700 }}>{fmt(task, r.test)}</td>
                      <td style={{ ...td, color: P.muted }}>{(r.test_seeds ? r.test_seeds.map((v) => fmt(task, v)).join(" / ") : "test pending")}</td>
                      <td style={td}>{fmt(task, s.v, "val")}</td>
                      <td style={{ ...td, color: P.muted }}>{iv(s)}</td>
                      <td style={{ ...td, color: P.muted }}>{fmt(task, s.n512)}</td>
                      <td style={{ ...td, color: P.muted }}>{pa ? `${fmt(task, r.pol[pa].v, "val")} (${POL_SHORT[pa]})` : ""}</td>
                      <td style={{ ...td, color: P.muted }}>{r.base ? `${fmt(task, r.base.v, "val")} / ${fmt(task, r.base.test)}` : "pending"}</td>
                      <td style={{ ...td, textAlign: "left", color: P.muted }}>{famLine(task, r) ?? "–"}</td>
                    </tr>
                  );
                });
              }),
            ])}
          </tbody>
        </table>
      </div>}
    </Frame>
  );
}

// ─── Figure R: untuned native vs the final tuned sampler (test) ───────────────
// Top-3 sampler families on test, "EB churn 94.0% · renoise 93.1% · Ψ·t 92.8%".
const famLine = (t, c) => (c.fams ? c.fams.map((f) => `${POL_SHORT[f.member]} ${fmt(t, f.test)}`).join(" · ") : null);
function UntunedInner() {
  const opts = TASK_OPTS.filter((o) => !pending(o.id));
  const [task, setTask] = useState(opts[0].id);
  const [fam, setFam] = useState("all");
  const [arm, setArm] = useState("all");
  const tip = useTip();
  const t = task, noise = TK[t].noise;
  const seeds = (xs) => (xs ? xs.map((v) => fmt(t, v)).join(" / ") : "pending");
  const tally = { better: 0, within: 0, worse: 0 };
  const vals = [];
  const rows = [];
  const groups = filteredGroups(fam, arm);
  for (const g of groups) {
    if (groups.length > 1) rows.push({ header: true, label: g.label });
    for (const q of g.rows) {
      const c = find({ task: t, ...q });
      if (c.base?.test == null || c.test == null) continue;
      const u = c.base.test, v = c.test, d = gain(t, u, v);
      tally[d > noise ? "better" : d < -noise ? "worse" : "within"] += 1;
      vals.push(u, v);
      const marks = [
        { shape: "square", color: P.highlight, lane: 0, v: u, size: 4.5,
          tip: [`${caseLabel(c)} · untuned native (T = 1)`, `${metricName(t)}: ${fmt(t, u)}`, `two seeds: ${seeds(c.base.test_seeds)}`] },
        { shape: "dot", color: P.candi, lane: 1, v, from: u,
          tip: [`${caseLabel(c)} · tuned: ${POL[c.selected]}`, `${metricName(t)}: ${fmt(t, v)}`, `two seeds: ${seeds(c.test_seeds)}`, `gain over untuned: ${fmtD(t, isMin(t) ? u - v : v - u)}`, ...(c.fams ? [`top 3 families on test: ${famLine(t, c)}`] : [])] },
      ];
      const parts = [{ text: fmtD(t, isMin(t) ? u - v : v - u), color: gapColor(t, d, noise), bold: true },
        { text: `  ${POL_SHORT[c.selected]}`, color: P.dim2 }];
      rows.push({ label: caseLabel(c), color: c.family === "discrete" ? DISC_COLOR[c.disc] : CONT_COLOR[c.cont], lanes: 2, marks, noteParts: parts, note: parts.map((x) => x.text).join("") });
    }
  }
  return (
    <Frame
      kicker="Figure R · untuned vs tuned, on test"
      title="What tuning the sampler buys on the test split"
      subtitle="One row per 8-layer model. Square: the native sampler at temperature 1 with default settings, no search. Dot: the sampler and settings validation selected. The line runs from untuned to tuned."
      controls={<>
        <Pills value={task} onChange={setTask} options={opts} />
        <Pills value={fam} onChange={setFam} options={FAM_OPTS} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS} />
      </>}
      note={`Test ${metricName(t)} (${dirWord(t)}) at 128 network calls on ${TK[t].test_n.toLocaleString()} test ${t === "sudoku" ? "puzzles" : "prompts"}, mean of two sampling seeds; both samplers on the same prompts and seeds. Labels: tuned minus untuned (positive = tuning helps), green or red beyond the noise level for one training seed (${t === "sudoku" ? `${noise * 100} pts` : `${noise} words`}), then the tuned sampler. Shown: tuning better beyond noise ${tally.better}, within noise ${tally.within}, untuned better beyond noise ${tally.worse}.`}
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: P.highlight, label: "untuned native" }, { shape: "dot", color: P.candi, label: "tuned (selected sampler)" }]} />
        <StripPanel clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t)} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)}
          axisLabel={{ text: metricName(t), tick: tickFor(t) }}
          refs={t === "text8" ? [{ v: TK.text8.heldout, label: "real text", anchor: "end" }] : []} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Figure R′: untuned native vs the top 3 sampler families (test) ──────────
const FAM_COLOR = { native: () => P.mdlm, renoising: () => P.accent, eb: () => P.warn, psi: () => P.candi, anchoring: () => P.pinkText };
const FAM_LABEL = { native: "native", renoising: "renoise", eb: "EB", psi: "Ψ", anchoring: "anchoring" };
function Top3Inner({ figure = "Figure R′" }) {
  // TinyStories hidden while its untuned baseline lacks a MAUVE score (no rows to draw)
  const opts = TASK_OPTS.filter((o) => !pending(o.id) && !TK[o.id].base_pending);
  const [task, setTask] = useState(opts[0].id);
  // Never every recipe at once: one family (continuous, discrete or hybrid) is shown at a time.
  const [fam, setFam] = useState("continuous");
  const [arm, setArm] = useState("all");
  const tip = useTip();
  const t = task, noise = TK[t].noise;
  const seeds = (xs) => (xs ? xs.map((v) => fmt(t, v)).join(" / ") : "pending");
  const vals = [], rows = [], seen = new Set();
  const tally = { better: 0, within: 0, worse: 0 };
  const groups = filteredGroups(fam, arm);
  for (const g of groups) {
    if (groups.length > 1) rows.push({ header: true, label: g.label });
    for (const q of g.rows) {
      const c = find({ task: t, ...q });
      if (c.base?.test == null || !c.fams) continue;
      const u = c.base.test;
      vals.push(u);
      const marks = [{ shape: "square", color: P.highlight, lane: 0, v: u, size: 4.5,
        tip: [`${caseLabel(c)} · untuned native (T = 1)`, `${metricName(t)}: ${fmt(t, u)}`, `two seeds: ${seeds(c.base.test_seeds)}`] }];
      c.fams.forEach((f, i) => {
        seen.add(f.family);
        vals.push(f.test);
        marks.push({ shape: "dot", color: FAM_COLOR[f.family](), lane: i + 1, v: f.test, from: u,
          tip: [`${caseLabel(c)} · #${i + 1} family on validation: ${POL[f.member]}`, `${metricName(t)}: ${fmt(t, f.test)}`, `two seeds: ${seeds(f.test_seeds)}`, `vs untuned: ${fmtD(t, isMin(t) ? u - f.test : f.test - u)}`] });
      });
      const best = c.fams.reduce((a, f) => (gain(t, a, f.test) > 0 ? f.test : a), c.fams[0].test);
      const d = gain(t, u, best);
      tally[d > noise ? "better" : d < -noise ? "worse" : "within"] += 1;
      const parts = [{ text: fmtD(t, isMin(t) ? u - best : best - u), color: gapColor(t, d, noise), bold: true },
        { text: `  ${c.fams.map((f) => POL_SHORT[f.member]).join(" · ")}`, color: P.dim2 }];
      rows.push({ label: caseLabel(c), color: FAMILY_COLOR[c.family], lanes: 4, marks, noteParts: parts, note: parts.map((x) => x.text).join("") });
    }
  }
  return (
    <Frame
      kicker={`${figure} · untuned vs the top 3 sampler families, on test`}
      title="Is the gain specific to the winning sampler?"
      subtitle="One row per 8-layer model. Square: the native sampler at temperature 1 with default settings. Dots, top to bottom: the three sampler families that ranked highest on validation, each with its best tuned settings, coloured by family. Lines run from untuned to each family."
      controls={<>
        <Pills value={task} onChange={setTask} options={opts} />
        <Pills value={fam} onChange={setFam} options={FAM_OPTS.filter((o) => o.id !== "all")} />
        <Pills value={arm} onChange={setArm} options={ARM_OPTS} />
      </>}
      note={`Test ${metricName(t)} (${dirWord(t)}) at 128 network calls, mean of two sampling seeds; all samplers on the same prompts and seeds. Labels: best of the three on test minus untuned (green or red beyond the noise level, ${t === "sudoku" ? `${noise * 100} pts` : `${noise} words`}), then the three families in validation order. Best of the three beats untuned beyond noise ${tally.better}, within noise ${tally.within}, untuned better beyond noise ${tally.worse}. Picking the best on test is optimistic; it is shown only to see how close the families are. TinyStories is being re-tuned with MAUVE and is not shown.`}
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: P.highlight, label: "untuned native" },
          ...Object.keys(FAM_COLOR).filter((k) => seen.has(k)).map((k) => ({ shape: "dot", color: FAM_COLOR[k](), label: FAM_LABEL[k] }))]} />
        <StripPanel clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t)} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)} laneGap={7}
          axisLabel={{ text: metricName(t), tick: tickFor(t) }}
          refs={t === "text8" ? [{ v: TK.text8.heldout, label: "real text", anchor: "end" }] : []} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Figure H: hybrid vs its pure discrete model (test) ─────────────────────
function HybDiscInner() {
  const opts = TASK_OPTS.filter((o) => !pending(o.id));
  const [task, setTask] = useState(opts[0].id);
  const [arm, setArm] = useState("none");
  const tip = useTip();
  const t = task, noise = TK[t].noise;
  const seeds = (xs) => (xs ? xs.map((v) => fmt(t, v)).join(" / ") : "pending");
  const diff = (a, b) => fmtD(t, isMin(t) ? a - b : b - a);
  const tally = { better: 0, within: 0, worse: 0 };
  const vals = [], rows = [];
  for (const disc of DISC) {
    const base = find({ task: t, family: "discrete", disc: disc.id, arm });
    const scRef = find({ task: t, family: "discrete", disc: disc.id, arm: "sc" });
    if (base?.test == null) continue;
    rows.push({ header: true, label: `${disc.label} view` });
    for (const m of CONT) {
      const h = find({ task: t, family: "hybrid", disc: disc.id, cont: m.id, arm });
      if (h?.test == null) continue;
      const u = base.test, v = h.test, d = gain(t, u, v);
      tally[d > noise ? "better" : d < -noise ? "worse" : "within"] += 1;
      vals.push(u, v);
      const marks = [
        { shape: "square", color: P.highlight, lane: 0, v: u, size: 4.5,
          tip: [`${caseLabel(base)}`, `${metricName(t)}: ${fmt(t, u)}`, `two seeds: ${seeds(base.test_seeds)}`, `sampler: ${POL[base.selected]}`] },
        { shape: "dot", color: CONT_COLOR[m.id](), lane: 1, v, from: u,
          tip: [`${caseLabel(h)}`, `${metricName(t)}: ${fmt(t, v)}`, `two seeds: ${seeds(h.test_seeds)}`, `sampler: ${POL[h.selected]}`, `vs ${caseLabel(base)}: ${diff(u, v)}`,
            ...(arm === "none" && scRef?.test != null ? [`vs ${caseLabel(scRef)}: ${diff(scRef.test, v)}`] : [])] },
      ];
      if (arm === "none" && scRef?.test != null) {
        vals.push(scRef.test);
        marks.unshift({ shape: "ring", color: P.candi, lane: 0, v: scRef.test,
          tip: [`${caseLabel(scRef)} (reference)`, `${metricName(t)}: ${fmt(t, scRef.test)}`, `two seeds: ${seeds(scRef.test_seeds)}`] });
      }
      const parts = [{ text: diff(u, v), color: gapColor(t, d, noise), bold: true },
        ...(arm === "none" && scRef?.test != null ? [{ text: `  vs +SC ${diff(scRef.test, v)}`, color: P.dim2 }] : [])];
      rows.push({ label: `+ ${m.label}`, color: CONT_COLOR[m.id], lanes: 2, marks, noteParts: parts, note: parts.map((x) => x.text).join("") });
    }
  }
  const sc = arm === "sc";
  return (
    <Frame
      kicker="Figure G′ · hybrid vs pure discrete, on test"
      title="What adding a continuous view does to a discrete model"
      subtitle={sc
        ? "Both with SC. Square: the discrete model with SC. Dot: the same discrete view plus a continuous view, with SC. The line runs from discrete to hybrid."
        : "Both without SC. Square: the discrete model. Dot: the same discrete view plus a continuous view (coloured by continuous method). Green ring: the discrete model with SC, for reference. The line runs from discrete to hybrid."}
      controls={<>
        <Pills value={task} onChange={setTask} options={opts} />
        <Pills value={arm} onChange={setArm} options={[{ id: "none", label: "No SC" }, { id: "sc", label: "SC" }]} />
      </>}
      note={`Test ${metricName(t)} (${dirWord(t)}) at 128 network calls, mean of two sampling seeds, each model with its validation-selected sampler. Labels: hybrid minus discrete${sc ? "" : ", then hybrid minus discrete + SC"}; green or red beyond the noise level for one training seed (${t === "sudoku" ? `${noise * 100} pts` : `${noise} words`}). Shown: hybrid better beyond noise ${tally.better}, within noise ${tally.within}, worse beyond noise ${tally.worse}. The hybrids' learned clocks collapse (the continuous view sits at t ≥ 0.985 for most of sampling on text).${t === "text8" ? ` Dashed line: held-out real text (${TK.text8.heldout.toFixed(2)} words); scores past it reward diversity over fluency.` : ""} TinyStories is being re-tuned with MAUVE and is not shown.`}
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: P.highlight, label: sc ? "discrete + SC" : "discrete" },
          ...(sc ? [] : [{ shape: "ring", color: P.candi, label: "discrete + SC (reference)" }]),
          ...CONT.map((m) => ({ shape: "dot", color: CONT_COLOR[m.id](), label: `hybrid, ${m.label}` }))]} />
        <StripPanel clamp={t === "sudoku" ? [0, 1] : null} tip={tip} title={taskTitle(t)} sub={dirWord(t)} rows={rows} values={vals} rev={isMin(t)}
          axisLabel={{ text: metricName(t), tick: tickFor(t) }}
          refs={t === "text8" ? [{ v: TK.text8.heldout, label: "real text", anchor: "end" }] : []} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Random anchoring: the schedule power p tuning chose ──────────────────────
function PowerPanel({ task, policy, tip }) {
  const [ref, w] = useWidth(300);
  const rows = ANCHOR_P.rows.filter((r) => r.task === task && r.policy === policy);
  const L = 26, R = 6, T = 10, H = 150, B = 22, top = 3;
  const y = (v) => T + H - (v / top) * H;
  const slot = (w - L - R) / CONT.length;
  const bw = Math.min(16, (slot - 10) / 2);
  return (
    <div ref={ref} style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.text }}>{TK[task].label} · {POL[policy]}</div>
      <svg width={w} height={T + H + B} style={{ display: "block", fontFamily: FONT, overflow: "visible" }}>
        {[0, 1, 2, 3].map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 6} y={y(t) + 3.5} fill={P.dim2} fontSize={9.5} textAnchor="end">{t}</text>
          </g>
        ))}
        <line x1={L} x2={w - R} y1={y(1)} y2={y(1)} stroke={P.muted} strokeWidth={1.1} strokeDasharray="3 3" />
        {CONT.map((m, i) => {
          const cx = L + slot * (i + 0.5);
          return (
            <g key={m.id}>
              {["none", "sc"].map((arm, k) => {
                const r = rows.find((q) => q.cont === m.id && q.arm === arm);
                if (!r) return null;
                const x0 = cx + (k ? 1 : -1 - bw), col = FAMILY_COLOR.continuous(); // every model here is pure continuous
                const lines = [`${m.label}${arm === "sc" ? " + SC" : ""} · ${POL[policy]}`, `p = ${r.power.toFixed(2)}`, `temperature ${r.temperature.toFixed(2)}, tokens ${r.tokens === "greedy" ? "argmax" : "sampled"}`, `validation ${metricName(task, "val")}: ${fmt(task, r.score, "val")}`];
                const h = Math.max(1, y(0) - y(r.power));
                return (
                  <path key={arm} {...tip.hit(lines)} d={`M${x0},${y(0)} v${-(h - 3)} q0,-3 3,-3 h${bw - 6} q3,0 3,3 v${h - 3} z`}
                    fill={arm === "sc" ? col : rgba(col, 0.18)} stroke={col} strokeWidth={arm === "sc" ? 0 : 1.2} style={{ ...tip.hit(lines).style }} />
                );
              })}
              <text x={cx} y={T + H + 14} fill={P.muted} fontSize={10} textAnchor="middle">{m.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Interactive: the commitment schedule (k/S)^p, and a toy sequence committing in random order.
const TOY_N = 32;
const TOY_ORDER = (() => { let x = 7; const a = [...Array(TOY_N).keys()]; for (let i = TOY_N - 1; i > 0; i--) { x = (x * 1103515245 + 12345) % 2147483648; const j = x % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; })();
function AnchorCurve() {
  const [p, setP] = useState(2.23);
  const [k, setK] = useState(50);
  const [ref, w] = useWidth(320);
  const L = 30, R = 10, T = 8, H = 140, B = 26;
  const x = (u) => L + u * (w - L - R), y = (v) => T + H - v * H;
  const curve = (pp) => [...Array(101).keys()].map((i) => `${i ? "L" : "M"}${x(i / 100).toFixed(1)},${y((i / 100) ** pp).toFixed(1)}`).join("");
  const share = (k / 100) ** p;
  const done = Math.floor(share * TOY_N + 0.5);
  const committed = new Set(TOY_ORDER.slice(0, done));
  const slider = { width: "100%", accentColor: P.accent };
  const cell = Math.max(6, Math.min(16, (w - 2 * (TOY_N - 1)) / TOY_N));
  return (
    <div ref={ref} style={{ fontFamily: FONT, marginBottom: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "6px 18px", fontSize: 11.5, color: P.muted }}>
        <label>p = <b style={{ color: P.text }}>{p.toFixed(2)}</b> {p < 0.95 ? "(commits early)" : p <= 1.05 ? "(constant rate, like a linear masked schedule)" : "(commits late)"}
          <input type="range" min={0.33} max={3} step={0.01} value={p} onChange={(e) => setP(+e.target.value)} style={slider} aria-label="schedule power p" /></label>
        <label>step k/S = <b style={{ color: P.text }}>{(k / 100).toFixed(2)}</b> · committed <b style={{ color: P.text }}>{(share * 100).toFixed(0)}%</b>
          <input type="range" min={0} max={100} step={1} value={k} onChange={(e) => setK(+e.target.value)} style={slider} aria-label="sampling progress" /></label>
      </div>
      <svg width={w} height={T + H + B} style={{ display: "block", overflow: "visible", marginTop: 6 }}>
        {[0, 0.5, 1].map((t) => (
          <g key={t}>
            <line x1={L} x2={w - R} y1={y(t)} y2={y(t)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 6} y={y(t) + 3.5} fill={P.dim2} fontSize={9.5} textAnchor="end">{t * 100}%</text>
            <text x={x(t)} y={T + H + 13} fill={P.dim2} fontSize={9.5} textAnchor="middle">{t}</text>
          </g>
        ))}
        <text x={w - R} y={T + H + 24} fill={P.muted} fontSize={9.5} textAnchor="end">sampling progress k/S →</text>
        <path d={curve(1)} fill="none" stroke={P.muted} strokeWidth={1.1} strokeDasharray="3 3" />
        <text x={x(0.62)} y={y(0.62) - 6} fill={P.muted} fontSize={9.5} textAnchor="end">p = 1</text>
        <path d={curve(p)} fill="none" stroke={P.accent} strokeWidth={2} />
        <line x1={x(k / 100)} x2={x(k / 100)} y1={T} y2={T + H} stroke={P.line2} strokeWidth={1} />
        <circle cx={x(k / 100)} cy={y(share)} r={4.5} fill={P.accent} stroke={P.bg} strokeWidth={2} />
      </svg>
      <div style={{ fontSize: 10.5, color: P.dim2, margin: "2px 0 4px" }}>A 32-token sequence at this step (filled = committed, frozen at a token; order is random):</div>
      <div style={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {[...Array(TOY_N).keys()].map((i) => (
          <span key={i} style={{ width: cell, height: cell, borderRadius: 3, background: committed.has(i) ? P.accent : "transparent", boxShadow: `inset 0 0 0 1px ${committed.has(i) ? P.accent : P.line2}` }} />
        ))}
      </div>
    </div>
  );
}

function AnchorScheduleInner() {
  return (
    <Frame
      kicker="Figure E′ · random anchoring's schedule"
      title="When random anchoring commits"
      subtitle="After step k of S, a share (k/S)^p of positions is committed. Drag p to see the schedule: p = 1 commits at a constant rate; p = 3 has committed only 1/8 of positions at the halfway point and 42% at three quarters, so most commits happen in the last quarter."
    >
      <AnchorCurve />
    </Frame>
  );
}

function AnchorPowerInner() {
  const tip = useTip();
  return (
    <Frame
      kicker="Figure E″ · tuned anchoring power"
      title="How late should random anchoring commit?"
      subtitle="The p tuning chose for each continuous model (Figure E′ shows what p does to the schedule)."
      note="Each bar: the stage-2 winner's p for that sampler (validation, 256 prompts, NFE 128; search range 0.33 to 3, 16 trials). Outlined: no SC; filled: SC. Hover a bar for the temperature and token rule it was paired with. Only 8 distinct p values occur, because the search proposes many of the same points across models; read p as coarse. TinyStories is being re-tuned and is not shown."
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: FAMILY_COLOR.continuous(), label: "pure continuous model (outlined: no SC · filled: SC)" }, { line: true, wide: true, dash: "3 3", color: P.muted, label: "p = 1 (constant rate)" }]} />
        <Grid min={260}>
          {["sudoku", "text8"].flatMap((t) => META.anchor_policies.map((p) => <PowerPanel key={t + p} task={t} policy={p} tip={tip} />))}
        </Grid>
        {tip.el}
      </div>
    </Frame>
  );
}

export const AllResults = withVizTheme(ResultsInner);
export const AnchorPower = withVizTheme(AnchorPowerInner);
export const AnchorSchedule = withVizTheme(AnchorScheduleInner);
export const UntunedVsTuned = withVizTheme(UntunedInner);
export const UntunedVsTop3 = withVizTheme(Top3Inner);
export const SamplerSpread = withVizTheme(SpreadInner);
export const ScVsDepth = withVizTheme(ScVsDepthInner);
export const SamplerLandscape = withVizTheme(LandscapeInner);
export const AnchoringSc = withVizTheme(AnchoringInner);
export const ContinuousSc = withVizTheme(ContinuousInner);
export const HybridSc = withVizTheme(HybridInner);
export const HybridVsDiscrete = withVizTheme(HybDiscInner);
