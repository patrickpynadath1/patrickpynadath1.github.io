import React from "react";
import { Frame } from "./SelfCondDepth.jsx";
import { withVizTheme } from "./vizTheme.js";

// "Lifecycle of a bit": one sampling step, with content bits and noise bits drawn separately.
// Colors only through the site's CSS variables so both themes work.
const C = {
  fg: "var(--fg)",
  muted: "var(--muted)",
  border: "var(--border)",
  surface: "var(--surface)",
  content: "var(--viz-accent)",
  fresh: "var(--viz-accent2)",
  good: "var(--viz-good)",
  bad: "var(--viz-bad)",
  hl: "var(--viz-highlight)",
};
const FONT = "Helvetica, Arial, sans-serif";
const SERIF = "Georgia, serif";

function Marker({ id, color }) {
  return (
    <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );
}

// A state drawn as stacked parts: content bits (usable, then buried) on top, noise bits below.
// usableFrac = share of the content one pass can extract; the rest is buried in the noise.
function StateBox({ x, y, w, h, title, sub, contentFrac, usableFrac }) {
  const inner = h - 44;
  const ch = inner * contentFrac;
  const uh = ch * usableFrac;
  const bh = ch - uh;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={C.surface} stroke={C.border} strokeWidth={1.5} />
      <text x={x + w / 2} y={y + 20} textAnchor="middle" fontSize={15} fontFamily={SERIF} fill={C.fg}>{title}</text>
      <text x={x + w / 2} y={y + 35} textAnchor="middle" fontSize={11} fill={C.muted}>{sub}</text>
      <rect x={x + 12} y={y + 42} width={w - 24} height={uh} rx={4} fill={C.content} fillOpacity={0.55} stroke={C.content} />
      <text x={x + w / 2} y={y + 42 + uh / 2 + 4} textAnchor="middle" fontSize={11.5} fill={C.fg}>content: usable</text>
      <rect x={x + 12} y={y + 42 + uh} width={w - 24} height={bh} rx={4} fill={C.content} fillOpacity={0.1}
        stroke={C.content} strokeDasharray="4 3" />
      <text x={x + w / 2} y={y + 42 + uh + bh / 2 + 4} textAnchor="middle" fontSize={11.5} fill={C.fg}>content: buried</text>
      <rect x={x + 12} y={y + 46 + ch} width={w - 24} height={inner - ch - 8} rx={4} fill="url(#bl-hatch)" stroke={C.muted} />
      <text x={x + w / 2} y={y + 46 + ch + (inner - ch - 8) / 2 + 4} textAnchor="middle" fontSize={12} fill={C.fg}>noise bits</text>
    </g>
  );
}

// Logit columns: some peaked (derived), some flat (still open).
const LOGITS = [
  [0.1, 0.95, 0.08, 0.05, 0.1],
  [0.5, 0.45, 0.35, 0.4, 0.3],
  [0.05, 0.1, 0.07, 0.9, 0.1],
  [0.35, 0.5, 0.45, 0.3, 0.4],
  [0.9, 0.1, 0.06, 0.08, 0.05],
];

