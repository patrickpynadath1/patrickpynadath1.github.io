// The hybrids' learned CDCD clocks next to the pure continuous ones (same analysis, same
// style as CdcdSchedules.jsx). Data: src/data/hybrid_clocks.json (48 hybrids, built by
// build_data.py from sc-questions/hybrid_schedules.json) and src/data/cdcd_schedules.json.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import { useTip, Legend } from "./ScRerun.jsx";
import HYB from "../data/hybrid_clocks.json";
import SCHED from "../data/cdcd_schedules.json";

const METHODS = [
  { id: "gaussian", label: "Gaussian" }, { id: "simplex", label: "Simplex" },
  { id: "spherical", label: "Spherical" }, { id: "vmf", label: "vMF" },
];
const TASKS = [
  { id: "text8", label: "text8" }, { id: "tinystories", label: "TinyStories" }, { id: "sudoku_hard", label: "Sudoku", overfit: true },
];
const SERIES = [
  // Family colors used across the post: pure discrete red, pure continuous blue, hybrid purple.
  // The two hybrids are two shades of purple (dashes are already used for the SC arm).
  { id: "pure", label: "continuous alone", color: () => P.duo },
  { id: "masked", label: "masked hybrid", color: () => P.accent },
  { id: "uniform", label: "uniform hybrid", color: () => P.accentDim },
];
const ARMS = [{ id: "none", label: "no SC", dash: "5 4" }, { id: "sc", label: "SC", dash: null }];
const VIEWS = {
  t: { label: "Clock t(u)", axis: "continuous view's time t", hi: 1 },
  rank: { label: "Clean-token rank", axis: "normalized rank of the clean token", hi: 0.55 },
  error: { label: "Token error", axis: "nearest-token error", hi: 1 },
  loss: { label: "Loss vs u", axis: "held-out loss / total", hi: 1.05 },
};

// One curve as {u: [...], y: [...]} for a series, task, method and arm.
function curve(series, task, method, arm, view) {
  const k = series === "pure" ? `${task}|${method}|${arm}` : `${task}|${series}-${method}|${arm}`;
  if (series === "pure") {
    if (view === "t") { const s = SCHED.schedules[k]; return s && { u: s.u, y: s.t }; }
    if (view === "loss") { const b = SCHED.bins[k]; return b && { u: b.map((x) => x.u), y: b.map((x) => x.loss) }; }
    const c = SCHED.corruption[k]; return c && { u: c.u, y: c[view] };
  }
  const c = HYB.clocks[k];
  if (!c) return null;
  if (view === "t") return { u: c.u, y: c.t };
  if (view === "loss") return { u: c.bins.map((x) => x.u), y: c.bins.map((x) => x.loss) };
  return { u: c.cu, y: c[view] };
}
const stats = (series, task, method, arm) => (series === "pure" ? HYB.pure_stats[`${task}|${method}|${arm}`] : HYB.clocks[`${task}|${series}-${method}|${arm}`]);

function at(cv, u) {
  if (!cv) return null;
  const { u: us, y } = cv;
  if (u <= us[0]) return y[0];
  for (let i = 1; i < us.length; i++) if (us[i] >= u) {
    const a = (u - us[i - 1]) / (us[i] - us[i - 1] || 1);
    return y[i - 1] + a * (y[i] - y[i - 1]);
  }
  return y[y.length - 1];
}

function Panel({ task, method, view, tip }) {
  const W = 300, H = 210, L = 34, T = 8, R = 8, B = 26;
  const pw = W - L - R, ph = H - T - B;
  const V = VIEWS[view];
  const x = (u) => L + u * pw;
  const y = (v) => T + ph - (Math.min(v, V.hi) / V.hi) * ph;
  const curves = SERIES.flatMap((s) => ARMS.map((a) => ({ s, a, cv: curve(s.id, task.id, method, a.id, view) }))).filter((c) => c.cv);
  const [hu, setHu] = useState(null);
  const move = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const u = Math.max(0, Math.min(1, ((e.clientX - r.left) / r.width * W - L) / pw));
    setHu(u);
    tip.show(e, [`${task.label} · ${METHODS.find((m) => m.id === method).label} · u = ${u.toFixed(3)}`,
      ...curves.map((c) => `${c.s.label}, ${c.a.label}: ${at(c.cv, u).toFixed(3)}`)]);
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: task.overfit ? P.dim2 : P.text }}>{task.label}{task.overfit ? " (overfit clocks)" : ""}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, touchAction: "pan-y" }}
        onMouseMove={move} onClick={move} onMouseLeave={() => { setHu(null); tip.hide(); }}>
        <rect x={L} y={T} width={pw} height={ph} fill={rgba(P.panel, 0.6)} rx={4} />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={T} y2={T + ph} stroke={P.grid} strokeWidth={0.6} />
            <text x={x(v)} y={T + ph + 13} fill={P.dim} fontSize={10} textAnchor="middle">{v}</text>
            {v * V.hi <= V.hi && <text x={L - 5} y={y(v * V.hi) + 3.5} fill={P.dim} fontSize={10} textAnchor="end">{+(v * V.hi).toFixed(2)}</text>}
            <line x1={L} x2={L + pw} y1={y(v * V.hi)} y2={y(v * V.hi)} stroke={P.grid} strokeWidth={0.6} />
          </g>
        ))}
        {(view === "t" || view === "loss") && <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke={P.faint} strokeDasharray="3 4" />}
        {curves.map((c) => (
          <path key={c.s.id + c.a.id} fill="none" stroke={c.s.color()} strokeWidth={c.a.id === "sc" ? 2.2 : 1.7} strokeDasharray={c.a.dash}
            d={c.cv.u.map((u, i) => `${i ? "L" : "M"}${x(u).toFixed(1)},${y(c.cv.y[i]).toFixed(1)}`).join("")} />
        ))}
        {hu != null && <line x1={x(hu)} x2={x(hu)} y1={T} y2={T + ph} stroke={P.text} strokeWidth={0.8} opacity={0.5} />}
        {hu != null && curves.map((c) => <circle key={c.s.id + c.a.id} cx={x(hu)} cy={y(at(c.cv, hu))} r={2.8} fill={c.s.color()} />)}
        <text x={L + pw} y={H - 1} fill={P.muted} fontSize={10} textAnchor="end">coordinator time u (clean → noise)</text>
      </svg>
    </div>
  );
}

