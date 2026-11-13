// Explanatory figures for Part 3 (the interpretation of self conditioning).
// Most are sketches of ideas, labeled as illustrations with no measured data. One plots
// numbers reported by Yoo et al. (2026), Table 1, and one shows two numbers from Davis et al. (2026).
// They share the vocabulary of BitRecovery.jsx: the sentence "the cat sat on the mat",
// four bit boxes per word, blue for a bit with value 0 and orange for value 1.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";
import { useTip } from "./ScRerun.jsx";

const WORDS = ["the", "cat", "sat", "on", "the", "mat"];
const BITS = 4, N = WORDS.length * BITS;
// Fixed bit values, so every figure shows the same sentence.
const VALUE = [0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 1, 1, 1, 0, 1, 0, 0, 1, 0, 1, 1, 1, 0, 0];
const BOX = 13, GAP = 2, WGAP = 9;
const WORDW = BITS * BOX + (BITS - 1) * GAP;
const ROWW = WORDS.length * WORDW + (WORDS.length - 1) * WGAP;
const bx = (i) => Math.floor(i / BITS) * (WORDW + WGAP) + (i % BITS) * (BOX + GAP);
const col = (i) => (VALUE[i] ? P.accent2 : P.duo);
const SKETCH = "Illustration · not measured data";

// One row of the sentence. kinds[i]: "solid" (written into the state), "soft" / "faint"
// (a belief, strong or weak), "hidden" (fixed, but not worked out), "noisy" (blurred), "empty".
function BitRow({ x = 0, y = 0, kinds, h = BOX, labels = false }) {
  return (
    <g transform={`translate(${x},${y})`}>
      {labels && WORDS.map((w, k) => (
        <text key={k} x={k * (WORDW + WGAP) + WORDW / 2} y={-6} fill={P.muted} fontSize={10.5} textAnchor="middle">{w}</text>
      ))}
      {kinds.map((kind, i) => {
        const c = col(i), X = bx(i);
        if (kind === "none") return null;
        if (kind === "solid") return <rect key={i} x={X} y={0} width={BOX} height={h} rx={2.5} fill={c} />;
        if (kind === "soft") return <rect key={i} x={X} y={0} width={BOX} height={h} rx={2.5} fill={rgba(c, 0.5)} stroke={rgba(c, 0.8)} strokeWidth={0.8} />;
        if (kind === "faint") return <rect key={i} x={X} y={0} width={BOX} height={h} rx={2.5} fill={rgba(c, 0.16)} stroke={rgba(c, 0.45)} strokeWidth={0.8} />;
        if (kind === "hidden") return (
          <g key={i}>
            <rect x={X} y={0} width={BOX} height={h} rx={2.5} fill="transparent" stroke={c} strokeWidth={1.1} strokeDasharray="2.5 2" />
            <line x1={X + 3} y1={h - 3} x2={X + BOX - 3} y2={3} stroke={c} strokeWidth={1.1} />
          </g>
        );
        if (kind === "noisy") return (
          <g key={i}>
            <rect x={X} y={0} width={BOX} height={h} rx={2.5} fill={rgba(c, 0.3)} stroke={rgba(c, 0.5)} strokeWidth={0.8} />
            {[[3, 4], [9, 3], [6, 8], [10, 10], [3, 11]].map(([dx, dy], k) => <circle key={k} cx={X + dx} cy={dy * (h / BOX)} r={1} fill={P.muted} />)}
          </g>
        );
        return <rect key={i} x={X} y={0} width={BOX} height={h} rx={2.5} fill="transparent" stroke={P.line2} strokeWidth={0.8} />;
      })}
    </g>
  );
}

function Key({ items }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "4px 0 12px", fontFamily: FONT, fontSize: 11, color: P.muted }}>
      {items.map(([kind, label, bit]) => (
        <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={BOX + 2} height={BOX + 2} style={{ flexShrink: 0 }}>
            <g transform={`translate(${1 - bx(bit ?? 0)},1)`}><BitRow kinds={Array.from({ length: N }, (_, i) => (i === (bit ?? 0) ? kind : "none"))} /></g>
          </svg>
          {label}
        </span>
      ))}
    </div>
  );
}