function LifecycleSVG({ annotated = false }) {
  const Y = 110; // top of the main row
  return (
      <div style={{ overflowX: "auto" }}>
    <svg viewBox="0 0 1040 520" width="100%" role="img" style={{ display: "block", fontFamily: FONT, minWidth: 640 }}
      aria-label="One sampling step: a state with content and noise bits goes through the model to logits, then the sampler combines logits with old and new noise into the next state">
      <defs>
        <Marker id="bl-m" color={C.muted} />
        <Marker id="bl-c" color={C.content} />
        <Marker id="bl-f" color={C.fresh} />
        <Marker id="bl-b" color={C.bad} />
        <Marker id="bl-g" color={C.good} />
        <pattern id="bl-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill={C.muted} fillOpacity={0.08} />
          <line x1="0" y1="0" x2="0" y2="6" stroke={C.muted} strokeOpacity={0.45} strokeWidth={1.5} />
        </pattern>
      </defs>

      {/* 1. state s_k */}
      <StateBox x={20} y={Y} w={170} h={190} title="State s_k" sub="what the model sees" contentFrac={0.42} usableFrac={0.6} />

      {/* 2. model pass */}
      <rect x={250} y={Y + 45} width={140} height={100} rx={8} fill={C.surface} stroke={C.border} strokeWidth={1.5} />
      <text x={320} y={Y + 75} textAnchor="middle" fontSize={15} fontFamily={SERIF} fill={C.fg}>Model pass</text>
      <text x={320} y={Y + 95} textAnchor="middle" fontSize={11.5} fill={C.muted}>weights = codebook</text>
      <text x={320} y={Y + 111} textAnchor="middle" fontSize={11.5} fill={C.muted}>one pass of compute</text>
      <line x1={192} y1={Y + 95} x2={246} y2={Y + 95} stroke={C.content} strokeWidth={2} markerEnd="url(#bl-c)" />
      <text x={320} y={Y + 165} textAnchor="middle" fontSize={12} fill={C.good}>derives bits:</text>
      <text x={320} y={Y + 181} textAnchor="middle" fontSize={12} fill={C.good}>usable up, Shannon same</text>

      {/* 3. prediction = logits */}
      <rect x={450} y={Y + 10} width={190} height={170} rx={8} fill={C.surface} stroke={C.border} strokeWidth={1.5} />
      <text x={545} y={Y + 32} textAnchor="middle" fontSize={15} fontFamily={SERIF} fill={C.fg}>Prediction</text>
      <text x={545} y={Y + 48} textAnchor="middle" fontSize={11} fill={C.muted}>logits at every position</text>
      {LOGITS.map((col, i) => {
        const cx = 468 + i * 34;
        const peaked = Math.max(...col) > 0.8;
        return (
          <g key={i}>
            {col.map((v, j) => (
              <rect key={j} x={cx + j * 5} y={Y + 140 - v * 70} width={4} height={v * 70}
                fill={peaked ? C.good : C.content} fillOpacity={peaked ? 0.85 : 0.55} />
            ))}
            <line x1={cx - 2} y1={Y + 141} x2={cx + 26} y2={Y + 141} stroke={C.border} />
            <text x={cx + 12} y={Y + 156} textAnchor="middle" fontSize={10} fill={C.muted}>pos {i + 1}</text>
          </g>
        );
      })}
      <text x={545} y={Y + 172} textAnchor="middle" fontSize={11} fill={C.muted}>
        <tspan fill={C.good}>peaked = derived</tspan>, flat = still open
      </text>
      <line x1={392} y1={Y + 95} x2={446} y2={Y + 95} stroke={C.content} strokeWidth={2} markerEnd="url(#bl-c)" />
      <text x={545} y={Y + 200} textAnchor="middle" fontSize={12} fill={C.good}>all usable: content + derived</text>
      <text x={545} y={Y + 216} textAnchor="middle" fontSize={11} fill={C.muted}>(far bigger raw size than the state)</text>

      {/* 4. sampler */}
      <rect x={700} y={Y + 45} width={140} height={100} rx={8} fill={C.surface} stroke={C.border} strokeWidth={1.5} />
      <text x={770} y={Y + 75} textAnchor="middle" fontSize={15} fontFamily={SERIF} fill={C.fg}>Sampler</text>
      <text x={770} y={Y + 95} textAnchor="middle" fontSize={11.5} fill={C.muted}>draw, commit,</text>
      <text x={770} y={Y + 111} textAnchor="middle" fontSize={11.5} fill={C.muted}>squeeze to training shape</text>
      <line x1={642} y1={Y + 95} x2={696} y2={Y + 95} stroke={C.content} strokeWidth={2} markerEnd="url(#bl-c)" />

      {/* new noise into the sampler */}
      <text x={770} y={34} textAnchor="middle" fontSize={13} fontWeight="bold" fill={C.fresh}>new noise</text>
      <text x={770} y={51} textAnchor="middle" fontSize={11.5} fill={C.muted}>token draws, positions, fresh ε</text>
      <text x={770} y={66} textAnchor="middle" fontSize={11.5} fill={C.fresh}>chosen bits: Shannon up</text>
      <line x1={770} y1={74} x2={770} y2={Y + 41} stroke={C.fresh} strokeWidth={2} markerEnd="url(#bl-f)" />

      {/* old noise from s_k into the sampler, along the bottom */}
      <path d={`M 105 ${Y + 192} L 105 ${Y + 260} L 770 ${Y + 260} L 770 ${Y + 149}`} fill="none"
        stroke={C.muted} strokeWidth={2} strokeDasharray="2 4" markerEnd="url(#bl-m)" />
      <text x={440} y={Y + 254} textAnchor="middle" fontSize={12} fill={C.muted}>old noise carried over (mask pattern, noisy point x_t)</text>

      {/* discarded work */}
      <line x1={820} y1={Y + 147} x2={820} y2={Y + 250} stroke={C.bad} strokeWidth={2} markerEnd="url(#bl-b)" />
      <text x={832} y={Y + 222} fontSize={12} fill={C.bad}>discarded logits:</text>
      <text x={832} y={Y + 238} fontSize={12} fill={C.bad}>usable share drops</text>

      {/* 5. next state */}
      <StateBox x={870} y={Y} w={160} h={190} title="State s_k+1" sub="fixes more of the sample" contentFrac={0.74} usableFrac={0.5} />
      <line x1={842} y1={Y + 95} x2={866} y2={Y + 95} stroke={C.content} strokeWidth={2} markerEnd="url(#bl-c)" />

      {/* self conditioning */}
      <path d={`M 545 ${Y + 8} C 545 ${Y - 50}, 320 ${Y - 50}, 320 ${Y + 41}`} fill="none"
        stroke={C.good} strokeWidth={2} strokeDasharray="6 5" markerEnd="url(#bl-g)" />
      <text x={432} y={Y - 34} textAnchor="middle" fontSize={12} fill={C.good}>self conditioning (optional): logits carried to the next pass</text>

      {/* feedback loop */}
      <path d={`M 950 ${Y + 192} L 950 ${Y + 300} L 60 ${Y + 300} L 60 ${Y + 194}`} fill="none"
        stroke={C.fg} strokeOpacity={0.6} strokeWidth={2} markerEnd="url(#bl-m)" />
      <text x={510} y={Y + 318} textAnchor="middle" fontSize={12} fill={C.muted}>next state becomes the input; repeat until no noise bits are left</text>
      {/* callouts used in the post */}
      {annotated && (
        <g>
          <ellipse cx={872} cy={Y + 222} rx={108} ry={44} fill="none" stroke={C.hl} strokeWidth={2.5} strokeDasharray="7 5" />
          <ellipse cx={432} cy={Y - 22} rx={236} ry={40} fill="none" stroke={C.hl} strokeWidth={2.5} strokeDasharray="7 5" />
          <rect x={680} y={16} width={180} height={Y + 136} rx={14} fill="none" stroke={C.hl} strokeWidth={2.5} strokeDasharray="7 5" />
          {[[768, Y + 190, "1"], [178, Y - 38, "2"], [680, 16, "3"]].map(([x, y, n]) => (
            <g key={n}>
              <circle cx={x} cy={y} r={13} fill={C.hl} />
              <text x={x} y={y + 5} textAnchor="middle" fontSize={14} fontWeight="bold" fill="var(--bg)">{n}</text>
            </g>
          ))}
          {[[40, "1", "sampling wall: the draw throws away the rest of the belief"],
            [380, "2", "self conditioning: graded beliefs carried forward"],
            [690, "3", "corruption process: decides what the state keeps"]].map(([x, n, s]) => (
            <g key={n}>
              <circle cx={x} cy={478} r={10} fill={C.hl} />
              <text x={x} y={482} textAnchor="middle" fontSize={12} fontWeight="bold" fill="var(--bg)">{n}</text>
              <text x={x + 16} y={482} fontSize={12} fill={C.fg}>{s}</text>
            </g>
          ))}
        </g>
      )}
    </svg>
  </div>
  );
}

