// Experimental pipeline of the codebase: the "factory line" from a question to
// figures, and a zoom into one experiment case (nested training / sampler
// search with a hard validation / test boundary).
// Sources: candi core/sweeps/prepare.py, core/sweeps/nested_tuning.py,
// docs/guides/experiments.md, docs/guides/nested-tuning.md. The "this post"
// numbers come from the portable-v2-mi210 manifest.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";

const LINE = [
  { id: "question", title: "Question", code: null,
    gen: ["what do we want", "to learn?"], post: ["is SC just depth?", "which sampler?"],
    info: "An experiment starts from a comparison, not a grid. It fixes what varies (recipes, tasks, seeds) and what is held constant (budgets, data, evaluation)." },
  { id: "sweep", title: "Sweep config", code: "configs/sweep/",
    gen: ["recipes × tasks", "× seeds"], post: ["methods × tasks ×", "{none, SC, 16L}"],
    info: "Lists every combination we want to compare. Each combination of recipe, task and training seed becomes one experiment. Switching a method means switching a full recipe, not one setting." },
  { id: "prepare", title: "Prepare", code: "sweeps.prepare",
    gen: ["fix every", "config"], post: ["steps from", "128 NFE budget"],
    info: "Turns each combination into a complete, fixed config and sets each sampler's step count from the budget of 128 network calls. It never starts training." },
  { id: "driver", title: "Run", code: "nested_tuning",
    gen: ["runs experiments", "in parallel"], post: ["115 experiments", "for this post"],
    info: "Runs several experiments at once. Each training and evaluation job gets its own GPU." },
  { id: "results", title: "Results", code: "per experiment",
    gen: ["can resume,", "can be checked"], post: ["packaged as", "one archive"],
    info: "Each experiment saves its setup, every sampler's search and the final score. A stopped run picks up where it left off; changing the setup needs a new experiment name." },
  { id: "figures", title: "Analysis", code: null,
    gen: ["figures and", "tables"], post: ["the figures", "in this post"],
    info: "Analysis reads only the saved artifacts, so a result can be traced back to its exact config, checkpoint and sampler settings." },
];

const CASE = {
  protocol: { title: "Fixed setup", info: "The config and search settings are saved when an experiment starts. If either changes, the experiment refuses to resume under the same name." },
  outer: { title: "Outer search: training", info: "A search over training settings (learning rate, weight decay, dropout ...). Each try trains one checkpoint on a GPU, then is scored by the sampler search below. In this post we skip this search: each experiment trains once." },
  inner: { title: "Inner searches: one per sampler", info: "Every sampler gets its own search over its own settings (temperature, entropy bound, final step ...), scored on validation only. The best sampler's score becomes the checkpoint's score." },
  select: { title: "Select", info: "The best checkpoint, sampler and sampler settings are chosen on validation. Nothing after this point can change the choice." },
  final: { title: "Final evaluation", info: "The winner is evaluated once on held-out test examples and seeds. This score never feeds back into any search. Validation jobs never see the test examples or seeds." },
  wall: { title: "Validation / test wall", info: "Enforced in code: before any validation worker starts, the test indices and seeds are removed from its config. Training-time callbacks are also restricted to the validation IDs." },
  handoff: { title: "Other machines", info: "Because every config and the code are saved, the same experiments can run on a different set of GPUs. The TinyStories results in this post ran this way and came back as one archive." },
};

const SAMPLERS_GEN = [
  { label: "sampler A", trials: "n trials" },
  { label: "sampler B", trials: "n trials" },
  { label: "...", trials: "" },
];
const SAMPLERS_POST = [
  { label: "native", trials: 16 },
  { label: "native greedy", trials: 2 },
  { label: "EB greedy", trials: 16 },
  { label: "renoise sample", trials: 16 },
  { label: "renoise greedy", trials: 2 },
];

function Box({ x, y, w, h, title, sub, code, color, active, onEnter, dim }) {
  return (
    <g onMouseEnter={onEnter} style={{ cursor: "pointer" }} opacity={dim ? 0.55 : 1}>
      <rect x={x} y={y} width={w} height={h} rx={9}
        fill={rgba(color, active ? 0.2 : 0.09)} stroke={rgba(color, active ? 0.95 : 0.5)} strokeWidth={active ? 1.8 : 1.2} />
      <text x={x + 9} y={y + 17} fill={P.text} fontSize={11} fontWeight={700}>{title}</text>
      {code && <text x={x + 9} y={y + 31} fill={color} fontSize={8.5}>{code}</text>}
      {sub && sub.map((line, i) => (
        <text key={i} x={x + 9} y={y + h - 21 + i * 12} fill={P.muted} fontSize={9}>{line}</text>
      ))}
    </g>
  );
}

