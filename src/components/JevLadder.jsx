// The tokenizer ladder through a judge model. Data: src/data/jev_ladder.json,
// built from ~159k Jev (TypeSafe, jev-1.14.0) judgments of the ladder's test
// continuations (512 prompts per model, chosen sampler). See the source field.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";
import DATA from "../data/jev_ladder.json";

const VOCABS = [260, 500, 1000, 5000, 10000];
const vlab = (v) => (v >= 1000 ? `${v / 1000}k` : `${v}`);
const METHODS = [
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "masked", label: "Masked", color: () => P.mdlm },
  { id: "uniform", label: "Uniform", color: () => P.duo },
];
const pct = (v) => `${Math.round(v * 100)}%`;
const METRICS = [
  { id: "sc_preferred", label: "SC vs no SC", max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: pct, noAr: true, scOnly: true, even: 0.5,
    axis: "P(SC version is better)", short: "SC PREFERRED",
    help: "Jev sees the same method's ending with and without SC and picks the better one. 50% means SC makes no difference." },
  { id: "realism", label: "Mistaken for the author", relAr: true, max: 0.5, ticks: [0, 0.1, 0.2, 0.3, 0.4, 0.5], fmt: pct,
    axis: "P(judged the original author)", relAxis: "mistaken for author ÷ AR", short: "AUTHOR?",
    help: "Jev sees the model's ending and the real one and picks which the original author wrote. 50% means it cannot tell them apart." },
  { id: "coherence", label: "Coherence", relAr: true, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], fmt: (v) => v.toFixed(2),
    axis: "coherence ÷ real endings", relAxis: "coherence ÷ AR", short: "COHERENCE",
    help: "Jev rates each ending's coherence on a 5-level scale; the real endings are rated the same way, and 1.0 means as coherent as them." },
  { id: "garbled", label: "Garbled words", max: 7, ticks: [0, 1, 2, 3, 4, 5, 6, 7], fmt: (v) => v.toFixed(1),
    axis: "garbled words per 100", short: "GARBLED / 100",
    help: "One yes/no question per distinct word: is it misspelled, made up, a fragment, or two words fused? Counted when Jev is over 80% sure." },
  { id: "three_way", label: "Best of three", even: 1 / 3, max: 0.8, ticks: [0, 0.2, 0.4, 0.6, 0.8], fmt: (v) => v.toFixed(2), noAr: true,
    axis: "share of wins, same SC setting", short: "BEST OF 3",
    help: "Jev picks the best of the three diffusion methods' endings, all with SC or all without. 0.33 is an even split." },
];

const row = (method, sc, v) => DATA.rows.find((r) => r.method === method && r.sc === sc && r.vocab === v);

const W = 720, H = 330;
const L = 66, R = 540, T = 18, B = 290;
const lx = (v) => Math.log(v);
const px = (v) => L + ((lx(v) - lx(VOCABS[0])) / (lx(VOCABS.at(-1)) - lx(VOCABS[0]))) * (R - L);