const NOTE = "One sampling step. Content bits are what the state fixes about the final sample: the usable part (solid) is what one pass can extract, the buried part (dashed) is fixed but tangled with noise. Noise bits (hatched) are the rest.";

export default function BitLifecycle({ annotated = false, caption }) {
  return (
    <figure style={{ margin: "1.5em 0" }}>
      <LifecycleSVG annotated={annotated} />
      <figcaption style={{ fontSize: "0.9em", color: "var(--muted)", marginTop: 6 }}>{caption ?? NOTE}</figcaption>
    </figure>
  );
}

// Version for the blog post, in the same frame as the other numbered figures.
function LifecycleFigureInner({ kicker = "Figure 2" }) {
  return (
    <Frame
      kicker={kicker}
      title="The lifecycle of a bit during sampling"
      subtitle="One sampling step. The state holds content bits (what it already fixes about the final sample) and noise bits. The model turns the state into logits; the sampler draws from them, mixes the result with noise, and writes the next state."
      note={<>Content bits are split into a usable part (solid), which one network pass can extract, and a buried part (dashed), which the state fixes but which is tangled with noise. The sizes are illustrative, not measured. The split is an assumption; see the text.</>}
    >
      <LifecycleSVG annotated />
    </Frame>
  );
}

export const LifecycleFigure = withVizTheme(LifecycleFigureInner);
