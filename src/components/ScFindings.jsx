// Figures for the findings-organised results of the self-conditioning post. Every number is read
// from src/data/sc_rerun.json (built by ~/sc-blog-handoff/blog-rewrite/build_data.py): Sudoku and
// text8 from rerun-20261110 + psi2-20261111 + anchoring runs + followup-20261111 (untuned baseline);
// TinyStories from the MAUVE re-tune ts-mauve-20261112. All three metrics are higher-is-better.
import { useEffect, useRef, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import { useTip, Legend } from "./ScRerun.jsx";
import DATA from "../data/sc_rerun.json";

const TK = DATA.meta.tasks;
const CASES = DATA.cases;
const TASK_OPTS = [{ id: "sudoku", label: "Sudoku" }, { id: "text8", label: "text8" }, { id: "tinystories", label: "TinyStories" }];
const CONT = [{ id: "gaussian", label: "Gaussian" }, { id: "simplex", label: "Simplex" }, { id: "spherical", label: "Spherical" }, { id: "vmf", label: "vMF" }];
const DISC = [{ id: "masked", label: "Masked" }, { id: "uniform", label: "Uniform" }];
const ALL6 = [...DISC, ...CONT];
const SAMPLERS = ["native", "native_greedy", "renoising", "renoising_greedy", "eb_greedy", "eb_churn", "psi_corruption", "psi_controller"];
const ANCH = ["anchor_native", "anchor_renoising"];
const SNAME = {
  native: "native", native_greedy: "native greedy", renoising: "renoise", renoising_greedy: "renoise greedy",
  eb_greedy: "EB greedy", eb_churn: "EB churn", psi_corruption: "Ψ·c", psi_controller: "Ψ·t",
  anchor_native: "anchor native", anchor_renoising: "anchor renoise",
};
const lab = (id) => ALL6.find((m) => m.id === id)?.label ?? id;
const METRIC = { sudoku: "accuracy", text8: "valid words / sample", tinystories: "MAUVE" };
const UNIT = { sudoku: "pts", text8: "words", tinystories: "MAUVE" };
const noise = (t) => TK[t].noise;

const fmt = (t, v) => (v == null ? "–" : t === "sudoku" ? `${(v * 100).toFixed(1)}%` : t === "text8" ? v.toFixed(2) : v.toFixed(3));
const fmtD = (t, d) => {
  const s = d >= 0 ? "+" : "−", a = Math.abs(d);
  return t === "sudoku" ? `${s}${(a * 100).toFixed(1)} pts` : t === "text8" ? `${s}${a.toFixed(2)}` : `${s}${a.toFixed(3)}`;
};
const get = (q) => CASES.find((c) => Object.entries(q).every(([k, v]) => (c[k] ?? null) === v));
const pure = (task, id, arm) => get({ task, arm, family: DISC.some((d) => d.id === id) ? "discrete" : "continuous", [DISC.some((d) => d.id === id) ? "disc" : "cont"]: id });
const best = (c, list) => list.filter((p) => c.pol[p]).reduce((a, p) => (!a || c.pol[p].v > c.pol[a].v ? p : a), null);

function useWidth(init = 560) {
  const ref = useRef(null);
  const [w, setW] = useState(init);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

function Mark({ shape, x, y, color }) {
  const ring = { stroke: P.bg, strokeWidth: 2, paintOrder: "stroke" };
  if (shape === "ring") return <circle cx={x} cy={y} r={5.5} fill={P.bg} stroke={color} strokeWidth={2.2} />;
  if (shape === "diamond") return <path d={`M${x},${y - 7}L${x + 7},${y}L${x},${y + 7}L${x - 7},${y}Z`} fill={color} {...ring} />;
  if (shape === "square") return <rect x={x - 5.5} y={y - 5.5} width={11} height={11} rx={1.5} fill={color} {...ring} />;
  if (shape === "triangle") return <path d={`M${x},${y - 7}L${x + 7},${y + 5}L${x - 7},${y + 5}Z`} fill={color} {...ring} />;
  if (shape === "tick") return <line x1={x} x2={x} y1={y - 10} y2={y + 10} stroke={color} strokeWidth={3} strokeLinecap="round" />;
  return <circle cx={x} cy={y} r={6} fill={color} {...ring} />;
}

// Labelled rows on one shared axis. row: {label, sub?, group?, marks:[{v, shape, color, tip}], link?:[i, j], note?, noteColor?}
function Rows({ task, rows, tip, axisLabel, domain }) {
  const [ref, w] = useWidth();
  const narrow = w < 520;
  const L = narrow ? 8 : 150, R = narrow ? 64 : 92, rowH = narrow ? 40 : 30, top = 6, axisH = 34;
  const vals = rows.flatMap((r) => r.marks.map((m) => m.v)).filter((v) => v != null);
  let [lo, hi] = domain || [Math.min(...vals), Math.max(...vals)];
  const pad = (hi - lo) * 0.08 || 0.01;
  const nonneg = lo >= 0;
  lo -= pad; hi += pad;
  if (nonneg) lo = Math.max(0, lo);
  if (task === "sudoku") { lo = Math.max(0, lo); hi = Math.min(1, hi); }
  const raw = (hi - lo) / (narrow ? 3 : 5), mag = 10 ** Math.floor(Math.log10(raw)), e = raw / mag;
  const step = (e >= 5 ? 5 : e >= 2 ? 2 : 1) * mag;
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const x = (v) => L + ((v - lo) / (hi - lo)) * (w - L - R);
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(+v.toFixed(10));
  let y = top;
  const placed = rows.map((r) => {
    const gy = r.group ? (y += 18, y - 6) : null;
    const ry = y + (narrow ? 26 : rowH / 2);
    y += rowH;
    return { ...r, gy, ry };
  });
  const H = y + axisH;
  return (
    <div ref={ref} style={{ width: "100%" }}>
      <svg width={w} height={H} style={{ display: "block", fontFamily: FONT, overflow: "visible" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={y} stroke={P.grid} strokeWidth={0.7} />
            <text x={x(t)} y={y + 14} fill={P.dim2} fontSize={10} textAnchor="middle">{task === "sudoku" ? `${Math.round(t * 100)}%` : +t.toFixed(3)}</text>
          </g>
        ))}
        <text x={w - R} y={y + 30} fill={P.dim2} fontSize={10} textAnchor="end">{axisLabel}</text>
        {placed.map((r, i) => (
          <g key={i}>
            {r.group && <text x={4} y={r.gy} fill={P.accent} fontSize={10.5} fontWeight={700}>{r.group}</text>}
            <text x={narrow ? L : L - 10} y={narrow ? r.ry - 13 : r.ry + 4} fill={P.text} fontSize={11.5} textAnchor={narrow ? "start" : "end"}>
              {r.label}{r.sub && <tspan fill={P.dim2} fontSize={10}>{`  ${r.sub}`}</tspan>}
            </text>
            {r.link && r.marks[r.link[0]]?.v != null && r.marks[r.link[1]]?.v != null && (
              <line x1={x(r.marks[r.link[0]].v)} x2={x(r.marks[r.link[1]].v)} y1={r.ry} y2={r.ry} stroke={P.line2} strokeWidth={3} strokeLinecap="round" />
            )}
            {r.marks.map((m, k) => m.v != null && (
              <g key={k} {...tip.hit(m.tip)}>
                <circle cx={x(m.v)} cy={r.ry} r={12} fill="transparent" />
                <Mark shape={m.shape} x={x(m.v)} y={r.ry} color={m.color} />
              </g>
            ))}
            {r.note && <text x={w - R + 8} y={r.ry + 4} fill={r.noteColor || P.muted} fontSize={11} fontWeight={700}>{r.note}</text>}
          </g>
        ))}
      </svg>
    </div>
  );
}

// Delta label, coloured only when it clears the one-seed noise threshold for the task.
const deltaNote = (t, d) => ({ note: d == null ? "" : fmtD(t, d), noteColor: d == null || Math.abs(d) < noise(t) ? P.muted : d > 0 ? P.good : P.bad });
const noiseText = (t) => `Labels: SC minus no SC, coloured when larger than about ${t === "sudoku" ? `${noise(t) * 100} points` : `${noise(t)} ${UNIT[t]}`}, the one-seed noise level for ${TK[t].label}.`;

function useTask(init = "text8") {
  const [t, setT] = useState(init);
  return [t, <Pills value={t} onChange={setT} options={TASK_OPTS} />];
}

// ─── SC on vs off, test score of each model's selected sampler (slots 1, 5, 9) ──────────────────
function gainRows(t, keys, opts = {}) {
  return keys.map(({ label, q, group }) => {
    const a = get({ task: t, arm: "none", ...q }), b = get({ task: t, arm: "sc", ...q });
    const pick = (c) => (opts.native ? c?.pol.native?.v : c?.test);
    const va = pick(a), vb = pick(b);
    const tipFor = (c, v, arm) => [`${label}${arm}`, `${opts.native ? "tuned native, validation" : "test"} ${METRIC[t]}: ${fmt(t, v)}`,
      opts.native ? "stage 2, 256 prompts" : `sampler: ${SNAME[c?.selected] ?? "–"}`];
    return {
      label, group,
      marks: [{ v: va, shape: "ring", color: P.dim2, tip: tipFor(a, va, "") }, { v: vb, shape: "dot", color: P.good, tip: tipFor(b, vb, " + SC") }],
      link: [0, 1], ...deltaNote(t, va != null && vb != null ? vb - va : null),
    };
  });
}

function GainFigure({ kicker, title, subtitle, keys, withNative }) {
  const [t, taskPills] = useTask();
  const [mode, setMode] = useState("best");
  const tip = useTip();
  const native = withNative && mode === "native";
  return (
    <Frame kicker={kicker} title={title} subtitle={subtitle}
      controls={<>{taskPills}{withNative && <Pills value={mode} onChange={setMode} options={[{ id: "best", label: "Best tuned sampler" }, { id: "native", label: "Native sampler" }]} />}</>}
      note={`${native ? "Validation (stage 2, 256 prompts) of the tuned native sampler." : `Test ${METRIC[t]} of each model's selected sampler (${TK[t].test_n.toLocaleString()} test ${t === "sudoku" ? "puzzles" : "prompts"}, two seeds, 128 NFE).`} Higher is better. ${noiseText(t)} One training seed per model.`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "ring", color: P.dim2, label: "no SC" }, { shape: "dot", color: P.good, label: "SC" }]} />
        <Rows task={t} rows={gainRows(t, keys, { native })} tip={tip} axisLabel={`${METRIC[t]} →`} />
        {tip.el}
      </div>
    </Frame>
  );
}

const CONT_KEYS = CONT.map((m) => ({ label: m.label, q: { family: "continuous", cont: m.id } }));
const DISC_KEYS = DISC.map((m) => ({ label: m.label, q: { family: "discrete", disc: m.id } }));
const HYB_KEYS = DISC.flatMap((d) => CONT.map((m, i) => ({ label: m.label, group: i === 0 ? `${d.label} hybrids` : null, q: { family: "hybrid", disc: d.id, cont: m.id } })));

function ContinuousGainInner() {
  return <GainFigure kicker="Figure · SC on continuous methods" title="Self conditioning helps every continuous method"
    subtitle="Each row is one continuous method, trained without and with SC; each model uses its own best sampler, tuned on validation." keys={CONT_KEYS} />;
}
function DiscreteGainInner() {
  return <GainFigure kicker="Figure · SC on discrete methods" title="Masked and uniform respond differently to SC" withNative
    subtitle="Masked and uniform diffusion, trained without and with SC. Switch to the native sampler to compare at a fixed sampler family." keys={DISC_KEYS} />;
}
function HybridGainInner() {
  return <GainFigure kicker="Figure · SC on hybrids" title="Do hybrid methods benefit from self conditioning?"
    subtitle="Each hybrid pairs a discrete view (masked or uniform) with a continuous view, trained without and with SC; best tuned sampler for each model." keys={HYB_KEYS} />;
}

// ─── Discrete anchoring on pure continuous models (slot 4) ──────────────────────────────────────
function AnchoringInner() {
  const [t, taskPills] = useTask();
  const tip = useTip();
  const baseMissing = TK[t].base_pending && t === "tinystories";
  const rows = CONT.map((m) => {
    const a = get({ task: t, family: "continuous", cont: m.id, arm: "none" }), b = get({ task: t, family: "continuous", cont: m.id, arm: "sc" });
    const pa = a && best(a, ANCH), pb = b && best(b, ANCH);
    const va = pa && a.pol[pa].v, vb = pb && b.pol[pb].v;
    const base = baseMissing ? null : b?.base?.v;
    return {
      label: m.label,
      marks: [
        { v: base, shape: "tick", color: P.highlight, tip: [`${m.label} + SC`, `untuned native sampler (T = 1): ${fmt(t, base)}`, vb != null && base != null ? `anchoring with SC is ${fmtD(t, vb - base)} from it` : ""].filter(Boolean) },
        { v: va, shape: "ring", color: P.dim2, tip: [`${m.label}, no SC`, `best anchoring (${SNAME[pa]}): ${fmt(t, va)}`] },
        { v: vb, shape: "dot", color: P.good, tip: [`${m.label} + SC`, `best anchoring (${SNAME[pb]}): ${fmt(t, vb)}`] },
      ],
      link: [1, 2], ...deltaNote(t, va != null && vb != null ? vb - va : null),
    };
  });
  return (
    <Frame kicker="Figure · anchoring continuous models" title="SC makes random anchoring work better"
      subtitle="Random anchoring commits random positions to tokens on a schedule, like a masked process. Each row: the best anchoring sampler without and with SC. The yellow tick is the same SC model with the untuned native sampler, for reference."
      controls={taskPills}
      note={`Stage-2 validation ${METRIC[t]} (256 prompts, 128 NFE), higher is better. ${noiseText(t)}`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "ring", color: P.dim2, label: "anchoring, no SC" }, { shape: "dot", color: P.good, label: "anchoring, SC" }, { line: true, wide: true, color: P.highlight, label: "untuned native, SC" }]} />
        <Rows task={t} rows={rows} tip={tip} axisLabel={`${METRIC[t]} →`} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Every sampler, no SC vs SC, for one discrete method (slot 6) ───────────────────────────────
function SamplersInner() {
  const [t, taskPills] = useTask("text8");
  const [d, setD] = useState("masked");
  const tip = useTip();
  const a = get({ task: t, family: "discrete", disc: d, arm: "none" }), b = get({ task: t, family: "discrete", disc: d, arm: "sc" });
  const rows = SAMPLERS.map((p) => {
    const va = a?.pol[p]?.v, vb = b?.pol[p]?.v;
    const tp = (c, v, arm) => [`${lab(d)}${arm} · ${SNAME[p]}`, `validation ${METRIC[t]}: ${fmt(t, v)}`,
      c?.pol[p]?.lo != null ? `95% interval ${fmt(t, c.pol[p].lo)} to ${fmt(t, c.pol[p].hi)}` : "stage 2, 256 prompts"];
    return { label: SNAME[p], marks: [{ v: va, shape: "ring", color: P.dim2, tip: tp(a, va, "") }, { v: vb, shape: "dot", color: P.good, tip: tp(b, vb, " + SC") }],
      link: [0, 1], ...deltaNote(t, va != null && vb != null ? vb - va : null) };
  });
  return (
    <Frame kicker="Figure · SC and each sampler" title="Which samplers does SC help, and which does it break?"
      subtitle="Each sampler's best setting for one discrete model, without and with SC. For masked text8, the renoising samplers fall apart with SC while the rest hold up."
      controls={<>{taskPills}<Pills value={d} onChange={setD} options={DISC} /></>}
      note={`Stage-2 validation ${METRIC[t]} (256 prompts, 128 NFE) of each sampler's tuned setting, higher is better. ${noiseText(t)}`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "ring", color: P.dim2, label: "no SC" }, { shape: "dot", color: P.good, label: "SC" }]} />
        <Rows task={t} rows={rows} tip={tip} axisLabel={`${METRIC[t]} →`} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Hybrid vs pure discrete vs pure continuous (slot 10) ───────────────────────────────────────
function HybridVsPureInner() {
  const [t, taskPills] = useTask();
  const [arm, setArm] = useState("sc");
  const tip = useTip();
  const rows = DISC.flatMap((d) => CONT.map((m, i) => {
    const h = get({ task: t, family: "hybrid", disc: d.id, cont: m.id, arm });
    const pd = pure(t, d.id, arm), pc = pure(t, m.id, arm);
    const name = `${d.label} + ${m.label}${arm === "sc" ? " + SC" : ""}`;
    const bestPure = Math.max(pd?.test ?? -Infinity, pc?.test ?? -Infinity);
    return {
      label: m.label, group: i === 0 ? `${d.label} hybrids` : null,
      marks: [
        { v: pd?.test, shape: "square", color: P.mdlm, tip: [`${d.label}${arm === "sc" ? " + SC" : ""} (pure discrete)`, `test ${METRIC[t]}: ${fmt(t, pd?.test)}`] },
        { v: pc?.test, shape: "ring", color: P.duo, tip: [`${m.label}${arm === "sc" ? " + SC" : ""} (pure continuous)`, `test ${METRIC[t]}: ${fmt(t, pc?.test)}`] },
        { v: h?.test, shape: "dot", color: P.accent, tip: [`${name} (hybrid)`, `test ${METRIC[t]}: ${fmt(t, h?.test)}`, `sampler: ${SNAME[h?.selected] ?? "–"}`] },
      ],
      ...deltaNote(t, h?.test != null && isFinite(bestPure) ? h.test - bestPure : null),
    };
  }));
  return (
    <Frame kicker="Figure · hybrids vs their parts" title="Hybrid vs pure discrete vs pure continuous"
      subtitle="Each row is one hybrid next to the two pure models it is built from, all with the same training and each with its own best tuned sampler."
      controls={<>{taskPills}<Pills value={arm} onChange={setArm} options={[{ id: "none", label: "no SC" }, { id: "sc", label: "SC" }]} /></>}
      note={`Test ${METRIC[t]} of each model's selected sampler, higher is better. Label: hybrid minus the better of its two parts, coloured past the one-seed noise level. The pure discrete model repeats across the four rows of its group.`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: P.mdlm, label: "pure discrete" }, { shape: "ring", color: P.duo, label: "pure continuous" }, { shape: "dot", color: P.accent, label: "hybrid" }]} />
        <Rows task={t} rows={rows} tip={tip} axisLabel={`${METRIC[t]} →`} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Hybrid over its better pure part, no SC ───────────────────────────────────────────────────
function HybridOverBaseInner() {
  const [t, taskPills] = useTask();
  const tip = useTip();
  let better = 0;
  const rows = DISC.flatMap((d) => CONT.map((m, i) => {
    const h = get({ task: t, family: "hybrid", disc: d.id, cont: m.id, arm: "none" });
    const pd = pure(t, d.id, "none"), pc = pure(t, m.id, "none");
    const base = pd && pc ? (pd.test >= pc.test ? { c: pd, name: d.label, col: P.mdlm, shape: "square" } : { c: pc, name: m.label, col: P.duo, shape: "ring" }) : null;
    const delta = h && base ? h.test - base.c.test : null;
    if (delta != null && delta > noise(t)) better += 1;
    return {
      label: m.label, group: i === 0 ? `${d.label} hybrids` : null,
      marks: [
        { v: base?.c.test, shape: base?.shape ?? "ring", color: base?.col ?? P.dim2, tip: [`better pure part: ${base?.name ?? "–"}`, `test ${METRIC[t]}: ${fmt(t, base?.c.test)}`] },
        { v: h?.test, shape: "dot", color: P.accent, tip: [`${d.label} + ${m.label} (hybrid)`, `test ${METRIC[t]}: ${fmt(t, h?.test)}`, `sampler: ${SNAME[h?.selected] ?? "–"}`] },
      ],
      link: [0, 1], ...deltaNote(t, delta),
    };
  }));
  return (
    <Frame kicker="Figure · hybrids without SC" title="Without SC, hybrids often beat both of their parts"
      subtitle="Each row: a hybrid (purple) against the better of the two pure models it is built from (red: pure discrete, blue: pure continuous), all trained without SC, each with its own best tuned sampler."
      controls={taskPills}
      note={`Test ${METRIC[t]} of each model's selected sampler, higher is better. Label: hybrid minus its better pure part, coloured past the one-seed noise level. ${better} of 8 hybrids beat both parts by more than the noise level on ${TK[t].label}.`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: P.mdlm, label: "better part: pure discrete" }, { shape: "ring", color: P.duo, label: "better part: pure continuous" }, { shape: "dot", color: P.accent, label: "hybrid" }]} />
        <Rows task={t} rows={rows} tip={tip} axisLabel={`${METRIC[t]} →`} />
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Untuned vs tuned ranking (slot 12) ─────────────────────────────────────────────────────────
function RankingInner() {
  const opts = TASK_OPTS.filter((o) => !(TK[o.id].base_pending && o.id === "tinystories"));
  const [t, setT] = useState("sudoku");
  const [arm, setArm] = useState("none");
  const tip = useTip();
  const [ref, w] = useWidth();
  const items = ALL6.map((m) => ({ m, c: pure(t, m.id, arm) })).filter(({ c }) => c?.base?.test != null);
  const vals = items.flatMap(({ c }) => [c.base.test, c.test]);
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const H = 320, T = 22, B = 30, lx = Math.min(150, w * 0.3), rx = w - Math.min(150, w * 0.3);
  const y = (v) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const color = (id) => (DISC.some((d) => d.id === id) ? P.mdlm : P.duo);
  const rank = (key) => [...items].sort((a, b) => key(b.c) - key(a.c)).map((x) => x.m.id);
  const r0 = rank((c) => c.base.test), r1 = rank((c) => c.test);
  // label positions pushed apart so close values do not overprint (marks stay at their true y)
  const spread = (key) => {
    const ys = items.map(({ m, c }) => ({ id: m.id, y: y(key(c)) })).sort((p, q) => p.y - q.y);
    ys.forEach((p, i) => { if (i && p.y - ys[i - 1].y < 13) p.y = ys[i - 1].y + 13; });
    return Object.fromEntries(ys.map((p) => [p.id, p.y]));
  };
  const ly0 = spread((c) => c.base.test), ly1 = spread((c) => c.test);
  return (
    <Frame kicker="Figure · why tune samplers" title="Untuned and tuned samplers rank the methods differently"
      subtitle="Each line is one method: its test score with the untuned native sampler (left) and with its best tuned sampler (right)."
      controls={<><Pills value={t} onChange={setT} options={opts} /><Pills value={arm} onChange={setArm} options={[{ id: "none", label: "no SC" }, { id: "sc", label: "SC" }]} /></>}
      note={`Test ${METRIC[t]} (${TK[t].test_n.toLocaleString()} test ${t === "sudoku" ? "puzzles" : "prompts"}, two seeds, 128 NFE), higher is better. Untuned: native sampler at temperature 1, no search. Numbers next to the names are ranks.`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <div ref={ref} style={{ width: "100%" }}>
          <svg width={w} height={H} style={{ display: "block", fontFamily: FONT, overflow: "visible" }}>
            <text x={lx} y={12} fill={P.dim2} fontSize={10.5} textAnchor="middle">untuned native</text>
            <text x={rx} y={12} fill={P.dim2} fontSize={10.5} textAnchor="middle">best tuned</text>
            <line x1={lx} x2={lx} y1={T} y2={H - B} stroke={P.grid} />
            <line x1={rx} x2={rx} y1={T} y2={H - B} stroke={P.grid} />
            {items.map(({ m, c }) => {
              const col = color(m.id), name = `${m.label}${arm === "sc" ? " + SC" : ""}`;
              return (
                <g key={m.id}>
                  <line x1={lx} x2={rx} y1={y(c.base.test)} y2={y(c.test)} stroke={rgba(col, 0.7)} strokeWidth={2} />
                  <g {...tip.hit([name, `untuned native: ${fmt(t, c.base.test)} (rank ${r0.indexOf(m.id) + 1})`])}><Mark shape="dot" x={lx} y={y(c.base.test)} color={col} /></g>
                  <g {...tip.hit([name, `best tuned (${SNAME[c.selected]}): ${fmt(t, c.test)} (rank ${r1.indexOf(m.id) + 1})`])}><Mark shape="dot" x={rx} y={y(c.test)} color={col} /></g>
                  <text x={lx - 10} y={ly0[m.id] + 4} fill={P.muted} fontSize={10.5} textAnchor="end">{`${m.label} ${r0.indexOf(m.id) + 1}`}</text>
                  <text x={rx + 10} y={ly1[m.id] + 4} fill={P.muted} fontSize={10.5}>{`${r1.indexOf(m.id) + 1} ${m.label}`}</text>
                </g>
              );
            })}
          </svg>
        </div>
        {tip.el}
      </div>
    </Frame>
  );
}

// ─── Sensitivity to sampler choice (slot 13) ────────────────────────────────────────────────────
function SensitivityInner() {
  const [t, taskPills] = useTask();
  const tip = useTip();
  const baseMissing = TK[t].base_pending && t === "tinystories";
  const rows = ALL6.flatMap((m) => ["none", "sc"].map((arm, k) => {
    const c = pure(t, m.id, arm);
    const name = `${m.label}${arm === "sc" ? " + SC" : ""}`;
    const top = c ? SAMPLERS.filter((p) => c.pol[p]).sort((a, b) => c.pol[b].v - c.pol[a].v).slice(0, 3) : [];
    const base = baseMissing ? null : c?.base?.v;
    const marks = [
      { v: base, shape: "tick", color: P.highlight, tip: [name, `untuned native (T = 1): ${fmt(t, base)}`] },
      ...top.map((p, r) => ({ r, v: c.pol[p].v, shape: r === 0 ? "dot" : "ring", color: r === 0 ? P.good : P.muted,
        tip: [name, `${r === 0 ? "best" : `#${r + 1}`}: ${SNAME[p]}, ${fmt(t, c.pol[p].v)}`] })),
    ].sort((m1, m2) => (m1.r === 0) - (m2.r === 0)); // best drawn last so rings never hide it
    const bv = top.length ? c.pol[top[0]].v : null;
    return { label: arm === "sc" ? "+ SC" : "no SC", group: k === 0 ? m.label : null, marks,
      link: base != null && bv != null ? [0, marks.length - 1] : null,
      note: base != null && bv != null ? fmtD(t, bv - base) : "", noteColor: P.muted };
  }));
  return (
    <Frame kicker="Figure · sensitivity to the sampler" title="How much tuning the sampler buys, without and with SC"
      subtitle="For each method: its three best tuned samplers (green: the best) and the untuned native sampler (yellow tick). A short distance from the tick to the green dot means tuning matters less."
      controls={taskPills}
      note={`Stage-2 validation ${METRIC[t]} (256 prompts, 128 NFE), higher is better; top 3 of the 8 samplers every model gets (anchoring excluded). Label: best tuned minus untuned native.`}>
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "dot", color: P.good, label: "best tuned" }, { shape: "ring", color: P.muted, label: "2nd and 3rd" }, { line: true, wide: true, color: P.highlight, label: "untuned native" }]} />
        <Rows task={t} rows={rows} tip={tip} axisLabel={`${METRIC[t]} →`} />
        {tip.el}
      </div>
    </Frame>
  );
}

export const ContinuousGain = withVizTheme(ContinuousGainInner);
export const DiscreteGain = withVizTheme(DiscreteGainInner);
export const HybridGain = withVizTheme(HybridGainInner);
export const AnchoringContinuous = withVizTheme(AnchoringInner);
export const DiscreteSamplers = withVizTheme(SamplersInner);
export const HybridVsPure = withVizTheme(HybridVsPureInner);
export const TuningRanking = withVizTheme(RankingInner);
export const TuningSensitivity = withVizTheme(SensitivityInner);
export const HybridOverBase = withVizTheme(HybridOverBaseInner);