function JevLadderInner() {
  const [metric, setMetric] = useState("sc_preferred");
  const [rel, setRel] = useState("abs");
  const [hover, setHover] = useState(null);
  const m = METRICS.find((x) => x.id === metric);
  const relative = m.relAr && rel === "ar";
  const value = (r) => {
    const v = r[metric];
    return relative ? v / row("ar", null, r.vocab)[metric] : v;
  };
  const max = relative ? 0.75 : m.max;
  const ticks = relative ? [0, 0.25, 0.5, 0.75] : m.ticks;
  const fmt = relative ? (v) => v.toFixed(2) : m.fmt;
  const py = (v) => B - (Math.min(v, max) / max) * (B - T);
  const showAr = !relative && !m.noAr;
  const series = METHODS.flatMap((me) => (m.scOnly ? [true] : [true, false]).map((sc) => ({ me, sc })));

  return (
    <Frame
      kicker="Figure K · a judge's view of the ladder"
      title="What a judge model sees in the tokenizer ladder"
      subtitle={m.help}
      controls={<>
        <Pills value={metric} onChange={setMetric} options={METRICS.map((x) => ({ id: x.id, label: x.label }))} />
        {m.relAr && <Pills value={rel} onChange={setRel} options={[{ id: "abs", label: "As is" }, { id: "ar", label: "÷ AR at same vocab" }]} />}
      </>}
      note={`Judged by Jev (jev-1.14.0) on the test split: 512 prompts per model, each model's chosen sampler. Pairwise questions were asked in both orders and averaged. Probabilities carry about ±0.01 of prompt-sampling noise; each model is one training run, so checkpoint-to-checkpoint variation is not measured. Uniform with SC at 1k is weak on every measure and may be a poor checkpoint.`}
    >
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={R} y1={py(v)} y2={py(v)} stroke={P.grid} strokeWidth={1} />
            <text x={L - 8} y={py(v) + 3.5} fill={P.dim} fontSize={10} textAnchor="end">{fmt(v)}</text>
          </g>
        ))}
        {VOCABS.map((v) => <text key={v} x={px(v)} y={B + 20} fill={P.muted} fontSize={10.5} textAnchor="middle">{vlab(v)}</text>)}
        <text x={(L + R) / 2} y={B + 38} fill={P.dim} fontSize={10} textAnchor="middle">vocabulary size (log scale)</text>
        <text x={14} y={(T + B) / 2} fill={P.dim} fontSize={10} textAnchor="middle" transform={`rotate(-90 14 ${(T + B) / 2})`}>
          {relative ? m.relAxis : m.axis}
        </text>
        {m.even != null && <line x1={L} x2={R} y1={py(m.even)} y2={py(m.even)} stroke={P.line2} strokeDasharray="2 4" />}

        {showAr && (() => {
          const pts = VOCABS.map((v) => [px(v), py(value(row("ar", null, v)))]);
          return (
            <g>
              <path d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("")} fill="none" stroke={P.dim2} strokeWidth={1.6} strokeDasharray="5 4" />
              <text x={R + 6} y={pts.at(-1)[1] + 3.5} fill={P.dim2} fontSize={10}>AR</text>
            </g>
          );
        })()}
        {series.map(({ me, sc }) => {
          const pts = VOCABS.map((v) => [px(v), py(value(row(me.id, sc, v)))]);
          return (
            <g key={`${me.id}${sc}`}>
              <path d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("")} fill="none" stroke={me.color()}
                strokeWidth={sc ? 2.4 : 1.8} strokeDasharray={sc ? undefined : "4 3"} opacity={sc ? 1 : 0.85} />
              {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={sc ? 4 : 3.5} fill={sc ? me.color() : P.bg} stroke={me.color()} strokeWidth={1.6} />)}
            </g>
          );
        })}
        {VOCABS.map((v, i) => {
          const x0 = i === 0 ? L - 20 : (px(VOCABS[i - 1]) + px(v)) / 2;
          const x1 = i === VOCABS.length - 1 ? R + 20 : (px(v) + px(VOCABS[i + 1])) / 2;
          return (
            <g key={v}>
              {hover === v && <rect x={px(v) - 14} y={T} width={28} height={B - T + 6} rx={6} fill={rgba(P.accent, 0.08)} />}
              <rect x={x0} y={T} width={x1 - x0} height={B - T + 30} fill="transparent" onMouseEnter={() => setHover(v)} onMouseLeave={() => setHover(null)} />
            </g>
          );
        })}

        <g transform={`translate(588, ${T + 6})`}>
          <text x={-6} fill={P.dim} fontSize={10} letterSpacing="0.08em">{hover ? `VOCAB ${vlab(hover)}` : m.short}</text>
          {series.map(({ me, sc }, i) => {
            const y = 24 + i * 20 + (m.scOnly ? i * 6 : Math.floor(i / 2) * 6);
            const r = hover && row(me.id, sc, hover);
            return (
              <g key={`${me.id}${sc}`}>
                <line x1={-7} x2={5} y1={y - 3.5} y2={y - 3.5} stroke={me.color()} strokeWidth={2.4} strokeDasharray={sc ? undefined : "3 2"} />
                <text x={10} y={y} fill={sc ? P.text : P.muted} fontSize={10.5} fontWeight={sc ? 700 : 400}>{m.scOnly ? me.label : `${me.label}${sc ? " + SC" : ""}`}</text>
                {r && <text x={126} y={y} fill={sc ? P.text : P.muted} fontSize={10.5} fontWeight={sc ? 700 : 400} textAnchor="end">{fmt(value(r))}</text>}
              </g>
            );
          })}
          {showAr && (
            <g>
              <line x1={-7} x2={5} y1={24 + 6 * 20 + 18 - 3.5} y2={24 + 6 * 20 + 18 - 3.5} stroke={P.dim2} strokeWidth={1.6} strokeDasharray="3 2" />
              <text x={10} y={24 + 6 * 20 + 18} fill={P.muted} fontSize={10.5}>AR</text>
              {hover && <text x={126} y={24 + 6 * 20 + 18} fill={P.muted} fontSize={10.5} textAnchor="end">{fmt(value(row("ar", null, hover)))}</text>}
            </g>
          )}
          {!hover && <text x={-6} y={24 + (m.scOnly ? 4 : 7) * 20 + 30} fill={P.dim} fontSize={9.5}>Hover a vocab size.</text>}
        </g>
      </svg>
    </Frame>
  );
}

export const JevLadder = withVizTheme(JevLadderInner);
export default JevLadder;
