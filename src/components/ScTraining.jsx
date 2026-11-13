// Training curves of every model in Part 2 (Figure K).
// Data: src/data/sc_training.json, built by build_data.py from each model's Lightning metrics.csv:
// train/loss as 100-step means, val/nll every 1,000 steps (every 4,000 for the Gaussian-512 runs),
// and the sample metric the trainer logged during training.
import { useEffect, useRef, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import DATA from "../data/sc_training.json";

const MODELS = DATA.models;
const TASKS = [{ id: "sudoku", label: "Sudoku" }, { id: "text8", label: "text8" }, { id: "tinystories", label: "TinyStories" }];
const CONT = [["gaussian", "Gaussian"], ["simplex", "Simplex"], ["spherical", "Spherical"], ["vmf", "vMF"]];
const DISC = [["masked", "Masked"], ["uniform", "Uniform"]];
const ARMS = {
  none: { label: "no SC", color: () => P.dim2 },
  sc: { label: "SC", color: () => P.candi },
  depth: { label: "16 layers", color: () => P.highlight },
};
const SAMPLE_LABEL = { sudoku: "accuracy (in-training sampler)", text8: "valid words / sample (in-training sampler)", tinystories: "ref_w1 (in-training sampler)" };
const METRICS = [
  { id: "train", label: "Train loss" }, { id: "val", label: "Val loss" }, { id: "sample", label: "Samples" },
];

const get = (task, family, disc, cont, arm) =>
  MODELS.find((m) => !m.dup && m.key[0] === task && m.key[1] === family && m.key[2] === disc && m.key[3] === cont && m.key[4] === arm);

// Panels for each group: a title and the models drawn in it.
function panels(group, task, depth) {
  const pair = (family, disc, cont, arms) => arms.map((arm) => ({ arm, m: get(task, family, disc, cont, arm) }));
  if (group === "discrete") return DISC.map(([d, l]) => ({ title: l, lines: pair("discrete", d, null, ["none", "sc"]) }));
  if (group === "depth") {
    const arms = ["none", "sc", "depth"];
    return [
      { title: "Gaussian", lines: pair("continuous", null, "gaussian", arms) },
      ...DISC.map(([d, l]) => ({ title: l, lines: pair("discrete", d, null, arms) })),
    ];
  }
  if (group === "continuous") return CONT.map(([c, l]) => ({ title: l, lines: pair("continuous", null, c, ["none", "sc"]) }));
  return DISC.flatMap(([d, dl]) => CONT.map(([c, cl]) => ({ title: `${dl} + ${cl}`, lines: pair("hybrid", d, c, ["none", "sc"]) })));
}

function useWidth(init = 300) {
  const ref = useRef(null);
  const [w, setW] = useState(init);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(([e]) => setW(Math.max(200, Math.floor(e.contentRect.width))));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return [ref, w];
}

const fmtV = (v) => (v == null ? "–" : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 10 ? v.toFixed(2) : v.toFixed(3));

function niceTicks(lo, hi, n) {
  const step0 = (hi - lo) / n || 1;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const e = step0 / mag;
  const step = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) out.push(+v.toFixed(10));
  return out;
}