const Label = ({ children, color }) => <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: color || P.text }}>{children}</div>;
const Sub = ({ children }) => <div style={{ fontSize: 12, color: P.muted, lineHeight: 1.4, margin: "1px 0 5px" }}>{children}</div>;
const RowSvg = ({ children, h = BOX + 18, pad = 0 }) => (
  <svg viewBox={`0 0 ${ROWW + 2 * pad} ${h}`} style={{ width: "100%", maxWidth: 520, height: "auto", display: "block", fontFamily: FONT, overflow: "visible" }}>{children}</svg>
);

// ── 1. Two observers, one state ───────────────────────────────────────────────
// A state partway through sampling. Each bit is settled, hidden (fixed by the state and
// the weights, but costly to work out), or open (not decided yet).
const STATUS = ["s", "s", "s", "s", "h", "h", "o", "o", "h", "o", "o", "o", "s", "s", "s", "s", "s", "s", "h", "h", "h", "o", "o", "o"];
function TwoObserversInner() {
  const count = (k) => STATUS.filter((x) => x === k).length;
  const top = STATUS.map((k) => (k === "o" ? "empty" : "solid"));
  const bottom = STATUS.map((k) => (k === "s" ? "solid" : k === "h" ? "hidden" : "empty"));
  return (
    <Frame kicker={SKETCH} title="The same state, seen by two observers"
      subtitle="One state partway through sampling. An observer with unlimited compute can work out every bit the state already fixes. The model gets one forward pass, so some of those bits stay out of reach."
      note="A sketch of the idea. Which bits are hidden is made up here; the point is only that the two observers disagree on how much is left.">
      <Key items={[["solid", "known to this observer", 0], ["hidden", "hidden: fixed, but not worked out in one pass", 4], ["empty", "open: not decided yet", 6]]} />
      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <Label>Observer with unlimited compute</Label>
          <Sub>Unresolved: {count("o")} open bits.</Sub>
          <RowSvg><BitRow y={16} kinds={top} labels /></RowSvg>
        </div>
        <div>
          <Label>The model, with one forward pass</Label>
          <Sub>Unresolved: {count("o")} open bits and {count("h")} hidden bits.</Sub>
          <RowSvg><BitRow y={16} kinds={bottom} labels /></RowSvg>
        </div>
      </div>
    </Frame>
  );
}

// ── 2. Three sources, one step ────────────────────────────────────────────────
const MODES = [
  { id: "stochastic", label: "Stochastic", uses: { old: true, pred: true, fresh: true }, text: "A stochastic sampler mixes all three: it keeps part of the old state, moves toward the prediction, and adds fresh noise." },
  { id: "ode", label: "Deterministic (ODE)", uses: { old: true, pred: true, fresh: false }, text: "A deterministic sampler uses no fresh noise. Every choice was fixed by the original noise." },
  { id: "renoise", label: "Full renoising", uses: { old: false, pred: true, fresh: true }, text: "Full renoising throws the old state away. The next state is the prediction plus fresh noise." },
];
function Node({ x, y, w, h = 34, title, sub, on = true, tone }) {
  const c = tone || P.accent;
  return (
    <g opacity={on ? 1 : 0.28}>
      <rect x={x} y={y} width={w} height={h} rx={8} fill={rgba(c, 0.13)} stroke={rgba(c, 0.75)} strokeWidth={1.2} />
      <text x={x + w / 2} y={y + (sub ? 14 : h / 2 + 4)} fill={P.text} fontSize={11.5} fontWeight={700} textAnchor="middle">{title}</text>
      {sub && <text x={x + w / 2} y={y + 27} fill={P.muted} fontSize={9.5} textAnchor="middle">{sub}</text>}
    </g>
  );
}
function Arrow({ d, on = true, color, dash }) {
  const c = color || P.muted;
  return <path d={d} fill="none" stroke={c} strokeWidth={1.6} strokeDasharray={dash} opacity={on ? 1 : 0.2} markerEnd="url(#sk-arrow)" />;
}
const Defs = () => (
  <defs>
    <marker id="sk-arrow" viewBox="0 0 10 10" refX={8} refY={5} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={P.muted} />
    </marker>
  </defs>
);
function ThreeSourcesInner() {
  const [mode, setMode] = useState("stochastic");
  const m = MODES.find((x) => x.id === mode), u = m.uses;
  return (
    <Frame kicker={SKETCH} title="One sampling step: three sources feed the next state"
      subtitle="The model reads the state and makes a prediction. The sampler's update rule then builds the next state from up to three sources. Samplers differ in which ones they use."
      controls={<Pills value={mode} onChange={setMode} options={MODES.map((x) => ({ id: x.id, label: x.label }))} />}
      note={m.text}>
      <svg viewBox="0 0 640 220" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }} role="img"
        aria-label="Diagram of one sampling step: the old state, the model's prediction and fresh noise feed the update rule, which produces the next state">
        <Defs />
        <Node x={6} y={93} w={124} title="state z_t" sub="noise + past choices" tone={P.duo} />
        <Node x={196} y={20} w={96} title="model f" sub="one forward pass" tone={P.dim2} />
        <Node x={356} y={20} w={120} title="prediction" sub="structure worked out" tone={P.candi} />
        <Node x={356} y={166} w={120} title="fresh noise" sub="new choices" tone={P.accent2} on={u.fresh} />
        <Node x={376} y={93} w={80} title="update u" tone={P.dim2} />
        <Node x={520} y={93} w={110} title="next state z_s" tone={P.duo} />
        <Arrow d="M70,93 C70,52 130,37 194,37" />
        <Arrow d="M292,37 L354,37" />
        <Arrow d="M416,54 L416,91" color={P.candi} on={u.pred} />
        <Arrow d="M130,110 L374,110" color={P.duo} on={u.old} />
        <Arrow d="M416,166 L416,129" color={P.accent2} on={u.fresh} />
        <Arrow d="M456,110 L518,110" />
        <text x={250} y={104} fill={u.old ? P.muted : P.faint} fontSize={9.5} textAnchor="middle">{u.old ? "old state kept" : "old state dropped"}</text>
        <text x={424} y={76} fill={P.muted} fontSize={9.5}>prediction</text>
        <text x={424} y={152} fill={u.fresh ? P.muted : P.faint} fontSize={9.5}>{u.fresh ? "fresh noise" : "no fresh noise"}</text>
      </svg>
    </Frame>
  );
}