const arrowHead = (id, color) => (
  <marker id={id} viewBox="0 0 10 10" refX={9} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
    <path d="M0,0 L10,5 L0,10 z" fill={color} />
  </marker>
);

function PipelineInner() {
  const [mode, setMode] = useState("gen");
  const [hover, setHover] = useState("driver");
  const post = mode === "post";
  const samplers = post ? SAMPLERS_POST : SAMPLERS_GEN;

  // Top line geometry.
  const bw = 106, gap = 12.8, y0 = 34, bh = 70;
  const bx = (i) => 6 + i * (bw + gap);
  // Case panel geometry.
  const cx0 = 6, cy0 = 140, cw = 708, ch = 330;
  const wallX = 566;
  const vColor = P.duo, tColor = P.candi, gpu = P.orange2;

  const detail = LINE.find((b) => b.id === hover)?.info || CASE[hover]?.info;
  const detailTitle = LINE.find((b) => b.id === hover)?.title || CASE[hover]?.title;

  const innerTop = cy0 + 74, rowH = post ? 30 : 40;
  const innerX = 206, innerW = 234;

  return (
    <Frame
      kicker="Pipeline"
      title="From a question to a figure"
      subtitle="How an experiment moves through the codebase. The bottom panel opens up one experiment. Hover any part for what it does."
      controls={<Pills value={mode} onChange={setMode} options={[{ id: "gen", label: "The pipeline" }, { id: "post", label: "This post's run" }]} />}
      note={post
        ? "This post uses a small slice of the pipeline: one training run per experiment (no training search), five samplers, 128 NFE, one training seed. It is a demonstration, not a full study."
        : "Each experiment is one recipe × task × training seed. All selection happens on validation."}
    >
      <svg viewBox="0 0 720 482" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        <defs>
          {arrowHead("pa", P.dim2)}
          {arrowHead("pv", vColor)}
          {arrowHead("pt", tColor)}
          {arrowHead("ph", P.highlight)}
        </defs>

        {/* Hand-off arc: prepare -> another cluster -> results */}
        <g onMouseEnter={() => setHover("handoff")} style={{ cursor: "pointer" }} opacity={hover === "handoff" ? 1 : 0.75}>
          <path d={`M${bx(2) + bw / 2},${y0} C${bx(2) + bw / 2},${y0 - 26} ${bx(4) + bw / 2},${y0 - 26} ${bx(4) + bw / 2},${y0 - 2}`}
            fill="none" stroke={P.highlight} strokeWidth={1.4} strokeDasharray="4 4" markerEnd="url(#ph)" />
          <rect x={bx(3) - 6} y={y0 - 30} width={bw + 12} height={14} fill={P.bg} />
          <text x={bx(3) + bw / 2} y={y0 - 19} fill={P.highlight} fontSize={9} textAnchor="middle">or hand off to another cluster</text>
        </g>

        {/* Factory line */}
        {LINE.map((b, i) => (
          <g key={b.id}>
            <Box x={bx(i)} y={y0} w={bw} h={bh} title={b.title} code={b.code} sub={post ? b.post : b.gen}
              color={b.id === "driver" ? gpu : P.accent} active={hover === b.id} onEnter={() => setHover(b.id)} />
            {i < LINE.length - 1 && (
              <line x1={bx(i) + bw + 1} x2={bx(i + 1) - 2} y1={y0 + bh / 2} y2={y0 + bh / 2} stroke={P.dim2} strokeWidth={1.3} markerEnd="url(#pa)" />
            )}
          </g>
        ))}

        {/* Zoom wedge from driver to case panel */}
        <path d={`M${bx(3)},${y0 + bh} L${cx0 + 40},${cy0} L${cx0 + cw - 40},${cy0} L${bx(3) + bw},${y0 + bh} Z`}
          fill={rgba(gpu, 0.05)} stroke="none" />
        <text x={bx(3) + bw / 2} y={cy0 - 10} fill={P.dim} fontSize={9.5} textAnchor="middle" letterSpacing="0.08em">ONE EXPERIMENT CASE · recipe × task × seed</text>

        {/* Case panel */}
        <rect x={cx0} y={cy0} width={cw} height={ch} rx={12} fill={rgba(P.panel, 0.7)} stroke={P.line2} />

        {/* Protocol */}
        <g onMouseEnter={() => setHover("protocol")} style={{ cursor: "pointer" }}>
          <rect x={cx0 + 14} y={cy0 + 12} width={150} height={24} rx={6} fill={rgba(P.accent, hover === "protocol" ? 0.2 : 0.08)} stroke={rgba(P.accent, 0.5)} />
          <text x={cx0 + 24} y={cy0 + 28} fill={P.text} fontSize={10}>pinned protocol.json</text>
        </g>

        {/* Outer study */}
        <g onMouseEnter={() => setHover("outer")} style={{ cursor: "pointer" }}>
          <text x={cx0 + 14} y={cy0 + 60} fill={P.muted} fontSize={9.5} letterSpacing="0.06em">OUTER STUDY · TRAINING</text>
          {(post ? [0] : [2, 1, 0]).map((k) => (
            <g key={k} transform={`translate(${k * 6}, ${-k * 6})`}>
              <rect x={cx0 + 14} y={innerTop} width={160} height={92} rx={9}
                fill={k ? rgba(P.panel, 1) : rgba(P.accent, hover === "outer" ? 0.2 : 0.1)} stroke={rgba(P.accent, k ? 0.3 : hover === "outer" ? 0.95 : 0.55)} />
            </g>
          ))}
          <text x={cx0 + 26} y={innerTop + 20} fill={P.text} fontSize={11} fontWeight={700}>{post ? "train once" : "training try k"}</text>
          <text x={cx0 + 26} y={innerTop + 36} fill={P.muted} fontSize={9}>{post ? "20k updates, fixed" : "settings from the search"}</text>
          <rect x={cx0 + 26} y={innerTop + 48} width={34} height={15} rx={4} fill={rgba(gpu, 0.2)} stroke={gpu} />
          <text x={cx0 + 43} y={innerTop + 59} fill={gpu} fontSize={8.5} textAnchor="middle">GPU</text>
          <text x={cx0 + 66} y={innerTop + 59} fill={P.muted} fontSize={9}>GPU job</text>
          <text x={cx0 + 26} y={innerTop + 80} fill={P.text} fontSize={9.5}>→ checkpoint</text>
          <text x={cx0 + 14} y={innerTop + 112} fill={P.dim} fontSize={9}>{post ? "1 try per experiment" : "N tries, run in turn"}</text>
        </g>

        {/* Arrow outer -> inner */}
        <line x1={cx0 + 176} x2={innerX - 4} y1={innerTop + 46} y2={innerTop + 46} stroke={P.dim2} strokeWidth={1.3} markerEnd="url(#pa)" />

        {/* Inner studies */}
        <g onMouseEnter={() => setHover("inner")} style={{ cursor: "pointer" }}>
          <text x={innerX} y={cy0 + 60} fill={P.muted} fontSize={9.5} letterSpacing="0.06em">INNER STUDIES · ONE PER SAMPLER</text>
          {samplers.map((s, i) => {
            const y = innerTop - 8 + i * rowH;
            const n = typeof s.trials === "number" ? s.trials : 0;
            return (
              <g key={s.label}>
                <rect x={innerX} y={y} width={innerW} height={rowH - 6} rx={7}
                  fill={rgba(vColor, hover === "inner" ? 0.16 : 0.08)} stroke={rgba(vColor, hover === "inner" ? 0.85 : 0.4)} />
                <text x={innerX + 10} y={y + (rowH - 6) / 2 + 3.5} fill={P.text} fontSize={10}>{s.label}</text>
                {n > 0 ? Array.from({ length: n }, (_, j) => (
                  <circle key={j} cx={innerX + 112 + j * 7.2} cy={y + (rowH - 6) / 2} r={2.4} fill={vColor} opacity={0.85} />
                )) : s.trials && (
                  <text x={innerX + 112} y={y + (rowH - 6) / 2 + 3.5} fill={P.muted} fontSize={9}>{s.trials}</text>
                )}
              </g>
            );
          })}
          <text x={innerX} y={innerTop - 8 + samplers.length * rowH + 8} fill={P.dim} fontSize={9}>
            {post ? "each dot: one try, two seeds, 128 examples" : "each try: a GPU evaluation on validation"}
          </text>
        </g>

        {/* Select */}
        {(() => {
          const sx = innerX + innerW + 22, sy = innerTop + 22, sw = 82, sh = 48;
          const midY = innerTop - 8 + (samplers.length * rowH - 6) / 2;
          return (
            <g>
              <line x1={innerX + innerW + 2} x2={sx - 3} y1={midY} y2={sy + sh / 2} stroke={P.dim2} strokeWidth={1.3} markerEnd="url(#pa)" />
              <g onMouseEnter={() => setHover("select")} style={{ cursor: "pointer" }}>
                <rect x={sx} y={sy} width={sw} height={sh} rx={9} fill={rgba(vColor, hover === "select" ? 0.2 : 0.1)} stroke={rgba(vColor, 0.7)} />
                <text x={sx + sw / 2} y={sy + 20} fill={P.text} fontSize={10.5} fontWeight={700} textAnchor="middle">select</text>
                <text x={sx + sw / 2} y={sy + 35} fill={P.muted} fontSize={8.5} textAnchor="middle">on validation</text>
              </g>
              {/* loop back to the outer study */}
              {!post && (
                <path d={`M${sx + sw / 2},${sy + sh} L${sx + sw / 2},${cy0 + 290} L${cx0 + 160},${cy0 + 290} L${cx0 + 160},${innerTop + 94}`}
                  fill="none" stroke={vColor} strokeWidth={1.2} strokeDasharray="3 3" markerEnd="url(#pv)" />
              )}
              {!post && <text x={cx0 + 170} y={cy0 + 284} fill={vColor} fontSize={9}>score of training try k → next proposal</text>}
              <line x1={sx + sw + 2} x2={wallX + 18} y1={sy + sh / 2} y2={sy + sh / 2} stroke={tColor} strokeWidth={1.4} markerEnd="url(#pt)" />
            </g>
          );
        })()}

        {/* Wall */}
        <g onMouseEnter={() => setHover("wall")} style={{ cursor: "pointer" }}>
          <rect x={wallX - 6} y={cy0 + 8} width={12} height={ch - 16} fill="transparent" />
          <line x1={wallX} x2={wallX} y1={cy0 + 10} y2={cy0 + ch - 10} stroke={hover === "wall" ? P.text : P.warn} strokeWidth={2} strokeDasharray="6 4" />
          <text x={wallX - 8} y={cy0 + 26} fill={P.warn} fontSize={9} textAnchor="end">validation</text>
          <text x={wallX + 8} y={cy0 + 26} fill={P.warn} fontSize={9}>test</text>
        </g>

        {/* Final */}
        <g onMouseEnter={() => setHover("final")} style={{ cursor: "pointer" }}>
          <rect x={wallX + 20} y={innerTop + 4} width={120} height={84} rx={9} fill={rgba(tColor, hover === "final" ? 0.22 : 0.1)} stroke={rgba(tColor, 0.75)} />
          <text x={wallX + 30} y={innerTop + 24} fill={P.text} fontSize={11} fontWeight={700}>final evaluation</text>
          <text x={wallX + 30} y={innerTop + 40} fill={P.muted} fontSize={9}>winner only, once</text>
          <rect x={wallX + 30} y={innerTop + 50} width={34} height={15} rx={4} fill={rgba(gpu, 0.2)} stroke={gpu} />
          <text x={wallX + 47} y={innerTop + 61} fill={gpu} fontSize={8.5} textAnchor="middle">GPU</text>
          <text x={wallX + 30} y={innerTop + 80} fill={P.text} fontSize={9.5}>→ reported score</text>
        </g>

        {/* Data partitions */}
        {(() => {
          const y = cy0 + ch - 32;
          return (
            <g fontSize={9}>
              <rect x={cx0 + 14} y={y} width={160} height={20} rx={5} fill={rgba(P.dim2, 0.12)} stroke={P.line2} />
              <text x={cx0 + 22} y={y + 13.5} fill={P.muted}>training data</text>
              <rect x={innerX} y={y} width={wallX - innerX - 10} height={20} rx={5} fill={rgba(vColor, 0.12)} stroke={rgba(vColor, 0.5)} />
              <text x={innerX + 8} y={y + 13.5} fill={vColor}>{post ? "validation: 128 examples · seeds 41, 42" : "validation examples · validation seeds"}</text>
              <rect x={wallX + 10} y={y} width={cx0 + cw - wallX - 24} height={20} rx={5} fill={rgba(tColor, 0.12)} stroke={rgba(tColor, 0.5)} />
              <text x={wallX + 18} y={y + 13.5} fill={tColor}>{post ? "test: 256 · 1041/42" : "test examples, seeds"}</text>
            </g>
          );
        })()}
      </svg>
      <div style={{ minHeight: 58, marginTop: 6, padding: "8px 12px", borderRadius: 10, background: rgba(P.inset, 0.7), border: `1px solid ${P.line}` }}>
        <div style={{ fontFamily: FONT, fontSize: 11, color: P.accent, marginBottom: 3 }}>{detailTitle}</div>
        <div style={{ fontSize: 13, color: P.muted, lineHeight: 1.45 }}>{detail}</div>
      </div>
    </Frame>
  );
}

export const Pipeline = withVizTheme(PipelineInner);
export default Pipeline;