function StatTable({ method }) {
  const cell = { padding: "4px 6px", textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const f3 = (v) => (v == null ? "–" : v < 0.001 ? "<0.001" : v.toFixed(3));
  return (
    <div style={{ overflowX: "auto", marginTop: 14 }}>
      <table style={{ display: "table", boxShadow: "none", borderRadius: 0, width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: 11, color: P.text, minWidth: 520 }}>
        <thead>
          <tr style={{ color: P.muted, borderBottom: `1px solid ${P.line2}` }}>
            <th style={{ ...cell, textAlign: "left" }}>{METHODS.find((m) => m.id === method).label}, no SC / SC</th>
            <th style={cell}>R² of loss vs u</th>
            <th style={cell}>t at u = 0.01</th>
            <th style={cell}>u at token error 50%</th>
            <th style={cell}>u at rank 0.25</th>
          </tr>
        </thead>
        <tbody>
          {TASKS.filter((t) => !t.overfit).map((t) => SERIES.map((s, si) => {
            const a = stats(s.id, t.id, method, "none"), b = stats(s.id, t.id, method, "sc");
            const pair = (k, fn) => `${fn(a?.[k])} / ${fn(b?.[k])}`;
            return (
              <tr key={t.id + s.id} style={{ borderBottom: `1px solid ${P.line}`, background: s.id === "pure" ? "transparent" : rgba(s.color(), 0.06) }}>
                <td style={{ ...cell, textAlign: "left" }}>
                  {si === 0 && <span style={{ color: P.muted, marginRight: 6 }}>{t.label}</span>}
                  <span style={{ color: s.color(), fontWeight: 700 }}>{s.label}</span>
                </td>
                <td style={cell}>{pair("r2_val", (v) => (v == null ? "–" : v.toFixed(3)))}</td>
                <td style={{ ...cell, color: s.id === "pure" ? P.text : P.bad, fontWeight: s.id === "pure" ? 400 : 700 }}>{pair("t01", (v) => (v == null ? "–" : v.toFixed(3)))}</td>
                <td style={cell}>{pair("id50", f3)}</td>
                <td style={cell}>{pair("rank25", f3)}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
    </div>
  );
}

function HybridClocksInner() {
  const [method, setMethod] = useState("spherical");
  const [view, setView] = useState("t");
  const [sudoku, setSudoku] = useState(false);
  const tip = useTip();
  return (
    <Frame
      kicker="Figure P · the hybrids' clocks"
      title="Where do the hybrids' learned clocks put the continuous view?"
      subtitle="Blue: the continuous model alone. Purple: the same continuous method inside a masked hybrid (lighter) or a uniform hybrid (darker). Dashed: no SC. Solid: SC. In every hybrid the clock warps only the continuous view; the discrete view runs on u itself."
      controls={<>
        <Pills value={method} onChange={setMethod} options={METHODS.map((m) => ({ id: m.id, label: m.label }))} />
        <Pills value={view} onChange={setView} options={Object.entries(VIEWS).map(([id, v]) => ({ id, label: v.label }))} />
        <Pills value={sudoku ? "on" : "off"} onChange={(v) => setSudoku(v === "on")} options={[{ id: "off", label: "Text tasks" }, { id: "on", label: "Include Sudoku" }]} />
      </>}
      note={`Y axis: ${VIEWS[view].axis}. Clock t(u): the continuous view's noise time at coordinator time u (t = 1 is pure noise); the hybrids jump to t ≈ 0.99 between u = 0 and the first grid point, u = 0.01. Rank and token error: 8,192 clean tokens per point corrupted by the continuous view alone at t(u) and decoded against its learned embeddings (0.5 rank = no information). Loss: the hybrid's whole held-out loss in 20 bins of u, normalized; the clock can only make the continuous part linear. Final 20,000-step checkpoints, one training seed each. Table: held-out data, text tasks.`}
    >
      <div ref={tip.box} style={{ position: "relative" }}>
        <Legend items={[...SERIES.map((s) => ({ line: true, color: s.color(), label: s.label, wide: true })),
          { line: true, color: P.muted, dash: "5 4", label: "no SC", wide: true }, { line: true, color: P.muted, label: "SC", wide: true }]} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "14px 20px" }}>
          {TASKS.filter((t) => sudoku || !t.overfit).map((t) => <Panel key={t.id} task={t} method={method} view={view} tip={tip} />)}
        </div>
        <StatTable method={method} />
        {tip.el}
      </div>
    </Frame>
  );
}

export const HybridClocks = withVizTheme(HybridClocksInner);
