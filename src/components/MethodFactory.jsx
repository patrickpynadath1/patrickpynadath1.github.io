// The large-scale pipeline this codebase is aiming at: a "method factory".
// Recipes go through pretraining, SFT and RL with checkpoint selection between
// stages, each stage with its own benchmarks, then inference sweeps across tasks
// and seeds. Toggle shows which slice Part 2 actually runs.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";

const STAGES = [
  { id: "recipe", title: "Recipe", sub: ["data, arch.,", "objective, noise"], post: ["one recipe per", "method × SC arm"],
    info: "The whole method: pretraining data mix, architecture, objective, noise schedule, modifiers. Several recipes enter the factory at once; the unit being compared is the method, not one model." },
  { id: "pretrain", title: "Pretrain", sub: ["long run, many", "checkpoints"], post: ["8 layers, 20k", "steps, one task"],
    info: "Pretraining on the mix, saving checkpoints along the way. Each checkpoint can be scored by likelihood (where comparable) and few-shot benchmarks." },
  { id: "g1", gate: true, info: "Which pretraining checkpoint goes to SFT? Candidates: the best likelihood, the best few-shot score, the best pass@k after a short SFT probe. Which of these predicts the best final model is an open question." },
  { id: "sft", title: "SFT", sub: ["instruction /", "task data"], post: ["not run"],
    info: "Supervised fine-tuning from the selected checkpoint(s). Scored zero-shot on held-out benchmarks." },
  { id: "g2", gate: true, info: "Which SFT checkpoint goes to RL? Zero-shot accuracy, pass@k (headroom for RL), or something else. Methods may need different rules." },
  { id: "rl", title: "RL", sub: ["reward on", "verifiable tasks"], post: ["not run"],
    info: "Reinforcement learning from the selected SFT checkpoint(s). Different generative methods can have very different RL dynamics (how rollouts are sampled, how credit is assigned, how the policy likelihood is computed or approximated)." },
  { id: "g3", gate: true, info: "Which RL checkpoint is final? Chosen on held-out validation tasks, never on the test benchmarks." },
  { id: "infer", title: "Inference", sub: ["settings ×", "tasks × seeds"], post: ["7–9 samplers,", "tuned per task"],
    info: "Every inference setting (sampler, steps, commitment, temperature) evaluated across all tasks and several seeds, then macro-averaged. One setting per method is reported, not one per task." },
];

const EVALS = {
  pretrain: { title: "few-shot", postTitle: "val. loss", sub: ["+ likelihood,", "if comparable"], post: ["no benchmarks"],
    info: "Pretraining benchmarks: few-shot accuracy, and likelihood where methods share a comparable bound." },
  sft: { title: "zero-shot", sub: ["held-out", "benchmarks"], post: null, info: "Post-SFT benchmarks: zero-shot accuracy on held-out tasks." },
  rl: { title: "post-RL", sub: ["pass@k,", "agentic tasks"], post: null, info: "Post-RL benchmarks: zero-shot pass@k, and agentic, multi-step tasks." },
  infer: { title: "macro average", postTitle: "per task", sub: ["over tasks,", "mean over seeds"], post: ["sampler tuned", "per task, 2 seeds"],
    info: "The reported number: for each inference setting, the macro average over tasks of the mean over seeds. Part 2 instead tunes the sampler per task on validation, because its small models cannot be scored on real benchmarks." },
};

const EXTRA = {
  distill: { title: "Sampler distillation", info: "Distilling the sampler into fewer steps. Where it goes is an open choice: before RL (cheaper rollouts, but RL then optimizes an already compressed sampler), during RL (most efficient, least stable), or after RL (cleanest RL, but distillation can undo RL gains)." },
  "bot-pretrain": { title: "Babysitter agent · pretraining", info: "Keeps the run stable and well tuned: learning rate, warmup, loss spikes, restarts. Optimizes a metric local to the stage (loss smoothness, validation loss), so every recipe gets a fair run." },
  "bot-sft": { title: "Babysitter agent · SFT", info: "Tunes learning rate, epochs and the data mix for a stable fine-tune, scored on a stage-local validation metric." },
  "bot-rl": { title: "Babysitter agent · RL", info: "Watches for collapse and tunes the KL coefficient, reward scale and rollout settings, scored on reward slope and held-out validation reward." },
  experimenter: { title: "Experimenter agent", info: "Changes something upstream (architecture, noising, objective, data mix, which checkpoint moves on and by which signal, the SFT data, the RL algorithm, where distillation goes) and watches the effect downstream. It reads a held-out validation suite; the test benchmarks are scored once at the end, so the validation / test boundary from this post still holds." },
};

