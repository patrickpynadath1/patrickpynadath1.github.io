// How SC changes recovery across positions: per sampling step, the entropy of the model's
// prediction at each position, summarised over positions, with vs without SC.
// Source: sc-ordering-20261112 (native sampler, T = 1, 128 NFE, untuned), stats from
// raw/sc-ordering/position_stats.json. Masked models: all positions (revealed + still masked).
import { useRef, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT } from "./SelfCondDepth.jsx";
import { Legend, useTip } from "./ScRerun.jsx";
import DATA from "../data/sc_ordering.json";

// Sudoku is left out of this figure on purpose: it is shown for text8 and TinyStories only.
const TASKS = [{ id: "text8", label: "text8" }, { id: "tinystories", label: "TinyStories" }];
const FAMS = [
  { id: "masked", label: "Masked" }, { id: "uniform", label: "Uniform" }, { id: "gaussian", label: "Gaussian" },
  { id: "simplex", label: "Simplex" }, { id: "spherical", label: "Spherical" }, { id: "vmf", label: "vMF" },
];
// entropy in nats = normalised entropy x log V; std and quantile gaps scale the same way
export const LOGV = { sudoku: Math.log(12), text8: Math.log(35), tinystories: Math.log(10000) };

const METRICS = [
  { id: "std", label: "Std across positions", unit: "nats", desc: "standard deviation of entropy across a sample's positions" },
  { id: "gap", label: "75th − 25th percentile", unit: "nats", desc: "gap between the 75th and 25th percentile of entropy across a sample's positions" },
];

function values(c, metric, lv) {
  const a = c.all;
  return a[metric].map((v) => (v == null ? null : v * lv));
}
const num = (v) => (v == null ? "–" : v.toFixed(2));

function Panel({ fam, task, metric, tip, yMax }) {
  const none = DATA.cases.find((c) => c.task === task && c.family === fam.id && !c.sc);
  const sc = DATA.cases.find((c) => c.task === task && c.family === fam.id && c.sc);
  const [hk, setHk] = useState(null);
  const svg = useRef(null);
  if (!none || !sc) return null;
  const lv = LOGV[task], K = none.K, m = METRICS.find((x) => x.id === metric);
  const a = values(none, metric, lv), b = values(sc, metric, lv);
  const W = 300, H = 150, L = 34, R = 8, T = 8, B = 22;
  const x = (k) => L + (k / (K - 1)) * (W - L - R);
  const y = (v) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const path = (arr) => {
    let d = "", pen = false;
    arr.forEach((v, k) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(k)},${y(v)}`; pen = true; });
    return d;
  };
  const move = (e) => {
    const r = svg.current.getBoundingClientRect();
    const sx = ((e.clientX - r.left) / r.width) * W;
    const k = Math.max(0, Math.min(K - 1, Math.round(((sx - L) / (W - L - R)) * (K - 1))));
    setHk(k);
    tip.show(e, [`${fam.label} · t = ${(k / (K - 1)).toFixed(2)} (step ${k})`,
      `${m.label}: no SC ${num(a[k])}, SC ${num(b[k])}${m.unit ? ` ${m.unit}` : ""}`,
      `mean entropy: no SC ${num(none.all.mean[k] * lv)}, SC ${num(sc.all.mean[k] * lv)} nats`]);
  };
  const fmtTick = (t) => (Number.isInteger(t) ? t.toFixed(0) : t.toFixed(2));
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.text }}>{fam.label}</div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, overflow: "visible" }}
        onMouseMove={move} onMouseLeave={() => { setHk(null); tip.hide(); }} role="img"
        aria-label={`${fam.label}: ${m.desc}, over sampling time, with and without SC`}>
        {[0, yMax / 2, yMax].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 5} y={y(t) + 3} fill={P.dim2} fontSize={8.5} textAnchor="end">{fmtTick(t)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <text key={t} x={x(t * (K - 1))} y={H - 6} fill={P.dim2} fontSize={8.5} textAnchor="middle">{t}</text>
        ))}
        <path d={path(a)} fill="none" stroke={P.bad} strokeWidth={2} strokeDasharray="4 3" strokeLinejoin="round" />
        <path d={path(b)} fill="none" stroke={P.candi} strokeWidth={2} strokeLinejoin="round" />
        {hk != null && <line x1={x(hk)} x2={x(hk)} y1={T} y2={H - B} stroke={P.muted} strokeWidth={0.8} />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
      </svg>
    </div>
  );
}

function OrderingInner() {
  const [task, setTask] = useState("text8");
  const [metric, setMetric] = useState("gap"); // mean entropy was dropped as a view: it was the least informative
  const tip = useTip();
  const cs = DATA.cases.filter((c) => c.task === task);
  const npos = Math.round(cs[0]?.positions ?? 0);
  const lv = LOGV[task], m = METRICS.find((x) => x.id === metric);
  const top = Math.max(...cs.flatMap((c) => values(c, metric, lv).filter((v) => v != null)));
  const yMax = Math.ceil(top * 2) / 2;
  return (
    <Frame
      kicker="Figure S · recovery across positions"
      title="How recovery unfolds across positions"
      subtitle={`At every sampling step, the entropy of the model's prediction at each position (in nats), summarised across a sample's positions and averaged over samples. Shown: ${m.desc}. Time runs from 0 (start of sampling) to 1 (last step). The maximum entropy is log 35 = 3.56 nats for text8 and log 10,000 = 9.21 for TinyStories; the axis is set per task and statistic.`}
      controls={<>
        <Pills value={task} onChange={setTask} options={TASKS} />
        <Pills value={metric} onChange={setMetric} options={METRICS} />
      </>}
      note={`Each model's native sampler at temperature 1, 128 network calls, no tuning; the same prompts and seed for both arms. ${task === "sudoku" ? "512 puzzles, blank cells only (about 51 per puzzle)" : task === "text8" ? "512 samples, all 256 positions" : `256 prompts, generated positions up to the end of the story (about ${npos} per sample; padding after it is dropped)`}. Statistics are computed within each sample, then averaged over samples. Masked models: all positions, revealed (fixed, entropy 0) and still masked.${metric === "cv" ? ` Std / mean is not drawn once mean entropy falls below ${CV_FLOOR} nats${yMax < top ? `, and is clipped at ${yMax}` : ""}.` : ""} Step 0 has no previous prediction to feed back, so differences there come from the two models themselves. One training seed per model.`}
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[{ line: true, wide: true, color: P.candi, label: "SC" }, { line: true, wide: true, color: P.bad, dash: "4 3", label: "no SC" }]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px 20px" }}>
          {FAMS.map((f) => <Panel key={f.id} fam={f} task={task} metric={metric} tip={tip} yMax={yMax} />)}
        </div>
        <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.dim2, marginTop: 6, textAlign: "right" }}>sampling time →</div>
        {tip.el}
      </div>
    </Frame>
  );
}

export const ScOrdering = withVizTheme(OrderingInner);
export default ScOrdering;
