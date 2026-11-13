// The sampler tuning protocol as a funnel, styled like PipelineFigure: search per sampler ->
// stage 1 -> stage 2 -> validation/test wall -> one test. Numbers from candi
// configs/sweep/rerun_protocol.yaml, configs/inference/inference_policies/*.yaml and
// experiments/rerun/evaluation/*.json.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";

// trials per sampler: native 16, native greedy 2, renoise 16, renoise greedy 2, EB greedy 16,
// EB churn 24, Ψ·c 24, Ψ·t 24; anchor native / renoise 16 each (pure continuous only)
const STEPS = [
  { id: "search", title: "Search", big: "8–10", unit: "samplers", sub: ["2–24 trials each", "~124–156 per model"], val: true,
    info: "Every sampler is tuned separately over its own small set of knobs (temperature, entropy bound, Ψ schedule, anchoring power ...). Optuna proposes the settings: Gaussian-process optimisation for native, renoise and EB, multivariate TPE for Ψ and anchoring, and both values for the two-option samplers. Every run uses 128 network calls." },
  { id: "s1", title: "Stage 1 · screen", big: "64", unit: "prompts × 2 seeds", sub: ["every trial scored", "top 3 per sampler"], val: true,
    info: "Each trial is scored on 64 validation prompts with two sampling seeds. This is cheap and noisy, so each sampler keeps its three best settings rather than one." },
  { id: "s2", title: "Stage 2 · confirm", big: "256", unit: "fresh prompts", sub: ["24–30 finalists", "bootstrap interval"], val: true,
    info: "The finalists are re-scored on 256 validation prompts not used in stage 1, with a new seed. The best of them across all samplers becomes the model's tuned sampler. Fresh prompts stop a setting that got lucky in stage 1 from winning." },
  { id: "test", title: "Test · once", big: "1", unit: "winner", sub: ["test × 2 seeds", "never fed back"], val: false,
    info: "Only the winner runs on the test split, once, at 128 network calls with two seeds. No choice is made from test numbers." },
];
const WALL = { title: "Validation / test wall", info: "Everything left of the wall uses validation prompts and seeds only. The test prompts and seeds are removed from the tuning jobs' configs before they start." };

const arrowHead = (id, color) => (
  <marker id={id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill={color} />
  </marker>
);

function TuningInner() {
  const [hover, setHover] = useState("search");
  const vColor = P.duo, tColor = P.candi;
  const W = 656, bw = 142, bh = 112, y0 = 26, gap = 20, wallGap = 34;
  const bx = (i) => 4 + i * (bw + gap) + (i === 3 ? wallGap - gap : 0);
  const wallX = bx(2) + bw + wallGap / 2 + 2;
  const cur = STEPS.find((s) => s.id === hover) || WALL;
  return (
    <Frame
      kicker="Figure T · sampler tuning"
      title="How each checkpoint's sampler is chosen"
      subtitle="The same funnel for every model, at a fixed budget of 128 network calls. Hover a step for what it does."
      note="Pure continuous models get two extra samplers (random anchoring), hence 8–10. Exact settings: candi configs/sweep/rerun_protocol.yaml, configs/inference/inference_policies/, experiments/rerun/evaluation/."
    >
      <svg viewBox={`0 0 ${W} 160`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }} onMouseLeave={() => setHover("search")}>
        <defs>{arrowHead("tpa", P.dim2)}{arrowHead("tpt", tColor)}</defs>
        <text x={4} y={14} fill={vColor} fontSize={10}>validation prompts and seeds</text>
        <text x={bx(3)} y={14} fill={tColor} fontSize={10}>test</text>
        {STEPS.map((s, i) => {
          const c = s.val ? vColor : tColor, on = hover === s.id, x = bx(i);
          return (
            <g key={s.id} onMouseEnter={() => setHover(s.id)} style={{ cursor: "pointer" }}>
              <rect x={x} y={y0} width={bw} height={bh} rx={9} fill={rgba(c, on ? 0.2 : 0.09)} stroke={rgba(c, on ? 0.95 : 0.5)} strokeWidth={on ? 1.8 : 1.2} />
              <text x={x + 10} y={y0 + 19} fill={P.text} fontSize={11.5} fontWeight={700}>{s.title}</text>
              <text x={x + 10} y={y0 + 52} fill={c} fontSize={26} fontWeight={700}>{s.big}</text>
              <text x={x + 10} y={y0 + 67} fill={P.muted} fontSize={9.5}>{s.unit}</text>
              {s.sub.map((l, k) => <text key={k} x={x + 10} y={y0 + 86 + k * 13} fill={P.dim2} fontSize={9.5}>{l}</text>)}
              {i < STEPS.length - 1 && (
                <line x1={x + bw + 2} x2={bx(i + 1) - 3} y1={y0 + bh / 2} y2={y0 + bh / 2}
                  stroke={i === 2 ? tColor : P.dim2} strokeWidth={1.4} markerEnd={`url(#${i === 2 ? "tpt" : "tpa"})`} />
              )}
            </g>
          );
        })}
        <g onMouseEnter={() => setHover("wall")} style={{ cursor: "pointer" }}>
          <rect x={wallX - 6} y={y0 - 6} width={12} height={bh + 12} fill="transparent" />
          <line x1={wallX} x2={wallX} y1={y0 - 4} y2={y0 + bh + 4} stroke={hover === "wall" ? P.text : P.warn} strokeWidth={2} strokeDasharray="6 4" />
        </g>
        <text x={4} y={y0 + bh + 20} fill={P.dim2} fontSize={9.5}>samplers → their 3 best settings → 1 winner → scored once</text>
      </svg>
      <div style={{ minHeight: 58, marginTop: 6, padding: "8px 12px", borderRadius: 10, background: rgba(P.inset, 0.7), border: `1px solid ${P.line}` }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: P.accent, marginBottom: 3 }}>{cur.title}</div>
        <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.45 }}>{cur.info}</div>
      </div>
    </Frame>
  );
}

export const TuningProcess = withVizTheme(TuningInner);
export default TuningProcess;