// ── 3. What each update keeps ─────────────────────────────────────────────────
const CONF = [0, 0, 0, 0, 1, 1, 2, 2, 1, 1, 2, 2, 0, 0, 0, 0, 0, 0, 1, 1, 1, 2, 2, 2]; // 0 = sure, 2 = unsure
const PRED = CONF.map((c) => (c === 0 ? "solid" : c === 1 ? "soft" : "faint"));
function UpdateKeepsInner() {
  const masked = PRED.map((_, i) => (Math.floor(i / BITS) === 0 || Math.floor(i / BITS) === 3 ? "solid" : "empty"));
  const stoch = PRED.map(() => "noisy");
  const ode = PRED.map(() => "faint");
  const rows = [
    ["Masked diffusion", "Commits a few tokens. The beliefs at every position that stays masked are thrown away.", masked],
    ["Continuous, stochastic sampler", "Writes part of the prediction into every position, then blurs it with fresh noise.", stoch],
    ["Continuous, deterministic sampler", "Adds no noise, but moves each position only a small step toward the prediction.", ode],
  ];
  return (
    <Frame kicker={SKETCH} title="A forward pass works out more than the next state keeps"
      subtitle="Top: what one forward pass works out, a belief about every bit, stronger where the model is sure. Below: what three kinds of update write into the next state."
      note="A sketch of the idea. A state that kept every belief would not look like any state the model saw in training, so each update has to drop part of the prediction.">
      <Key items={[["solid", "strong belief, or a committed bit", 0], ["soft", "weaker belief", 4], ["faint", "weak belief", 6], ["noisy", "blurred by fresh noise", 1], ["empty", "nothing written", 2]]} />
      <div style={{ border: `1px solid ${P.line}`, borderRadius: 10, padding: "10px 12px", background: rgba(P.candi, 0.06) }}>
        <Label color={P.candi}>What the forward pass works out</Label>
        <Sub>The prediction: a belief at every position.</Sub>
        <RowSvg><BitRow y={16} kinds={PRED} labels /></RowSvg>
      </div>
      <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.dim2, margin: "10px 0 6px", letterSpacing: "0.06em", textTransform: "uppercase" }}>What the update writes into the next state</div>
      <div style={{ display: "grid", gap: 12 }}>
        {rows.map(([name, text, kinds]) => (
          <div key={name}>
            <Label>{name}</Label>
            <Sub>{text}</Sub>
            <RowSvg h={BOX + 4}><BitRow y={2} kinds={kinds} /></RowSvg>
          </div>
        ))}
      </div>
    </Frame>
  );
}