const COMPARE = { title: "Compare methods", info: "The factory's output: methods compared at matched compute and data, ideally as scaling curves rather than single points, since methods may scale differently with data and parameters." };

function Box({ x, y, w, h, title, sub, color, active, dim, onEnter, dashed }) {
  return (
    <g onMouseEnter={onEnter} style={{ cursor: "pointer" }} opacity={dim ? 0.35 : 1}>
      <rect x={x} y={y} width={w} height={h} rx={9} fill={rgba(color, active ? 0.2 : 0.09)}
        stroke={rgba(color, active ? 0.95 : 0.5)} strokeWidth={active ? 1.8 : 1.2} strokeDasharray={dashed ? "4 3" : undefined} />
      <text x={x + 8} y={y + 17} fill={P.text} fontSize={10.5} fontWeight={700}>{title}</text>
      {sub && sub.map((l, i) => <text key={i} x={x + 8} y={y + h - 20 + i * 11.5} fill={P.muted} fontSize={8.6}>{l}</text>)}
    </g>
  );
}

const head = (id, c) => (
  <marker id={id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill={c} />
  </marker>
);

function FactoryInner() {
  const [mode, setMode] = useState("scale");
  const agents = mode === "agents";
  const [hover, setHover] = useState("g1");
  const post = mode === "post";
  const runInPost = new Set(["recipe", "pretrain", "infer"]);

  // geometry: boxes 98 wide, gates 24 wide, 12px arrows between everything
  const bw = 98, gw = 24, gap = 12, y0 = 92, bh = 64;
  const xs = [];
  let x = 6;
  for (const s of STAGES) { xs.push(x); x += (s.gate ? gw : bw) + gap; }
  const evY = 208, evH = 54;
  const feedY = 286, cmpY = 312;
  const stageColor = (id) => (id === "recipe" ? P.accent : id === "infer" ? P.candi : P.duo);

  const all = { ...Object.fromEntries(STAGES.map((s) => [s.id, s])), ...Object.fromEntries(Object.entries(EVALS).map(([k, v]) => [`ev-${k}`, v])), compare: COMPARE, ...EXTRA };
  const cur = all[hover];
  const curTitle = cur?.gate ? "Checkpoint selection" : cur?.title;

  return (
    <Frame
      kicker="Toward a method factory"
      title="The pipeline at scale"
      subtitle="What the experimental pipeline would look like with the compute to train real models: whole recipes through pretraining, SFT and RL, choosing which checkpoints move on, with benchmarks at every stage and inference settings swept across tasks and seeds. Hover any part."
      controls={<Pills value={mode} onChange={setMode} options={[{ id: "scale", label: "At scale" }, { id: "agents", label: "With agents" }, { id: "post", label: "What this post runs" }]} />}
      note={post
        ? "This post runs only the first and last stages, on small models trained for one task each. Because those models cannot be scored on real benchmarks, the sampler is tuned per task on validation instead of reporting one setting macro-averaged across tasks."
        : agents
          ? "Small robots: babysitter agents that keep each training stage stable and well tuned on a stage-local metric. Large robot: an experimenter agent that changes upstream choices and checkpoint selection, and reads the downstream result on held-out validation tasks."
          : "Diamonds: checkpoint selection between stages. Dashed lines: which benchmarks could drive each selection. Sampler distillation can attach before, during or after RL."}
    >
      <svg viewBox="0 0 720 364" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        <defs>{head("mf-a", P.dim2)}{head("mf-q", P.highlight)}</defs>

        {/* stacked recipes: several methods enter */}
        {[2, 1].map((k) => (
          <rect key={k} x={xs[0] + k * 4} y={y0 - k * 4} width={bw} height={bh} rx={9} fill="none" stroke={rgba(P.accent, 0.3)} />
        ))}

        {STAGES.map((s, i) => {
          const dim = post && !runInPost.has(s.id);
          const nx = i < STAGES.length - 1 ? xs[i + 1] : null;
          const right = xs[i] + (s.gate ? gw : bw);
          return (
            <g key={s.id}>
              {s.gate ? (
                <g onMouseEnter={() => setHover(s.id)} style={{ cursor: "pointer" }} opacity={dim ? 0.35 : 1}>
                  <path d={`M${xs[i] + gw / 2},${y0 + bh / 2 - 13} l12,13 l-12,13 l-12,-13 z`}
                    fill={rgba(P.highlight, hover === s.id ? 0.35 : 0.15)} stroke={P.highlight} strokeWidth={hover === s.id ? 1.8 : 1.2} />
                  <text x={xs[i] + gw / 2} y={y0 + bh / 2 + 3.5} fill={P.highlight} fontSize={10} fontWeight={700} textAnchor="middle">?</text>
                  <text x={xs[i] + gw / 2} y={y0 + bh / 2 - 19} fill={P.dim} fontSize={8} textAnchor="middle">ckpt</text>
                </g>
              ) : (
                <Box x={xs[i]} y={y0} w={bw} h={bh} title={s.title} sub={post ? s.post : s.sub} color={stageColor(s.id)}
                  active={hover === s.id} dim={dim} onEnter={() => setHover(s.id)} />
              )}
              {nx != null && (
                <line x1={right + 1} x2={nx - 2} y1={y0 + bh / 2} y2={y0 + bh / 2} stroke={P.dim2} strokeWidth={1.3}
                  markerEnd="url(#mf-a)" opacity={post && (dim || !runInPost.has(STAGES[i + 1].id)) ? 0.3 : 1} />
              )}
            </g>
          );
        })}

        {/* in this post, pretrain feeds the sweep directly */}
        {post && (
          <path d={`M${xs[1] + bw / 2},${y0} C${xs[1] + bw / 2},${y0 - 34} ${xs[7] + bw / 2},${y0 - 34} ${xs[7] + bw / 2},${y0 - 2}`}
            fill="none" stroke={P.candi} strokeWidth={1.4} markerEnd="url(#mf-a)" />
        )}
        {post && <text x={(xs[1] + xs[7] + bw) / 2} y={y0 - 30} fill={P.candi} fontSize={9} textAnchor="middle">final checkpoint goes straight to the sampler search</text>}

        {/* benchmarks under each stage, feeding the next gate */}
        {Object.entries(EVALS).map(([k, e]) => {
          const i = STAGES.findIndex((s) => s.id === k);
          const dim = post && !e.post;
          const cxs = xs[i] + bw / 2;
          const gate = STAGES[i + 1]?.gate ? i + 1 : null;
          return (
            <g key={k}>
              <line x1={cxs} x2={cxs} y1={y0 + bh + 2} y2={evY - 2} stroke={P.dim2} strokeWidth={1.1} markerEnd="url(#mf-a)" opacity={dim ? 0.3 : 1} />
              <Box x={xs[i]} y={evY} w={bw} h={evH} title={post ? e.postTitle ?? e.title : e.title} sub={post ? e.post ?? ["not run"] : e.sub} color={P.warn}
                active={hover === `ev-${k}`} dim={dim} onEnter={() => setHover(`ev-${k}`)} />
              {gate != null && !post && (
                <path d={`M${xs[i] + bw},${evY + evH / 2} C${xs[gate] + gw / 2},${evY + evH / 2} ${xs[gate] + gw / 2},${evY - 20} ${xs[gate] + gw / 2},${y0 + bh / 2 + 15}`}
                  fill="none" stroke={P.highlight} strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#mf-q)" />
              )}
            </g>
          );
        })}

        {/* sampler distillation: before, during or after RL */}
        {!post && (() => {
          const rl = xs[5], dx = rl - 26, dw = bw + 52, dy = 14, dh = 34;
          const pts = [{ x: xs[4] + gw + gap / 2, y: y0 + bh / 2, l: "before" }, { x: rl + bw / 2, y: y0, l: "during" }, { x: rl + bw + gap / 2, y: y0 + bh / 2, l: "after" }];
          const on = hover === "distill";
          return (
            <g onMouseEnter={() => setHover("distill")} style={{ cursor: "pointer" }}>
              <rect x={dx} y={dy} width={dw} height={dh} rx={8} fill={rgba(P.pinkText, on ? 0.2 : 0.08)} stroke={rgba(P.pinkText, on ? 0.95 : 0.55)} strokeWidth={on ? 1.6 : 1.1} />
              <text x={dx + dw / 2} y={dy + 14} fill={P.text} fontSize={10} fontWeight={700} textAnchor="middle">sampler distillation</text>
              <text x={dx + dw / 2} y={dy + 27} fill={P.muted} fontSize={8.4} textAnchor="middle">before · during · after RL?</text>
              {pts.map((q, i) => (
                <g key={q.l}>
                  <line x1={dx + dw * (i + 1) / 4} y1={dy + dh} x2={q.x} y2={q.y - 3} stroke={P.pinkText} strokeWidth={1} strokeDasharray="3 3" />
                  <circle cx={q.x} cy={q.y} r={3} fill={P.pinkText} />
                </g>
              ))}
            </g>
          );
        })()}

        {/* agent layer */}
        {agents && (() => {
          const bot = (id, cx, cy, size) => (
            <g key={id} onMouseEnter={() => setHover(id)} style={{ cursor: "pointer" }}>
              <circle cx={cx} cy={cy} r={size * 0.72} fill={rgba(P.highlight, hover === id ? 0.35 : 0.14)} stroke={P.highlight} strokeWidth={hover === id ? 1.6 : 1} />
              <text x={cx} y={cy + size * 0.36} fontSize={size} textAnchor="middle">🤖</text>
            </g>
          );
          const targets = [xs[0] + bw / 2, xs[2] + gw / 2, xs[4] + gw / 2, xs[6] + gw / 2];
          const ex = xs[7] + bw / 2, on = hover === "experimenter";
          const col = P.highlight;
          return (
            <g>
              <g onMouseEnter={() => setHover("experimenter")} style={{ cursor: "pointer" }} opacity={on ? 1 : 0.85}>
                <path d={`M${ex},${evY + evH + 2} L${ex},${feedY} L${targets[0]},${feedY}`} fill="none" stroke={col} strokeWidth={on ? 2 : 1.5} />
                {targets.map((tx, i) => (
                  <line key={i} x1={tx} x2={tx} y1={feedY} y2={i === 0 ? y0 + bh + 2 : y0 + bh / 2 + 15} stroke={col} strokeWidth={on ? 1.6 : 1.2} markerEnd="url(#mf-q)" />
                ))}
                <rect x={(targets[0] + ex) / 2 - 128} y={feedY - 8} width={256} height={16} fill={P.bg} />
                <text x={(targets[0] + ex) / 2 + 8} y={feedY + 3.5} fill={col} fontSize={9} textAnchor="middle">change upstream, read validation downstream</text>
              </g>
              {bot("experimenter", (targets[0] + ex) / 2 - 136, feedY, 18)}
              {bot("bot-pretrain", xs[1] + bw - 4, y0 + 4, 12)}
              {bot("bot-sft", xs[3] + bw - 4, y0 + 4, 12)}
              {bot("bot-rl", xs[5] + bw - 4, y0 + 4, 12)}
            </g>
          );
        })()}

        {/* output: methods compared */}
        <g onMouseEnter={() => setHover("compare")} style={{ cursor: "pointer" }}>
          <line x1={xs[7] + bw / 2} x2={xs[7] + bw / 2} y1={evY + evH + 2} y2={cmpY - 2} stroke={P.dim2} strokeWidth={1.3} markerEnd="url(#mf-a)" />
          <rect x={6} y={cmpY} width={xs[7] + bw - 6} height={44} rx={10} fill={rgba(P.candi, hover === "compare" ? 0.18 : 0.07)} stroke={rgba(P.candi, 0.6)} />
          <text x={18} y={cmpY + 18} fill={P.text} fontSize={11} fontWeight={700}>Compare methods</text>
          <text x={18} y={cmpY + 33} fill={P.muted} fontSize={9}>{post ? "per task, per model, at one small scale" : "matched compute and data · scaling curves, not single points · one inference setting per method"}</text>
        </g>
      </svg>
      <div style={{ minHeight: 58, marginTop: 6, padding: "8px 12px", borderRadius: 10, background: rgba(P.inset, 0.7), border: `1px solid ${P.line}` }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: P.accent, marginBottom: 3 }}>{curTitle}</div>
        <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.45 }}>{cur?.info}</div>
      </div>
    </Frame>
  );
}

export const MethodFactory = withVizTheme(FactoryInner);
export default MethodFactory;
