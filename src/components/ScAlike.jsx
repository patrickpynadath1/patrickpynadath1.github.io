// Companion to Figure S: how alike the six methods are. Two plots, without and with self
// conditioning. Each overlays the six methods' curves for one statistic of the per-position
// entropy, on top of a shaded region that spans from the lowest to the highest method.
// A thin shaded region means the methods look alike. Same data as ScOrdering.jsx.
import { useRef, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";
import { Legend, useTip } from "./ScRerun.jsx";
import DATA from "../data/sc_ordering.json";

const TASKS = [{ id: "text8", label: "text8" }, { id: "tinystories", label: "TinyStories" }];
// Discrete methods: neutral ink, dashed and dotted. Continuous methods: solid and colored.
const FAMS = [
  { id: "masked", label: "Masked", color: () => P.text, dash: "6 3" },
  { id: "uniform", label: "Uniform", color: () => P.muted, dash: "1.5 3.5" },
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "simplex", label: "Simplex", color: () => P.orange2 },
  { id: "spherical", label: "Spherical", color: () => P.candi },
  { id: "vmf", label: "vMF", color: () => P.pinkText },
];
const LOGV = { text8: Math.log(35), tinystories: Math.log(10000) }; // entropy in nats = normalised entropy x log V
const METRICS = [
  { id: "gap", label: "75th − 25th percentile", desc: "the gap between the 75th and 25th percentile of entropy across a sample's positions" },
  { id: "mean", label: "Mean entropy", desc: "the mean entropy across a sample's positions" },
  { id: "std", label: "Std across positions", desc: "the standard deviation of entropy across a sample's positions" },
];

function load(task, metric, sc) {
  const lv = LOGV[task];
  const series = FAMS.map((f) => {
    const c = DATA.cases.find((x) => x.task === task && x.family === f.id && Boolean(x.sc) === sc);
    return c ? { f, v: c.all[metric].map((v) => (v == null ? null : v * lv)) } : null;
  }).filter(Boolean);
  const K = Math.min(...series.map((s) => s.v.length));
  const band = Array.from({ length: K }, (_, k) => {
    const vs = series.map((s) => s.v[k]).filter((v) => v != null);
    return vs.length ? { lo: Math.min(...vs), hi: Math.max(...vs) } : null;
  });
  const widths = band.filter(Boolean).map((b) => b.hi - b.lo);
  return { series, band, K, width: widths.reduce((a, b) => a + b, 0) / widths.length };
}

function Plot({ data, sc, yMax, tip }) {
  const svg = useRef(null);
  const [hk, setHk] = useState(null);
  const { series, band, K } = data;
  const W = 400, H = 230, L = 38, R = 10, T = 8, B = 32;
  const x = (k) => L + (k / (K - 1)) * (W - L - R);
  const y = (v) => T + (1 - Math.min(v, yMax) / yMax) * (H - T - B);
  const line = (s) => {
    let d = "", pen = false;
    s.v.slice(0, K).forEach((v, k) => { if (v == null) { pen = false; return; } d += `${pen ? "L" : "M"}${x(k)},${y(v)}`; pen = true; });
    return d;
  };
  const idx = band.map((b, k) => (b ? k : null)).filter((k) => k != null);
  const area = idx.length ? `M${idx.map((k) => `${x(k)},${y(band[k].hi)}`).join("L")}L${[...idx].reverse().map((k) => `${x(k)},${y(band[k].lo)}`).join("L")}Z` : "";
  const move = (e) => {
    const r = svg.current.getBoundingClientRect();
    const k = Math.max(0, Math.min(K - 1, Math.round((((e.clientX - r.left) / r.width) * W - L) / (W - L - R) * (K - 1))));
    setHk(k);
    const b = band[k];
    tip.show(e, [`${sc ? "SC" : "no SC"} · t = ${(k / (K - 1)).toFixed(2)}`, b ? `shaded region: ${b.lo.toFixed(2)} to ${b.hi.toFixed(2)} nats` : "shaded region: –",
      ...series.map((s) => `${s.f.label}: ${s.v[k] == null ? "–" : s.v[k].toFixed(2)}`)]);
  };
  const tick = (v) => (Number.isInteger(v) ? v.toFixed(0) : v.toFixed(2));
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: sc ? P.good : P.bad, marginBottom: 4 }}>
        {sc ? "With self conditioning" : "No self conditioning"}
      </div>
      <svg ref={svg} viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, overflow: "visible" }}
        onMouseMove={move} onMouseLeave={() => { setHk(null); tip.hide(); }} role="img"
        aria-label={`${sc ? "With" : "Without"} self conditioning: six methods' curves over sampling time, with the region between the lowest and highest shaded`}>
        {[0, yMax / 2, yMax].map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 5} y={y(t) + 3} fill={P.dim2} fontSize={9.5} textAnchor="end">{tick(t)}</text>
          </g>
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map((t) => <text key={t} x={x(t * (K - 1))} y={H - B + 13} fill={P.dim2} fontSize={9.5} textAnchor="middle">{t}</text>)}
        <text x={(L + W - R) / 2} y={H - 4} fill={P.dim2} fontSize={9.5} textAnchor="middle">sampling time (0 = start, 1 = end)</text>
        {area && <path d={area} fill={rgba(sc ? P.good : P.bad, 0.14)} />}
        {series.map((s) => <path key={s.f.id} d={line(s)} fill="none" stroke={s.f.color()} strokeWidth={1.5} strokeDasharray={s.f.dash} strokeLinejoin="round" />)}
        {hk != null && <line x1={x(hk)} x2={x(hk)} y1={T} y2={H - B} stroke={P.muted} strokeWidth={0.8} />}
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="transparent" />
      </svg>
    </div>
  );
}

function AlikeInner({ figure = "Figure S′" }) {
  const [task, setTask] = useState("text8");
  const [metric, setMetric] = useState("gap");
  const tip = useTip();
  const m = METRICS.find((x) => x.id === metric);
  const none = load(task, metric, false), sc = load(task, metric, true);
  const top = Math.max(...[none, sc].flatMap((d) => d.band.filter(Boolean).map((b) => b.hi)));
  const yMax = Math.ceil(top * 2) / 2;
  return (
    <Frame
      kicker={`${figure} · how alike the methods are`}
      title="The six methods on one plot, without and with self conditioning"
      subtitle={`Each line is one method: ${m.desc}, in nats, over sampling time. The shaded region runs from the lowest to the highest method, so a thin region means the methods look alike. Averaged over sampling, the region is ${none.width.toFixed(2)} nats wide without SC and ${sc.width.toFixed(2)} with SC.`}
      controls={<>
        <Pills value={task} onChange={setTask} options={TASKS} />
        <Pills value={metric} onChange={setMetric} options={METRICS} />
      </>}
      note="The same six curves as Figure S, drawn together. Grey dashed and dotted lines: the discrete methods. Colored solid lines: the continuous methods. Each model's native sampler at temperature 1, 128 network calls, no tuning, one training seed. Hover for each method's value."
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={FAMS.map((f) => ({ line: true, wide: true, color: f.color(), dash: f.dash, label: f.label }))} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "18px 24px" }}>
          <Plot data={none} sc={false} yMax={yMax} tip={tip} />
          <Plot data={sc} sc yMax={yMax} tip={tip} />
        </div>
        {tip.el}
      </div>
    </Frame>
  );
}

export const ScAlike = withVizTheme(AlikeInner);
export default ScAlike;
