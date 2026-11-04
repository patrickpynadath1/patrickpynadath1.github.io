// Learned CDCD noise schedules for the continuous recipes: a loss-linearity
// check, the schedules themselves, and final scores with / without SC.
// Data: src/data/cdcd_schedules.json (candi scripts/analysis/cdcd_schedule_report.py,
// final 20k checkpoints) and src/data/cdcd_performance.json (final results).
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import SCHED from "../data/cdcd_schedules.json";
import PERF from "../data/cdcd_performance.json";

const METHODS = [
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "simplex", label: "Simplex", color: () => P.warn },
  { id: "spherical", label: "Spherical", color: () => P.duo },
  { id: "vmf", label: "vMF", color: () => P.pinkText },
];
const TASKS = [
  { id: "text8", label: "text8", color: () => P.duo, fmt: (v) => v.toFixed(1), metric: "unique valid words / sample",
    domain: [8, 16], ticks: [8, 10, 12, 14, 16], tick: (v) => `${v}` },
  { id: "tinystories", label: "TinyStories (bytes)", color: () => P.highlight, fmt: (v) => v.toFixed(2), metric: "reference BLEU",
    domain: [5, 9], ticks: [5, 6, 7, 8, 9], tick: (v) => `${v}` },
  { id: "sudoku_hard", label: "Sudoku", overfit: true, color: () => P.accent, fmt: (v) => `${(v * 100).toFixed(1)}%`, metric: "solve rate",
    domain: [0, 1], ticks: [0, 0.25, 0.5, 0.75, 1], tick: (v) => `${Math.round(v * 100)}%` },
];
const VARIANTS = [
  { id: "none", label: "no SC", dash: "5 4" },
  { id: "sc", label: "SC", dash: null },
];
const methodOf = (id) => METHODS.find((m) => m.id === id);
const key = (task, method, variant) => `${task}|${method}|${variant}`;
const pct = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`;

// Mean absolute gap between measured normalized loss and the straight line, in % of total loss.
function linearityGap(bins) {
  return (100 * bins.reduce((s, b) => s + Math.abs(b.loss - b.u), 0)) / bins.length;
}

const path = (xs, ys, x, y) => xs.map((v, i) => `${i ? "L" : "M"}${x(v).toFixed(1)},${y(ys[i]).toFixed(1)}`).join("");

// ─── Figure E: does CDCD linearize the loss? ─────────────────────────────────
function LinearityInner() {
  const [method, setMethod] = useState("gaussian");
  const [view, setView] = useState("loss");
  const [hover, setHover] = useState(null);
  const [split, setSplit] = useState("train");
  const [showSudoku, setShowSudoku] = useState(false);
  const tasks = TASKS.filter((t) => showSudoku || !t.overfit);
  const BINS = split === "train" && Object.keys(SCHED.bins_train || {}).length ? SCHED.bins_train : SCHED.bins;
  const gx = 30, T = 30, L = 46, ph = 170;
  const pw = (720 - L - 14 - gx * (tasks.length - 1)) / tasks.length;

  return (
    <Frame
      kicker="Figure E · does the learned clock work?"
      title="Does the learned clock make loss rise in a straight line?"
      subtitle="CDCD fits the expected loss as a function of noise level and samples time through its inverse. If the fit is right, measured loss climbs linearly in the warped time u, so every stretch of u carries the same share of the loss."
      controls={<>
        <Pills value={method} onChange={setMethod} options={METHODS.map((m) => ({ id: m.id, label: m.label, color: m.color }))} />
        <Pills value={split} onChange={setSplit} options={[{ id: "train", label: "Training data" }, { id: "val", label: "Held-out data" }]} />
        <Pills value={showSudoku ? "on" : "off"} onChange={(v) => setShowSudoku(v === "on")}
          options={[{ id: "off", label: "Text tasks" }, { id: "on", label: "Include Sudoku (overfit)" }]} />
        <Pills value={view} onChange={setView} options={[{ id: "loss", label: "Loss vs u" }, { id: "slope", label: "Slope" }, { id: "spread", label: "Spread" }]} />
      </>}
      note="Measured: mean cross entropy of the final checkpoint in 20 equal-width bins of u, 128 sequences per bin from the training set (what CDCD fits) or the held-out validation set, divided by the fitted total so the ideal is the diagonal. Bars are ±2 standard errors; the shaded band is ±1 standard deviation across sequences. Slope: bin-to-bin increase relative to the average, flat at 1 means uniform. Spread: standard deviation of per-sequence loss in each bin (hover a point for nats)."
    >
      <svg viewBox="0 0 720 290" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {tasks.map((t, ti) => {
          const x0 = L + ti * (pw + gx);
          const x = (u) => x0 + u * pw;
          const spreadMax = Math.max(0.05, ...VARIANTS.flatMap((v) => (BINS[key(t.id, method, v.id)] || []).map((b) => b.std))) * 1.1;
          const yLo = 0, yHi = view === "loss" ? 1.05 : view === "slope" ? 2.5 : spreadMax;
          const y = (v) => T + ph - ((Math.max(yLo, Math.min(yHi, v)) - yLo) / (yHi - yLo)) * ph;
          const ticks = view === "loss" ? [0, 0.5, 1] : view === "slope" ? [0, 1, 2] : [0, +(yHi / 2).toFixed(2), +(yHi * 0.95).toFixed(2)];
          return (
            <g key={t.id}>
              <text x={x0 + pw / 2} y={T - 12} fill={t.overfit ? P.dim : P.text} fontSize={12} fontWeight={600} textAnchor="middle">{t.label}{t.overfit ? " (overfit)" : ""}</text>
              <rect x={x0} y={T} width={pw} height={ph} fill={rgba(P.panel, 0.6)} rx={4} />
              {ticks.map((v) => (
                <g key={v}>
                  <line x1={x0} x2={x0 + pw} y1={y(v)} y2={y(v)} stroke={P.grid} strokeWidth={0.6} />
                  {(ti === 0 || view === "spread") && <text x={x0 - 4} y={y(v) + 3} fill={P.dim} fontSize={8.5} textAnchor="end">{v}</text>}
                </g>
              ))}
              {[0, 0.5, 1].map((u) => <text key={u} x={x(u)} y={T + ph + 14} fill={P.dim} fontSize={9} textAnchor="middle">{u}</text>)}
              {view === "loss" && <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke={P.muted} strokeDasharray="3 4" />}
              {view === "slope" && <line x1={x0} x2={x0 + pw} y1={y(1)} y2={y(1)} stroke={P.muted} strokeDasharray="3 4" />}
              {VARIANTS.map((v) => {
                const bins = BINS[key(t.id, method, v.id)];
                if (!bins) return <text key={v.id} x={x0 + pw / 2} y={T + ph / 2} fill={P.dim} fontSize={10} textAnchor="middle">no data</text>;
                const c = v.id === "sc" ? P.candi : P.muted;
                if (view === "spread") {
                  return (
                    <g key={v.id}>
                      <path d={path(bins.map((b) => b.u), bins.map((b) => b.std), x, y)} fill="none" stroke={c} strokeWidth={1.6} strokeDasharray={v.dash} />
                      {bins.map((b) => (
                        <circle key={b.u} cx={x(b.u)} cy={y(b.std)} r={2.4} fill={c}>
                          <title>{`${v.label}, u = ${b.u}: std ${b.std_nats.toFixed(3)} nats (mean ${b.loss_nats.toFixed(3)})`}</title>
                        </circle>
                      ))}
                    </g>
                  );
                }
                if (view === "loss") {
                  const band = [...bins.map((b) => [b.u, b.loss + b.std]), ...[...bins].reverse().map((b) => [b.u, b.loss - b.std])];
                  return (
                    <g key={v.id}>
                      <path d={band.map(([u, l], i) => `${i ? "L" : "M"}${x(u).toFixed(1)},${y(l).toFixed(1)}`).join("") + "Z"} fill={c} opacity={0.1} />
                      {bins.map((b) => (
                        <line key={b.u} x1={x(b.u)} x2={x(b.u)} y1={y(b.loss - 2 * b.se)} y2={y(b.loss + 2 * b.se)} stroke={c} strokeWidth={1} opacity={0.6} />
                      ))}
                      <path d={path(bins.map((b) => b.u), bins.map((b) => b.loss), x, y)} fill="none" stroke={c} strokeWidth={1.6} strokeDasharray={v.dash} />
                      {bins.map((b) => <circle key={b.u} cx={x(b.u)} cy={y(b.loss)} r={2.4} fill={c} />)}
                    </g>
                  );
                }
                const slopes = bins.map((b, i) => {
                  const prev = i ? bins[i - 1].loss : 0, du = i ? b.u - bins[i - 1].u : b.u;
                  return (b.loss - prev) / du;
                });
                return (
                  <g key={v.id}>
                    <path d={path(bins.map((b) => b.u), slopes, x, y)} fill="none" stroke={c} strokeWidth={1.6} strokeDasharray={v.dash} />
                    {bins.map((b, i) => <circle key={b.u} cx={x(b.u)} cy={y(slopes[i])} r={2.2} fill={c} />)}
                  </g>
                );
              })}
              {VARIANTS.map((v, vi) => {
                const bins = BINS[key(t.id, method, v.id)];
                if (!bins) return null;
                return (
                  <text key={v.id} x={x0 + 6} y={T + 14 + vi * 13} fill={v.id === "sc" ? P.candi : P.muted} fontSize={9.5}
                    onMouseEnter={() => setHover(key(t.id, method, v.id))} onMouseLeave={() => setHover(null)}>
                    {v.label}: off by {linearityGap(bins).toFixed(1)}%
                  </text>
                );
              })}
            </g>
          );
        })}
        <text x={L + (tasks.length * pw + (tasks.length - 1) * gx) / 2} y={T + ph + 32} fill={P.muted} fontSize={10.5} textAnchor="middle">global time u (clean → noise)</text>
        <text transform={`translate(12, ${T + ph / 2}) rotate(-90)`} fill={P.muted} fontSize={10.5} textAnchor="middle">
          {view === "loss" ? "loss / fitted total" : view === "slope" ? "local slope / mean slope" : "std across sequences / total"}
        </text>
        <g transform={`translate(${L}, 282)`}>
          <line x1={0} x2={18} y1={-4} y2={-4} stroke={P.muted} strokeDasharray="5 4" strokeWidth={1.6} />
          <text x={24} fill={P.muted} fontSize={10.5}>no SC</text>
          <line x1={90} x2={108} y1={-4} y2={-4} stroke={P.candi} strokeWidth={1.6} />
          <text x={114} fill={P.muted} fontSize={10.5}>SC</text>
          <text x={170} fill={P.dim} fontSize={10}>"off by" = mean gap from the ideal line, in % of total loss{hover ? "" : ""}</text>
        </g>
      </svg>
      <LinearityTable bins={BINS} split={split} />
    </Frame>
  );
}

function LinearityTable({ bins: BINS, split }) {
  const cw = 118, ch = 24, L = 140, T = 26;
  return (
    <svg viewBox="0 0 720 150" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, marginTop: 8 }}>
      <text x={0} y={12} fill={P.dim} fontSize={9.5} letterSpacing="0.1em">ALL 24 MODELS · MEAN GAP FROM A STRAIGHT LINE · {split === "train" ? "TRAINING DATA" : "HELD-OUT DATA"}</text>
      {TASKS.map((t, ti) => VARIANTS.map((v, vi) => (
        <text key={t.id + v.id} opacity={t.overfit ? 0.5 : 1} x={L + (ti * 2 + vi) * (cw / 2 + 8) + cw / 4} y={T + 8} fill={v.id === "sc" ? P.candi : P.dim} fontSize={9} textAnchor="middle">
          {t.label.slice(0, 6)} {v.label}
        </text>
      )))}
      {METHODS.map((m, mi) => (
        <g key={m.id}>
          <circle cx={6} cy={T + 22 + mi * ch} r={4} fill={m.color()} />
          <text x={16} y={T + 26 + mi * ch} fill={P.text} fontSize={11}>{m.label}</text>
          {TASKS.map((t, ti) => VARIANTS.map((v, vi) => {
            const bins = BINS[key(t.id, m.id, v.id)];
            const g = bins ? linearityGap(bins) : null;
            const x0 = L + (ti * 2 + vi) * (cw / 2 + 8);
            const col = g == null ? P.dim : g < 2 ? P.good : g < 5 ? P.warn : P.bad;
            return (
              <g key={t.id + v.id} opacity={t.overfit ? 0.45 : 1}>
                <rect x={x0} y={T + 12 + mi * ch} width={cw / 2} height={ch - 5} rx={5} fill={rgba(col, 0.16)} />
                <text x={x0 + cw / 4} y={T + 26 + mi * ch} fill={col} fontSize={10.5} textAnchor="middle">{g == null ? "–" : `${g.toFixed(1)}%`}</text>
              </g>
            );
          }))}
        </g>
      ))}
    </svg>
  );
}

// ─── Figure F: the learned schedules ─────────────────────────────────────────
const PARAM = {
  gaussian: { key: "sigma", label: "noise level σ", domain: [0, 1] },
  simplex: { key: "t", label: "physical time t (α = 1 − t)", domain: [0, 1] },
  spherical: { key: "keep_rate", label: "keep rate α", domain: [0, 1] },
  vmf: { key: "kappa", label: "concentration κ", domain: null },
};

function SchedulesInner() {
  const [method, setMethod] = useState("gaussian");
  const [view, setView] = useState("param");
  const [hu, setHu] = useState(null);
  const [showSudoku, setShowSudoku] = useState(false);
  const L = 56, T = 16, W = 420, H = 300;
  const spec = PARAM[method];
  const curves = [];
  for (const t of TASKS.filter((tk) => showSudoku || !tk.overfit)) for (const v of VARIANTS) {
    const c = SCHED.schedules[key(t.id, method, v.id)];
    if (c) curves.push({ t, v, c });
  }
  const yKey = view === "param" ? spec.key : view === "time" ? "t" : "fit";
  const xKey = view === "fit" ? "t" : "u";
  let dom = view === "param" ? spec.domain : [0, 1];
  if (!dom) {
    const all = curves.flatMap(({ c }) => c[yKey]);
    dom = [0, Math.max(...all) * 1.05];
  }
  const x = (v) => L + v * W;
  const y = (v) => T + H - ((v - dom[0]) / (dom[1] - dom[0])) * H;
  const yLabel = view === "param" ? spec.label : view === "time" ? "physical time t" : "fitted loss / total";
  const xLabel = view === "fit" ? "physical time t (clean → noise)" : "global time u (clean → noise)";
  const idx = hu == null ? null : Math.round(hu * (curves[0]?.c.u.length - 1 || 0));

  return (
    <Frame
      kicker="Figure F · the learned schedules"
      title="Where each method spends its training time"
      subtitle="Each line is a schedule learned by CDCD for one task. Dashed: no SC. Solid: with SC. A steep early rise means the model is pushed to high noise quickly, so most training happens at heavy corruption."
      controls={<>
        <Pills value={method} onChange={setMethod} options={METHODS.map((m) => ({ id: m.id, label: m.label, color: m.color }))} />
        <Pills value={view} onChange={setView} options={[
          { id: "param", label: "Noise parameter" }, { id: "time", label: "Clock t(u)" }, { id: "fit", label: "Loss curve" },
        ]} />
        <Pills value={showSudoku ? "on" : "off"} onChange={(v) => setShowSudoku(v === "on")}
          options={[{ id: "off", label: "Text tasks" }, { id: "on", label: "Include Sudoku (overfit)" }]} />
      </>}
      note="Noise parameters differ across methods (σ, α, κ), so compare shapes within a method, not heights across methods. Loss curve: the CDCD fit of expected loss against physical time, normalized to 1. Extracted from raw (non-EMA) checkpoint state of the final 20k-step models."
    >
      <svg viewBox="0 0 720 360" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}
        onMouseLeave={() => setHu(null)}>
        <rect x={L} y={T} width={W} height={H} fill={rgba(P.panel, 0.6)} rx={4}
          onMouseMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setHu(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
          }} />
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v} pointerEvents="none">
            <line x1={x(v)} x2={x(v)} y1={T} y2={T + H} stroke={P.grid} strokeWidth={0.6} />
            <text x={x(v)} y={T + H + 14} fill={P.dim} fontSize={9.5} textAnchor="middle">{v}</text>
            <line x1={L} x2={L + W} y1={y(dom[0] + v * (dom[1] - dom[0]))} y2={y(dom[0] + v * (dom[1] - dom[0]))} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 6} y={y(dom[0] + v * (dom[1] - dom[0])) + 3} fill={P.dim} fontSize={9.5} textAnchor="end">
              {(dom[0] + v * (dom[1] - dom[0])).toFixed(dom[1] > 2 ? 0 : 2)}
            </text>
          </g>
        ))}
        {view !== "param" || spec.key === "t" ? <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke={P.muted} strokeDasharray="3 4" pointerEvents="none" /> : null}
        {curves.map(({ t, v, c }) => (
          <path key={t.id + v.id} d={path(c[xKey], c[yKey], x, y)} fill="none" stroke={t.color()} strokeWidth={v.id === "sc" ? 2.4 : 1.8}
            strokeDasharray={v.dash} opacity={0.95} pointerEvents="none" />
        ))}
        {idx != null && view !== "fit" && (
          <g pointerEvents="none">
            <line x1={x(hu)} x2={x(hu)} y1={T} y2={T + H} stroke={P.text} strokeWidth={0.8} opacity={0.5} />
            {curves.map(({ t, v, c }) => <circle key={t.id + v.id} cx={x(c.u[idx])} cy={y(c[yKey][idx])} r={3} fill={t.color()} />)}
          </g>
        )}
        <text x={L + W / 2} y={T + H + 34} fill={P.muted} fontSize={10.5} textAnchor="middle">{xLabel}</text>
        <text transform={`translate(14, ${T + H / 2}) rotate(-90)`} fill={P.muted} fontSize={10.5} textAnchor="middle">{yLabel}</text>

        <g transform={`translate(${L + W + 30}, ${T + 6})`}>
          <text fill={methodOf(method).color()} fontSize={13} fontWeight={700}>{methodOf(method).label}</text>
          {TASKS.map((t, i) => (
            <g key={t.id} transform={`translate(0, ${28 + i * 46})`}>
              <text fill={t.color()} fontSize={11.5} fontWeight={600} opacity={t.overfit && !showSudoku ? 0.4 : 1}>{t.label}{t.overfit ? (showSudoku ? " (overfit)" : " (hidden)") : ""}</text>
              {VARIANTS.map((v, vi) => {
                const c = SCHED.schedules[key(t.id, method, v.id)];
                const val = c && idx != null ? c[yKey][idx] : null;
                return (
                  <g key={v.id} transform={`translate(0, ${15 + vi * 14})`}>
                    <line x1={0} x2={16} y1={-3} y2={-3} stroke={t.color()} strokeWidth={2} strokeDasharray={v.dash} />
                    <text x={22} fill={P.muted} fontSize={10}>{v.label}</text>
                    {val != null && view !== "fit" && <text x={150} fill={P.text} fontSize={10} textAnchor="end">{val.toFixed(val > 5 ? 0 : 3)}</text>}
                  </g>
                );
              })}
            </g>
          ))}
          <text y={178} fill={P.dim} fontSize={10}>{idx != null && view !== "fit" ? `at u = ${hu.toFixed(2)}` : "Hover the plot to read values."}</text>
        </g>
      </svg>
    </Frame>
  );
}

// ─── Figure F2: schedules in token terms ─────────────────────────────────────
// Corruption measured with each path's own forward kernel and learned codebook
// along its learned clock: argmax decoding error and normalized clean-token rank.
const METRICS = {
  error: { label: "Token error", axis: "argmax decoding error", base: (V) => 1 - 1 / V, baseLabel: "random guess" },
  rank: { label: "Clean-token rank", axis: "normalized rank of clean token", base: () => 0.5, baseLabel: "no information" },
};

function CorruptionInner() {
  const [mode, setMode] = useState("compare");
  const [method, setMethod] = useState("gaussian");
  const [variant, setVariant] = useState("sc");
  const [metric, setMetric] = useState("rank");
  const [showSudoku, setShowSudoku] = useState(false);
  const tasks = TASKS.filter((t) => showSudoku || !t.overfit);
  const gx = 30, T = 30, L = 46, ph = 200;
  const pw = (720 - L - 14 - gx * (tasks.length - 1)) / tasks.length;
  const M = METRICS[metric];

  const series = (t) => {
    if (mode === "compare") {
      return METHODS.map((m) => ({ id: m.id, c: SCHED.corruption[key(t.id, m.id, variant)], color: m.color(), dash: null, label: m.label }));
    }
    return VARIANTS.map((v) => ({ id: v.id, c: SCHED.corruption[key(t.id, method, v.id)], color: v.id === "sc" ? P.candi : P.muted, dash: v.dash, label: v.label }));
  };

  return (
    <Frame
      kicker="Figure F2 · the schedules in token terms"
      title="How fast does each method destroy the token?"
      subtitle="Two ways to measure corruption along each learned clock. Token error: how often the nearest embedding is the wrong token. Clean-token rank: where the true token sits among all candidates (0 = top, 0.5 = no information). The dashed diagonal is a schedule that would spend equal time at every level."
      controls={<>
        <Pills value={mode} onChange={setMode} options={[{ id: "compare", label: "Compare methods" }, { id: "method", label: "One method" }]} />
        {mode === "compare"
          ? <Pills value={variant} onChange={setVariant} options={[{ id: "none", label: "no SC" }, { id: "sc", label: "SC" }]} />
          : <Pills value={method} onChange={setMethod} options={METHODS.map((m) => ({ id: m.id, label: m.label, color: m.color }))} />}
        <Pills value={metric} onChange={setMetric} options={Object.entries(METRICS).map(([id, m]) => ({ id, label: m.label }))} />
        <Pills value={showSudoku ? "on" : "off"} onChange={(v) => setShowSudoku(v === "on")}
          options={[{ id: "off", label: "Text tasks" }, { id: "on", label: "Include Sudoku (overfit)" }]} />
      </>}
      note={`Measured by simulation on the final checkpoints: ${SCHED.corruption_meta.samples_per_point.toLocaleString()} clean tokens per point drawn uniformly over the vocabulary, corrupted with each method's own forward process at t(u), then decoded against its learned embeddings (simplex: the largest coordinate). Rank is (rank − 1)/(V − 1). For Gaussian (One method view), the gold dotted line is the codebase's closed-form rank (embedding_table_rank) on the same embeddings, as a check. Raw (non-EMA) weights.`}
    >
      <svg viewBox="0 0 720 300" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {tasks.map((t, ti) => {
          const x0 = L + ti * (pw + gx);
          const ss = series(t);
          const V = ss.find((s) => s.c)?.c.vocab || 2;
          const base = M.base(V);
          const yHi = metric === "error" ? 1 : 0.55;
          const x = (u) => x0 + u * pw;
          const y = (v) => T + ph - (Math.min(v, yHi) / yHi) * ph;
          return (
            <g key={t.id}>
              <text x={x0 + pw / 2} y={T - 12} fill={t.overfit ? P.dim : P.text} fontSize={12} fontWeight={600} textAnchor="middle">
                {t.label}{t.overfit ? " (overfit)" : ""} <tspan fill={P.dim} fontWeight={400} fontSize={10}>V={V}</tspan>
              </text>
              <rect x={x0} y={T} width={pw} height={ph} fill={rgba(P.panel, 0.6)} rx={4} />
              {[0, 0.25, 0.5, 0.75, 1].filter((v) => v <= yHi).map((v) => (
                <g key={v}>
                  <line x1={x0} x2={x0 + pw} y1={y(v)} y2={y(v)} stroke={P.grid} strokeWidth={0.6} />
                  {ti === 0 && <text x={x0 - 6} y={y(v) + 3} fill={P.dim} fontSize={9} textAnchor="end">{v}</text>}
                </g>
              ))}
              {[0, 0.5, 1].map((u) => <text key={u} x={x(u)} y={T + ph + 14} fill={P.dim} fontSize={9} textAnchor="middle">{u}</text>)}
              <line x1={x0} x2={x0 + pw} y1={y(base)} y2={y(base)} stroke={P.muted} strokeDasharray="1 3" />
              <text x={x0 + 6} y={y(base) - 5} fill={P.dim} fontSize={9}>{M.baseLabel}</text>
              <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(base)} stroke={P.muted} strokeDasharray="4 4" opacity={0.7} />
              {ss.map((s) => s.c && (
                <g key={s.id}>
                  <path d={path(s.c.u, s.c[metric], x, y)} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} />
                  {mode === "method" && metric === "rank" && s.c.rank_formula && s.id === "sc" &&
                    <path d={path(s.c.u, s.c.rank_formula, x, y)} fill="none" stroke={P.highlight} strokeWidth={1.8} strokeDasharray="1 4" strokeLinecap="round" />}
                </g>
              ))}
            </g>
          );
        })}
        <text x={L + (tasks.length * pw + (tasks.length - 1) * gx) / 2} y={T + ph + 32} fill={P.muted} fontSize={10.5} textAnchor="middle">global time u (clean → noise)</text>
        <text transform={`translate(12, ${T + ph / 2}) rotate(-90)`} fill={P.muted} fontSize={10.5} textAnchor="middle">{M.axis}</text>
        <g transform={`translate(${L}, 292)`}>
          {(mode === "compare" ? METHODS.map((m) => ({ id: m.id, label: m.label, color: m.color(), dash: null }))
            : VARIANTS.map((v) => ({ id: v.id, label: v.label, color: v.id === "sc" ? P.candi : P.muted, dash: v.dash }))).map((s, i) => (
            <g key={s.id} transform={`translate(${i * 120}, 0)`}>
              <line x1={0} x2={18} y1={-4} y2={-4} stroke={s.color} strokeWidth={2.2} strokeDasharray={s.dash} />
              <text x={24} fill={P.muted} fontSize={10.5}>{s.label}</text>
            </g>
          ))}
          {mode === "method" && method === "gaussian" && metric === "rank" && (
            <g transform="translate(300, 0)">
              <line x1={0} x2={18} y1={-4} y2={-4} stroke={P.highlight} strokeWidth={1.8} strokeDasharray="1 4" strokeLinecap="round" />
              <text x={24} fill={P.dim} fontSize={10}>closed form (SC)</text>
            </g>
          )}
          <g transform="translate(500, 0)">
            <line x1={0} x2={18} y1={-4} y2={-4} stroke={P.muted} strokeDasharray="4 4" />
            <text x={24} fill={P.dim} fontSize={10}>uniform pace</text>
          </g>
        </g>
      </svg>
    </Frame>
  );
}

// ─── Figure G: performance with and without SC ───────────────────────────────
function PerformanceInner() {
  const [task, setTask] = useState("text8");
  const t = TASKS.find((tk) => tk.id === task);
  const L = 150, R = 490, T = 30, rowH = 52;
  const x = (v) => L + ((v - t.domain[0]) / (t.domain[1] - t.domain[0])) * (R - L);
  const get = (m, arm) => PERF.rows.find((r) => r.task === task && r.method === m && r.arm === arm);
  const H = T + rowH * METHODS.length + 30;

  return (
    <Frame
      kicker="Figure G · performance"
      title="How much SC adds to each continuous method"
      subtitle="Grey ring: no SC. Green dot: with SC. Same 8-layer backbone, same learned CDCD clock, best sampler on validation."
      controls={<Pills value={task} onChange={setTask} options={TASKS.map((tk) => ({ id: tk.id, label: tk.id === "tinystories" ? "TinyStories BPE" : tk.overfit ? `${tk.label} (overfit)` : tk.label }))} />}
      note={`${t.overfit ? "Sudoku models overfit the training puzzles, so their learned clocks do not match held-out loss; shown for completeness. " : ""}Metric: ${t.metric}. Final held-out scores; thin bars show the two evaluation seeds. ${task === "tinystories" ? "TinyStories: 10k-token BPE run on MI210 GPUs (a second, independent run); all five samplers tried. Simplex is still training." : task === "text8" ? "Renoising samplers were not run for simplex, spherical and vMF on text8." : ""}`}
    >
      <svg viewBox={`0 0 720 ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {t.ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={T - 8} y2={T + rowH * METHODS.length - 8} stroke={P.grid} strokeWidth={0.6} />
            <text x={x(v)} y={T + rowH * METHODS.length + 8} fill={P.dim} fontSize={9.5} textAnchor="middle">{t.tick(v)}</text>
          </g>
        ))}
        <text x={R + 40} y={T - 12} fill={P.dim} fontSize={9.5} letterSpacing="0.08em">GAIN FROM SC</text>
        {METHODS.map((m, i) => {
          const a = get(m.id, "none"), b = get(m.id, "sc");
          const cy = T + i * rowH + rowH / 2 - 8;
          if (!a || !b || a.pending || b.pending) return (
            <g key={m.id}>
              <rect x={8} y={cy - rowH / 2 + 5} width={704} height={rowH - 10} rx={9} fill={i % 2 ? "transparent" : rgba(P.panel, 0.6)} />
              <circle cx={22} cy={cy} r={5} fill={m.color()} opacity={0.4} />
              <text x={34} y={cy + 4} fill={P.dim} fontSize={12.5} fontWeight={600}>{m.label}</text>
              <text x={L} y={cy + 4} fill={P.dim} fontSize={11} fontStyle="italic">still training</text>
            </g>
          );
          const g = (b.score / a.score - 1) * 100;
          return (
            <g key={m.id}>
              <rect x={8} y={cy - rowH / 2 + 5} width={704} height={rowH - 10} rx={9} fill={i % 2 ? "transparent" : rgba(P.panel, 0.6)} />
              <circle cx={22} cy={cy} r={5} fill={m.color()} />
              <text x={34} y={cy + 4} fill={P.text} fontSize={12.5} fontWeight={600}>{m.label}</text>
              <line x1={x(Math.min(a.score, b.score))} x2={x(Math.max(a.score, b.score))} y1={cy} y2={cy} stroke={P.line2} strokeWidth={3}
                style={{ transition: "all 700ms cubic-bezier(.2,.8,.2,1)" }} />
              {[a, b].map((r) => {
                const c = r.arm === "sc" ? P.candi : P.dim2;
                return (
                  <g key={r.arm}>
                    <line x1={x(Math.min(...r.seeds))} x2={x(Math.max(...r.seeds))} y1={cy} y2={cy} stroke={c} strokeWidth={6} opacity={0.35} strokeLinecap="round"
                      style={{ transition: "all 700ms cubic-bezier(.2,.8,.2,1)" }} />
                    <g style={{ transform: `translate(${x(r.score)}px, ${cy}px)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)", cursor: "help" }}>
                      {r.arm === "none" ? <circle r={6.5} fill={P.bg} stroke={c} strokeWidth={2} /> : <circle r={7} fill={c} />}
                      <title>{`${r.arm === "sc" ? "with SC" : "no SC"}: ${t.fmt(r.score)} (sampler: ${r.policy})`}</title>
                    </g>
                  </g>
                );
              })}
              <text x={R + 40} y={cy + 4} fill={g >= 0 ? P.candi : P.bad} fontSize={12} fontWeight={600}>{pct(g)}</text>
              <text x={R + 92} y={cy + 4} fill={P.dim} fontSize={10}>{t.fmt(a.score)} → {t.fmt(b.score)}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

export const CdcdLinearity = withVizTheme(LinearityInner);
export const CdcdSchedules = withVizTheme(SchedulesInner);
export const CdcdPerformance = withVizTheme(PerformanceInner);
export const CdcdCorruption = withVizTheme(CorruptionInner);
