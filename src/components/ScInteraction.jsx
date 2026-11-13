// Mock of the "one layout" for Part 3: how the information path, self conditioning and the
// sampler interact. Rows: recipes of one path family (continuous, discrete or hybrid).
// Columns: without SC, with SC, on one shared axis. Marks: the untuned native sampler and
// the three sampler families that ranked highest on validation.
// Same data as Figure R' (src/data/sc_rerun.json). TinyStories is left out until its re-tune lands.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import { useTip, Legend, POL } from "./ScRerun.jsx";
import DATA from "../data/sc_rerun.json";

const CASES = DATA.cases, TK = DATA.meta.tasks;
const TASKS = [{ id: "sudoku", label: "Sudoku" }, { id: "text8", label: "text8" }];
const NAME = { gaussian: "Gaussian", simplex: "Simplex", spherical: "Spherical", vmf: "vMF", masked: "Masked", uniform: "Uniform" };
const CONT = ["gaussian", "simplex", "spherical", "vmf"];
const PATHS = [
  { id: "continuous", label: "Continuous", groups: [{ label: null, rows: CONT.map((c) => ({ family: "continuous", disc: null, cont: c, name: NAME[c] })) }] },
  { id: "discrete", label: "Discrete", groups: [{ label: null, rows: ["masked", "uniform"].map((d) => ({ family: "discrete", disc: d, cont: null, name: NAME[d] })) }] },
  { id: "hybrid", label: "Hybrid", groups: ["masked", "uniform"].map((d) => ({
    label: `${NAME[d]} view`, rows: CONT.map((c) => ({ family: "hybrid", disc: d, cont: c, name: `${NAME[d]} + ${NAME[c]}` })),
  })) },
];
const FAM_COLOR = { native: () => P.mdlm, renoising: () => P.accent, eb: () => P.warn, psi: () => P.candi, anchoring: () => P.pinkText };
const FAM_LABEL = { native: "native", renoising: "renoise", eb: "entropy-bounded", psi: "Ψ", anchoring: "anchoring" };

// What a cell shows. Each mode returns the untuned score, the tuned marks, and the number at the right.
const NON_COMMIT = ["native", "native_greedy", "renoising", "renoising_greedy", "psi_corruption", "psi_controller"];
const bestOf = (c, ps) => ps.filter((p) => c.pol[p]).reduce((a, p) => (a == null || c.pol[p].v > c.pol[a].v ? p : a), null);
const MODES = {
  // Test scores: the three sampler families that ranked highest on validation.
  top3: {
    split: "test",
    cell: (c) => (c.base?.test == null || !c.fams ? null : {
      base: c.base.test,
      marks: c.fams.map((f, k) => ({ v: f.test, key: f.family, color: FAM_COLOR[f.family](), name: `#${k + 1} on validation: ${POL[f.member]}` })),
      note: Math.max(...c.fams.map((f) => f.test)) - c.base.test,
    }),
    legend: (seen) => Object.keys(FAM_COLOR).filter((k) => seen.has(k)).map((k) => ({ shape: "dot", color: FAM_COLOR[k](), label: FAM_LABEL[k] })),
  },
  // Validation scores: the best sampler that never commits a position against one that does.
  // Sudoku shows entropy-bounded commitment. text8 shows random anchoring, because
  // entropy-bounded samplers do poorly on text8 for every model.
  commit: {
    split: "validation",
    cell: (c) => {
      const k = COMMIT[c.task], free = bestOf(c, NON_COMMIT), com = bestOf(c, k.members);
      if (c.base?.v == null || !free || !com) return null;
      return {
        base: c.base.v,
        marks: [{ v: c.pol[free].v, key: "free", color: P.muted, name: `best non-committing sampler: ${POL[free]}` },
          { v: c.pol[com].v, key: k.key, color: k.color(), name: `${k.label}: ${POL[com]}` }],
        note: c.pol[com].v - c.pol[free].v,
      };
    },
    legend: (seen, task) => [{ shape: "dot", color: P.muted, label: "best non-committing" }, { shape: "dot", color: COMMIT[task].color(), label: COMMIT[task].label }],
  },
};
const COMMIT = {
  sudoku: { key: "eb", members: ["eb_greedy", "eb_churn"], color: () => P.warn, label: "entropy-bounded commitment", what: "the better entropy-bounded sampler, which commits the positions the model is surest about" },
  text8: { key: "anc", members: ["anchor_native", "anchor_renoising"], color: () => P.pinkText, label: "random anchoring", what: "the better random-anchoring sampler, which commits random positions on a schedule" },
};