// ── 4. Two wires ──────────────────────────────────────────────────────────────
function TwoWiresInner() {
  const [sc, setSc] = useState("on");
  const on = sc === "on";
  const decisions = PRED.map((_, i) => (Math.floor(i / BITS) === 0 || Math.floor(i / BITS) === 3 ? "solid" : "empty"));
  const beliefs = PRED.map((k, i) => (decisions[i] === "solid" ? "none" : k === "solid" ? "soft" : k));
  const S = 0.9, rw = ROWW * S;
  return (
    <Frame kicker={SKETCH} title="Two channels between sampling steps"
      subtitle="The state carries decisions: what has been committed. Self conditioning carries beliefs: what the model has worked out but not committed to."
      controls={<Pills value={sc} onChange={setSc} options={[{ id: "on", label: "With self conditioning" }, { id: "off", label: "Without" }]} />}
      note={on ? "With self conditioning, the next pass starts from the previous prediction. It reads the state for what is decided and the second channel for what is believed."
        : "Without self conditioning, only the state reaches the next pass. The beliefs are dropped, and the next pass has to work them out again."}>
      <svg viewBox="0 0 640 230" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }} role="img"
        aria-label="Two forward passes joined by two channels: the state, carrying decisions, and self conditioning, carrying beliefs">
        <Defs />
        <Node x={10} y={80} w={104} h={70} title="pass at step t" tone={P.dim2} />
        <Node x={526} y={80} w={104} h={70} title="pass at step s" tone={P.dim2} />
        {/* upper wire: beliefs */}
        <g opacity={on ? 1 : 0.25}>
          <path d="M114,98 C170,56 470,56 524,98" fill="none" stroke={P.candi} strokeWidth={1.8} strokeDasharray={on ? null : "5 4"} markerEnd="url(#sk-arrow)" />
          <text x={320} y={14} fill={P.candi} fontSize={11.5} fontWeight={700} textAnchor="middle">self conditioning: beliefs</text>
          <g transform={`translate(${320 - rw / 2},24) scale(${S})`}><BitRow kinds={beliefs} /></g>
        </g>
        {!on && <text x={320} y={84} fill={P.bad} fontSize={10.5} textAnchor="middle">dropped</text>}
        {/* lower wire: decisions */}
        <path d="M114,132 C170,174 470,174 524,132" fill="none" stroke={P.duo} strokeWidth={1.8} markerEnd="url(#sk-arrow)" />
        <g transform={`translate(${320 - rw / 2},190) scale(${S})`}><BitRow kinds={decisions} /></g>
        <text x={320} y={224} fill={P.duo} fontSize={11.5} fontWeight={700} textAnchor="middle">state: decisions</text>
      </svg>
    </Frame>
  );
}