function Panel({ title, lines, metric, task }) {
  const [ref, w] = useWidth();
  const [hover, setHover] = useState(null);
  const H = 170, L = 44, R = 10, T = 8, B = 24;
  const series = lines.map((l) => ({ ...l, pts: l.m ? l.m[metric] : [] })).filter((l) => l.pts.length);
  // Train loss starts far above where it settles; the y range starts at step 1,000 so the
  // differences that last are visible (the first 1,000 steps are drawn, clipped at the top).
  const inRange = series.flatMap((s) => s.pts.filter(([st]) => metric !== "train" || st >= 1000).map(([, v]) => v));
  if (!inRange.length) {
    return (
      <div ref={ref} style={{ minWidth: 0 }}>
        <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: P.text }}>{title}</div>
        <div style={{ height: H, display: "grid", placeItems: "center", fontFamily: FONT, fontSize: 11, color: P.dim, border: `1px dashed ${P.line}`, borderRadius: 8, marginTop: 6 }}>
          not logged during training
        </div>
      </div>
    );
  }
  let lo = Math.min(...inRange), hi = Math.max(...inRange);
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.05 || 0.1;
  lo -= pad; hi += pad;
  const x = (s) => L + (s / 20000) * (w - L - R);
  const y = (v) => T + (1 - (Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * (H - T - B);
  const yt = niceTicks(lo, hi, 4);
  const path = (pts) => pts.map(([s, v], i) => `${i ? "L" : "M"}${x(s).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const nearest = (pts, s) => pts.reduce((a, p) => (Math.abs(p[0] - s) < Math.abs(a[0] - s) ? p : a), pts[0]);
  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const s = Math.max(0, Math.min(20000, ((e.clientX - r.left - L) / (w - L - R)) * 20000));
    setHover({ s, px: e.clientX - r.left });
  };
  const rows = hover && series.map((l) => ({ l, p: nearest(l.pts, hover.s) }));
  const final = series.map((l) => ({ l, v: l.pts[l.pts.length - 1][1] }));
  return (
    <div ref={ref} style={{ minWidth: 0, position: "relative" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", fontFamily: FONT }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: P.text }}>{title}</span>
        <span style={{ fontSize: 10, color: P.dim2 }}>
          final {final.map((f, i) => <span key={i} style={{ marginLeft: 6, whiteSpace: "nowrap" }}><span style={{ display: "inline-block", width: 7, height: 7, borderRadius: 7, background: ARMS[f.l.arm].color(), marginRight: 3 }} /><span style={{ color: P.muted }}>{fmtV(f.v)}</span></span>)}
        </span>
      </div>
      <svg width={w} height={H} style={{ display: "block", fontFamily: FONT, touchAction: "pan-y" }}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} onTouchStart={(e) => onMove(e.touches[0] ? { clientX: e.touches[0].clientX, currentTarget: e.currentTarget } : e)}>
        {yt.map((v) => (
          <g key={v}>
            <line x1={L} x2={w - R} y1={y(v)} y2={y(v)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 5} y={y(v) + 3} fontSize={9} fill={P.dim} textAnchor="end">{fmtV(v)}</text>
          </g>
        ))}
        {[0, 5000, 10000, 15000, 20000].map((s) => (
          <text key={s} x={x(s)} y={H - 8} fontSize={9} fill={P.dim} textAnchor={s === 0 ? "start" : s === 20000 ? "end" : "middle"}>{s / 1000}k</text>
        ))}
        {metric === "train" && <line x1={x(2500)} x2={x(2500)} y1={T} y2={H - B} stroke={P.faint} strokeDasharray="2 3" />}
        {series.map((l, i) => (
          <path key={i} d={path(l.pts)} fill="none" stroke={ARMS[l.arm].color()} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {metric !== "train" && series.map((l, i) => l.pts.map(([s, v]) => (
          <circle key={`${i}-${s}`} cx={x(s)} cy={y(v)} r={2.4} fill={ARMS[l.arm].color()} stroke={P.bg} strokeWidth={1} />
        )))}
        {hover && (
          <g>
            <line x1={x(hover.s)} x2={x(hover.s)} y1={T} y2={H - B} stroke={P.muted} strokeWidth={0.8} />
            {rows.map(({ l, p }, i) => <circle key={i} cx={x(p[0])} cy={y(p[1])} r={3.5} fill={ARMS[l.arm].color()} stroke={P.bg} strokeWidth={1.5} />)}
          </g>
        )}
      </svg>
      {hover && (
        <div style={{
          position: "absolute", top: 22, left: hover.px > w / 2 ? 8 : undefined, right: hover.px > w / 2 ? undefined : 8, pointerEvents: "none",
          background: P.inset, border: `1px solid ${P.line2}`, borderRadius: 8, padding: "6px 9px", fontFamily: FONT, fontSize: 10.5, lineHeight: 1.5,
          color: P.text, boxShadow: `0 6px 18px rgba(${P.shadowRgb}, 0.3)`,
        }}>
          <div style={{ fontWeight: 700 }}>step {Math.round(rows[0].p[0]).toLocaleString()}</div>
          {rows.map(({ l, p }, i) => (
            <div key={i} style={{ color: P.muted }}>
              <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 8, background: ARMS[l.arm].color(), marginRight: 5 }} />
              {ARMS[l.arm].label}: <span style={{ color: P.text }}>{fmtV(p[1])}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// `depth`: the Q1 version (Gaussian, masked and uniform with their 16-layer models). Without it, the
// figure covers the 8-layer models only; the 16-layer models appear only in Q1.
function TrainingInner({ depth = false }) {
  const [task, setTask] = useState("text8");
  const [group, setGroup] = useState(depth ? "depth" : "continuous");
  const [metric, setMetric] = useState("val");
  const ps = panels(group, task, depth);
  const groups = [{ id: "continuous", label: "Continuous" }, { id: "discrete", label: "Discrete" }, { id: "hybrid", label: "Hybrids" }];
  return (
    <Frame
      kicker={depth ? "Figure B · training curves of the depth comparison" : "Figure L · training curves"}
      title={depth ? "Training and validation curves: 8 layers, SC and 16 layers" : "Training and validation curves of every 8-layer model"}
      subtitle={`Each panel is one recipe on one task; lines are its variants (${depth ? "no SC, SC, 16 layers" : "no SC, SC"}). Panels have their own y axis: each recipe's loss is its own objective, so compare lines within a panel, not across panels.`}
      controls={<>
        <Pills value={task} onChange={setTask} options={TASKS} />
        {!depth && <Pills value={group} onChange={setGroup} options={groups} />}
        <Pills value={metric} onChange={setMetric} options={METRICS} />
      </>}
      note={metric === "train"
        ? "Training loss (the recipe's training objective, on the training batch), averaged over 100 steps. The y range is set by steps 1,000 to 20,000; the warmup ends at step 2,500 (dotted line). Learning rate is 3e-4 after warmup for every model, with no decay."
        : metric === "val"
          ? "Validation loss (val/nll: the recipe's own loss or bound on held-out data), logged every 1,000 steps, every 4,000 for the Gaussian-512 models."
          : `The sample metric the trainer logged during training: ${SAMPLE_LABEL[task]}. It uses a fixed, untuned sampler on a small sample, so it is not the tuned score in the other figures. TinyStories logged ref_w1 only for the Gaussian-512 runs (lower is better).`}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "4px 0 10px", fontFamily: FONT, fontSize: 11, color: P.muted }}>
        {Object.entries(ARMS).filter(([a]) => depth || a !== "depth").map(([a, s]) => (
          <span key={a} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 18, height: 2, background: s.color(), display: "inline-block" }} />{s.label}
          </span>
        ))}
        <span style={{ color: P.dim2 }}>panel header: final value per line</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "18px 22px" }}>
        {ps.map((p) => <Panel key={`${task}-${group}-${p.title}`} {...p} metric={metric} task={task} />)}
      </div>
    </Frame>
  );
}

export const TrainingCurves = withVizTheme(TrainingInner);