const find = (task, q, arm) => CASES.find((c) => c.task === task && c.arm === arm && c.family === q.family && (c.disc ?? null) === q.disc && (c.cont ?? null) === q.cont);
const unit = (t) => (t === "sudoku" ? 100 : 1);
const score = (t, v) => (t === "sudoku" ? `${(v * 100).toFixed(1)}%` : v.toFixed(2));
const delta = (t, d) => `${d >= 0 ? "+" : "−"}${t === "sudoku" ? `${Math.abs(d * 100).toFixed(1)} pts` : Math.abs(d).toFixed(2)}`;

function ticksFor(lo, hi, n = 4) {
  const raw = (hi - lo || 1) / n, mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(Math.round(v * 1e6) / 1e6);
  return out;
}

// One column of the grid: every recipe of the chosen path, for one arm (no SC or SC).
function Column({ task, path, arm, lo, hi, tip, mode }) {
  const LW = 118, NW = 62, W = 400, LANE = 8, ROWH = 4 * LANE + 14, HEAD = 18, TOP = 4, BOT = 30;
  const x = (v) => LW + ((v - lo) / (hi - lo)) * (W - LW - NW);
  const items = [];
  let yy = TOP;
  for (const g of path.groups) {
    if (g.label) { items.push({ header: g.label, y: yy }); yy += HEAD; }
    for (const q of g.rows) { items.push({ q, y: yy }); yy += ROWH; }
  }
  const plotBottom = yy, H = plotBottom + BOT;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: P.accent, marginBottom: 4 }}>
        {arm === "sc" ? "With self conditioning" : "No self conditioning"}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, overflow: "visible" }}>
        {ticksFor(lo, hi).map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={TOP} y2={plotBottom} stroke={P.grid} strokeWidth={0.6} />
            <text x={x(t)} y={plotBottom + 12} fill={P.dim2} fontSize={9} textAnchor="middle">{task === "sudoku" ? `${t}%` : t}</text>
          </g>
        ))}
        {task === "text8" && mode.split === "test" && TK.text8.heldout <= hi && (
          <g>
            <line x1={x(TK.text8.heldout)} x2={x(TK.text8.heldout)} y1={TOP} y2={plotBottom} stroke={P.muted} strokeWidth={0.8} strokeDasharray="3 3" />
            <text x={x(TK.text8.heldout) - 3} y={TOP + 7} fill={P.dim2} fontSize={8.5} textAnchor="end">real text</text>
          </g>
        )}
        <text x={(LW + W - NW) / 2} y={plotBottom + 25} fill={P.dim2} fontSize={9} textAnchor="middle">
          {`${mode.split} ${task === "sudoku" ? "accuracy" : "valid words per sample"}`}
        </text>
        {items.map((it, i) => {
          if (it.header) return <text key={i} x={0} y={it.y + 12} fill={P.dim2} fontSize={9} letterSpacing="0.08em">{it.header.toUpperCase()}</text>;
          const c = find(task, it.q, arm), cell = c && mode.cell(c);
          if (!cell) return null;
          const u = cell.base, d = cell.note, big = Math.abs(d) > TK[task].noise;
          const lane = (k) => it.y + 8 + k * LANE;
          const who = `${it.q.name}${arm === "sc" ? " + SC" : ""}`;
          return (
            <g key={i}>
              {i % 2 === 0 && <rect x={0} y={it.y} width={W} height={ROWH} fill={rgba(P.dim, 0.06)} />}
              <text x={LW - 8} y={it.y + ROWH / 2 + 3} fill={P.text} fontSize={10} fontWeight={600} textAnchor="end">{it.q.name}</text>
              {cell.marks.map((m, k) => <line key={k} x1={x(u * unit(task))} x2={x(m.v * unit(task))} y1={lane(k + 1)} y2={lane(k + 1)} stroke={rgba(m.color, 0.45)} strokeWidth={1.4} />)}
              <g {...tip.hit([`${who} · untuned native (T = 1)`, `${mode.split}: ${score(task, u)}`])}>
                <circle cx={x(u * unit(task))} cy={lane(0)} r={8} fill="transparent" />
                <rect x={x(u * unit(task)) - 4} y={lane(0) - 4} width={8} height={8} rx={1.5} fill={P.highlight} stroke={P.bg} strokeWidth={1.5} />
              </g>
              {cell.marks.map((m, k) => (
                <g key={k} {...tip.hit([`${who} · ${m.name}`, `${mode.split}: ${score(task, m.v)}`, `vs untuned: ${delta(task, m.v - u)}`])}>
                  <circle cx={x(m.v * unit(task))} cy={lane(k + 1)} r={8} fill="transparent" />
                  <circle cx={x(m.v * unit(task))} cy={lane(k + 1)} r={4.2} fill={m.color} stroke={P.bg} strokeWidth={1.5} />
                </g>
              ))}
              <text x={W - NW + 8} y={it.y + ROWH / 2 + 3} fill={!big ? P.dim2 : d > 0 ? P.good : P.bad} fontSize={9.5} fontWeight={600}>{delta(task, d)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// figure: the kicker label. path: the path family shown first. mode: "top3" or "commit".
// The commit view is about continuous models only, so it has no path buttons.
function InteractionInner({ figure = "Mock", path: firstPath = "continuous", mode: modeId = "top3" }) {
  const mode = MODES[modeId], commit = modeId === "commit";
  const [task, setTask] = useState("sudoku");
  const [pathId, setPathId] = useState(commit ? "continuous" : firstPath);
  const tip = useTip();
  const path = PATHS.find((p) => p.id === pathId);
  // One shared axis for both columns, so a mark's position means the same thing left and right.
  const vals = [], seen = new Set(); // seen: mark kinds on screen, for the legend
  for (const g of path.groups) for (const q of g.rows) for (const arm of ["none", "sc"]) {
    const c = find(task, q, arm), cell = c && mode.cell(c);
    if (cell) { vals.push(cell.base, ...cell.marks.map((m) => m.v)); cell.marks.forEach((m) => seen.add(m.key)); }
  }
  let lo = Math.min(...vals) * unit(task), hi = Math.max(...vals) * unit(task);
  if (task === "text8" && !commit) hi = Math.max(hi, TK.text8.heldout);
  const pad = (hi - lo || 1) * 0.06; lo -= pad; hi += pad;
  if (task === "sudoku") { lo = Math.max(0, lo); hi = Math.min(100, hi); }
  const cols = ["none", "sc"].map((arm) => <Column key={arm} task={task} path={path} arm={arm} lo={lo} hi={hi} tip={tip} mode={mode} />);
  const noise = task === "sudoku" ? "3 points" : "0.5 words";
  return (
    <Frame
      kicker={commit ? `${figure} · self conditioning × sampler, continuous paths` : `${figure} · information path × self conditioning × sampler`}
      title={commit ? "Committing tokens in a continuous model, without and with self conditioning" : "How the path, self conditioning and the sampler interact"}
      subtitle={commit
        ? `Rows: the pure continuous recipes. Columns: the same recipe without and with self conditioning, on one shared axis. Square: the untuned native sampler. Dots, top to bottom: the best sampler that never commits a position, then ${COMMIT[task].what}. Sudoku shows entropy-bounded commitment. text8 shows random anchoring, because entropy-bounded samplers do poorly there for every model.`
        : "Rows: recipes from one path family. Columns: the same recipe without and with self conditioning, on one shared axis. Square: the untuned native sampler. Dots: the three sampler families that ranked highest on validation, each with its best tuned settings. Read across a row for what self conditioning changes, inside a cell for how much the sampler matters, and down a column for how the paths differ."}
      controls={<>
        <Pills value={task} onChange={setTask} options={TASKS} />
        {!commit && <Pills value={pathId} onChange={setPathId} options={PATHS.map((p) => ({ id: p.id, label: p.label }))} />}
      </>}
      note={commit
        ? `Stage-2 validation scores (256 prompts) at 128 network calls, 8-layer models, one training seed. Number at the right of each cell: the committing sampler minus the best non-committing sampler, colored when it is beyond the noise level for one seed (${noise}).`
        : `Test scores at 128 network calls, 8-layer models, one training seed, mean of two sampling seeds. Number at the right of each cell: the best of the three families on test minus the untuned sampler, colored when it is beyond the noise level for one seed (${noise}). Picking the best on test is optimistic; it is shown only to size the sampler's effect.`}
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ shape: "square", color: P.highlight, label: "untuned native" }, ...mode.legend(seen, task)]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px 24px" }}>{cols}</div>
        {tip.el}
      </div>
    </Frame>
  );
}

export const ScInteraction = withVizTheme(InteractionInner);
export default ScInteraction;