// ── 5. More refinement per step (numbers from Yoo et al., Table 1) ────────────
const YOO = [
  { id: "elf", label: "ELF, 32 steps", color: () => P.duo, ppl: [101.19, 66.5, 56.67, 50.25, 46.31], ent: [5.51, 5.42, 5.37, 5.33, 5.31] },
  { id: "langflow", label: "LangFlow, 64 steps", color: () => P.accent2, ppl: [77.26, 57.99, 52.63, 49.37, 47.27], ent: [5.49, 5.42, 5.4, 5.38, 5.36] },
];
const DATA_ENTROPY = 5.44;
function FixedPointInner() {
  const tip = useTip();
  const W = 640, L = 46, R = 132, T1 = 12, H1 = 150, T2 = 196, H2 = 62, H = 286;
  const x = (k) => L + (k / 4) * (W - L - R);
  const y1 = (v) => T1 + (1 - (v - 40) / 70) * H1;
  const y2 = (v) => T2 + (1 - (v - 5.25) / 0.3) * H2;
  const path = (arr, y) => arr.map((v, k) => `${k ? "L" : "M"}${x(k)},${y(v)}`).join("");
  return (
    <Frame kicker="Numbers from Yoo et al. (2026), Table 1" title="More refinement per step keeps helping"
      subtitle="Generative perplexity (lower is better) as the number of self-conditioning iterations per sampling step grows. One iteration is ordinary self-conditioned sampling. The strip below shows sample entropy, which drifts below the data's."
      note="Values as reported by Yoo et al. in their Table 1; we did not rerun them. The entropy also falls, so part of the drop in perplexity may come from less diverse samples. Separately, they report that a cold start and a warm start reach the same quality at 100 iterations per step.">
      <div ref={tip.box} style={{ position: "relative" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, overflow: "visible" }} role="img"
          aria-label="Line chart: generative perplexity falls as iterations per step go from one to five, for ELF and LangFlow">
          {[40, 60, 80, 100].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y1(t)} y2={y1(t)} stroke={P.grid} strokeWidth={0.6} />
              <text x={L - 6} y={y1(t) + 3.5} fill={P.dim2} fontSize={10} textAnchor="end">{t}</text>
            </g>
          ))}
          <text x={L} y={T1 - 2} fill={P.dim2} fontSize={10}>generative perplexity</text>
          {[5.3, 5.4, 5.5].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y2(t)} y2={y2(t)} stroke={P.grid} strokeWidth={0.6} />
              <text x={L - 6} y={y2(t) + 3.5} fill={P.dim2} fontSize={10} textAnchor="end">{t.toFixed(1)}</text>
            </g>
          ))}
          <text x={L} y={T2 - 6} fill={P.dim2} fontSize={10}>sample entropy</text>
          <line x1={L} x2={W - R} y1={y2(DATA_ENTROPY)} y2={y2(DATA_ENTROPY)} stroke={P.muted} strokeWidth={1} strokeDasharray="4 3" />
          <text x={W - R + 8} y={y2(DATA_ENTROPY) + 3.5} fill={P.muted} fontSize={10}>data: {DATA_ENTROPY}</text>
          {[0, 1, 2, 3, 4].map((k) => <text key={k} x={x(k)} y={H - 12} fill={P.dim2} fontSize={10} textAnchor="middle">{k + 1}</text>)}
          <text x={(L + W - R) / 2} y={H} fill={P.dim2} fontSize={10} textAnchor="middle">iterations per sampling step</text>
          {YOO.map((s, si) => (
            <g key={s.id}>
              <path d={path(s.ppl, y1)} fill="none" stroke={s.color()} strokeWidth={2} strokeLinejoin="round" />
              <path d={path(s.ent, y2)} fill="none" stroke={s.color()} strokeWidth={2} strokeLinejoin="round" />
              {s.ppl.map((v, k) => (
                <g key={k} {...tip.hit([`${s.label} · ${k + 1} iteration${k ? "s" : ""} per step`, `generative perplexity: ${v.toFixed(2)}`, `sample entropy: ${s.ent[k].toFixed(2)} (data ${DATA_ENTROPY})`])}>
                  <circle cx={x(k)} cy={y1(v)} r={10} fill="transparent" />
                  <circle cx={x(k)} cy={y1(v)} r={4} fill={s.color()} stroke={P.bg} strokeWidth={2} />
                  <circle cx={x(k)} cy={y2(s.ent[k])} r={3} fill={s.color()} stroke={P.bg} strokeWidth={1.5} />
                </g>
              ))}
              <text x={W - R + 8} y={y1(s.ppl[4]) + (si ? 12 : -3)} fill={P.text} fontSize={10.5} fontWeight={600}>{s.label}</text>
              <text x={x(0) + 8} y={y1(s.ppl[0]) + 4} fill={P.muted} fontSize={10}>{s.ppl[0].toFixed(1)}</text>
              <text x={x(4) - 8} y={y1(s.ppl[4]) + (si ? 15 : -8)} fill={P.muted} fontSize={10} textAnchor="end">{s.ppl[4].toFixed(1)}</text>
            </g>
          ))}
        </svg>
        {tip.el}
      </div>
    </Frame>
  );
}

// ── 6. Three tests of the second channel ──────────────────────────────────────
// The section's point: the fed-back prediction carries real information. Three prior works
// each test that in a different way. The wire diagrams are sketches; the two bars are the
// TinyGSM accuracies reported by Davis et al. (2026).
const DAVIS = [{ label: "DoubleCat", v: 13.5 }, { label: "DoubleCat + self conditioning", v: 20.77 }];
const TESTS = [
  { tag: "Test 1 · add it", work: "Loopholing", q: "Add a second channel to a discrete model.",
    state: "on", memory: "added",
    a: "The predicted distribution is carried past the sampling step. It is no longer collapsed to one token at every step." },
  { tag: "Test 2 · use only it", work: "LAW", q: "Drop the state. Carry progress in the second channel alone.",
    state: "off", memory: "on",
    a: "Generation still works. Tokens are decoded once, at the end. The channel alone is enough." },
  { tag: "Test 3 · fix training first", work: "Davis et al.", q: "Fix the training mismatch another way (DoubleCat). Then add the channel on top.",
    bars: true,
    a: "DoubleCat recovers a large part of the gain. Adding the channel still helps, so fixing training is not the whole effect." },
];
// Two sampling steps joined by a state wire and a prediction wire. kind: "on", "off" or "added".
function Wires({ state, memory }) {
  const W = 240, bw = 50, x1 = bw, x2 = W - bw;
  const wire = (y, kind, color, label) => (
    <g>
      <line x1={x1 + 3} x2={x2 - 9} y1={y} y2={y} stroke={kind === "off" ? P.line2 : color} strokeWidth={kind === "added" ? 3 : 2} strokeDasharray={kind === "off" ? "4 4" : undefined} />
      {kind !== "off" && <path d={`M${x2 - 11},${y - 5} L${x2 - 2},${y} L${x2 - 11},${y + 5} z`} fill={color} />}
      <text x={W / 2} y={y - 6} fill={kind === "off" ? P.dim2 : P.text} fontSize={10} fontWeight={kind === "added" ? 700 : 500} textAnchor="middle">
        {label}{kind === "off" ? " · not used" : kind === "added" ? " · added" : ""}
      </text>
    </g>
  );
  return (
    <svg viewBox={`0 0 ${W} 64`} style={{ width: "100%", maxWidth: 300, height: "auto", display: "block", fontFamily: FONT }} role="img"
      aria-label={`State wire ${state}, prediction wire ${memory}`}>
      {[0, x2].map((x, k) => (
        <g key={k}>
          <rect x={x + 1} y={6} width={bw - 2} height={52} rx={7} fill={rgba(P.dim, 0.12)} stroke={P.line2} strokeWidth={1} />
          <text x={x + bw / 2} y={30} fill={P.muted} fontSize={9.5} textAnchor="middle">step</text>
          <text x={x + bw / 2} y={43} fill={P.text} fontSize={10.5} fontWeight={700} textAnchor="middle">{k ? "k + 1" : "k"}</text>
        </g>
      ))}
      {wire(24, state, P.duo, "state")}
      {wire(48, memory, P.candi, "prediction")}
    </svg>
  );
}
function DavisBars() {
  const max = 24;
  return (
    <div style={{ fontFamily: FONT }}>
      {DAVIS.map((d, k) => (
        <div key={d.label} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 10.5, color: P.muted, marginBottom: 2 }}>{d.label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: `${(d.v / max) * 100}%`, height: 12, borderRadius: "0 4px 4px 0", background: k ? P.candi : rgba(P.dim, 0.55) }} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: P.text }}>{d.v.toFixed(2)}</span>
          </div>
        </div>
      ))}
      <div style={{ fontSize: 10, color: P.dim2 }}>TinyGSM accuracy (%), temperature 0.5</div>
    </div>
  );
}
function WhereProgressInner() {
  return (
    <Frame kicker="Prior work · three tests of the second channel" title="Three tests, one answer: the fed-back prediction carries real information"
      subtitle="Each work changes something different about the second channel, the path that carries the model's last prediction to the next step. If that channel were only a small correction, none of these results should hold."
      note="The wire diagrams are sketches. The two bars are numbers reported by Davis et al. (2026); we did not rerun them.">
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginTop: 12 }}>
        {TESTS.map((t) => (
          <div key={t.work} style={{ border: `1px solid ${P.line2}`, borderRadius: 10, padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div>
              <div style={{ fontFamily: FONT, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: P.accent }}>{t.tag}</div>
              <Label>{t.work}</Label>
              <div style={{ fontSize: 12.5, color: P.muted, lineHeight: 1.4, marginTop: 2 }}>{t.q}</div>
            </div>
            <div style={{ minHeight: 78, display: "flex", alignItems: "center" }}>
              <div style={{ width: "100%" }}>{t.bars ? <DavisBars /> : <Wires state={t.state} memory={t.memory} />}</div>
            </div>
            <div style={{ fontSize: 12.5, color: P.text, lineHeight: 1.45, borderTop: `1px solid ${P.line2}`, paddingTop: 8 }}>{t.a}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export const TwoObservers = withVizTheme(TwoObserversInner);
export const ThreeSources = withVizTheme(ThreeSourcesInner);
export const UpdateKeeps = withVizTheme(UpdateKeepsInner);
export const TwoWires = withVizTheme(TwoWiresInner);
export const FixedPointIterations = withVizTheme(FixedPointInner);
export const WhereProgressLives = withVizTheme(WhereProgressInner);
