// Tokenizer ladder: TinyStories BPE at vocab 260 / 500 / 1k / 5k / 10k.
// Data: src/data/vocab_ladder.json, extracted from the portable-v2-mi210 and
// portable-v2-mi210-ladder-nosc archives (AMD MI210, one training seed,
// 128 NFE). Every number plotted here is validation corpus BLEU (128 examples,
// seeds 41/42), so all five samplers are on the same footing. Only the winning
// sampler was scored on the test split; that number appears in the readout.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";
import DATA from "../data/vocab_ladder.json";
import { useBleuMode, BleuPills } from "./bleuMode.jsx";

const VOCABS = [260, 500, 1000, 5000, 10000];
const vocabLabel = (v) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

const METHODS = [
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "masked", label: "Masked", color: () => P.mdlm },
  { id: "uniform", label: "Uniform", color: () => P.duo },
];
const SAMPLERS = [
  { id: "native", label: "native", color: () => P.lime },
  { id: "native_greedy", label: "native greedy", color: () => P.warn },
  { id: "eb_greedy", label: "EB greedy", color: () => P.accentSoft },
  { id: "renoise_sample", label: "renoise sample", color: () => P.orange2 },
  { id: "renoise_greedy", label: "renoise greedy", color: () => P.pinkText },
];
const samplerOf = (id) => SAMPLERS.find((s) => s.id === id);

const row = (method, sc, vocab) =>
  DATA.rows.find((r) => r.method === method && r.sc === sc && r.vocab === vocab);
const val = (r, s) => r?.samplers?.[s]?.val;
const best = (r) => Math.max(...Object.values(r.samplers).map((p) => p.val));
const test = (r, mode) => (mode === "nobp" ? r.test_nobp : r.test);
// What the compare view plots: validation (native or best sampler) or the chosen sampler's test score.
const scorer = (pick, mode) => (r) => (pick === "test" ? test(r, mode) : pick === "best" ? best(r) : val(r, "native"));

// ─── Geometry ─────────────────────────────────────────────────────────────────
const W = 720, H = 350;
const L = 66, R = 540, T = 18, B = 296;
const Y0 = 4, Y1 = 10; // visible band; lower scores sit on the floor line
const FLOOR = B + 22;
const lx = (v) => Math.log(v);
const px = (v) => L + ((lx(v) - lx(VOCABS[0])) / (lx(VOCABS.at(-1)) - lx(VOCABS[0]))) * (R - L);
const py = (v) => (v < Y0 ? FLOOR : B - ((Math.min(v, Y1) - Y0) / (Y1 - Y0)) * (B - T));
const path = (pts) => {
  // Break the line where a point drops onto the floor, so collapses read as gaps.
  let d = "", pen = false;
  for (const [x, y, ok] of pts) {
    if (!ok) { pen = false; continue; }
    d += `${pen ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    pen = true;
  }
  return d;
};

function Axes({ label = "validation BLEU" }) {
  return (
    <g>
      {[4, 5, 6, 7, 8, 9, 10].map((v) => (
        <g key={v}>
          <line x1={L} x2={R} y1={py(v)} y2={py(v)} stroke={P.grid} strokeWidth={1} />
          <text x={L - 8} y={py(v) + 3.5} fill={P.dim} fontSize={10} textAnchor="end">{v}</text>
        </g>
      ))}
      <line x1={L} x2={R} y1={FLOOR} y2={FLOOR} stroke={P.line2} strokeDasharray="2 4" />
      <text x={L - 8} y={FLOOR + 3.5} fill={P.dim} fontSize={9.5} textAnchor="end">&lt;4</text>
      {VOCABS.map((v) => (
        <text key={v} x={px(v)} y={FLOOR + 22} fill={P.muted} fontSize={10.5} textAnchor="middle">{vocabLabel(v)}</text>
      ))}
      <text x={(L + R) / 2} y={FLOOR + 38} fill={P.dim} fontSize={10} textAnchor="middle">vocabulary size (log scale)</text>
      <text x={14} y={(T + B) / 2} fill={P.dim} fontSize={10} textAnchor="middle" transform={`rotate(-90 14 ${(T + B) / 2})`}>{label}</text>
    </g>
  );
}

function ArLine({ score = best }) {
  const pts = VOCABS.map((v) => {
    const r = row("ar", null, v);
    return [px(v), py(score(r)), true];
  });
  return (
    <g>
      <path d={path(pts)} fill="none" stroke={P.dim2} strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={R + 6} y={pts.at(-1)[1] + 3.5} fill={P.dim2} fontSize={10}>AR</text>
    </g>
  );
}

function HoverBand({ hover, setHover }) {
  return VOCABS.map((v, i) => {
    const x0 = i === 0 ? L - 20 : (px(VOCABS[i - 1]) + px(v)) / 2;
    const x1 = i === VOCABS.length - 1 ? R + 20 : (px(v) + px(VOCABS[i + 1])) / 2;
    return (
      <g key={v}>
        {hover === v && <rect x={px(v) - 14} y={T} width={28} height={FLOOR - T + 6} rx={6} fill={rgba(P.accent, 0.08)} />}
        <rect x={x0} y={T} width={x1 - x0} height={FLOOR - T + 30} fill="transparent"
          onMouseEnter={() => setHover(v)} onMouseLeave={() => setHover(null)} />
      </g>
    );
  });
}

// ─── View 1: sampler breakdown for one method ─────────────────────────────────
function SamplerView({ method, sc, hover, setHover }) {
  return (
    <g>
      <Axes />
      <ArLine />
      {SAMPLERS.map((s) => {
        const pts = VOCABS.map((v) => {
          const y = val(row(method, sc, v), s.id);
          return [px(v), py(y), y >= Y0];
        });
        return (
          <g key={s.id}>
            <path d={path(pts)} fill="none" stroke={s.color()} strokeWidth={2} opacity={0.9} />
            {VOCABS.map((v, i) => {
              const r = row(method, sc, v);
              const win = r.chosen === s.id;
              const floor = !pts[i][2];
              return (
                <g key={v}>
                  {win && <circle cx={pts[i][0]} cy={pts[i][1]} r={8} fill="none" stroke={P.text} strokeWidth={1.5} />}
                  <circle cx={pts[i][0] + (floor ? (SAMPLERS.indexOf(s) - 2) * 7 : 0)} cy={pts[i][1]} r={floor ? 3 : 4}
                    fill={floor ? "none" : s.color()} stroke={s.color()} strokeWidth={1.5} />
                </g>
              );
            })}
          </g>
        );
      })}
      <HoverBand hover={hover} setHover={setHover} />
    </g>
  );
}

// ─── View 2: compare methods (best sampler vs native) ─────────────────────────
function MethodView({ pick, mode, hover, setHover }) {
  const score = scorer(pick, mode);
  const label = pick === "test" ? (mode === "nobp" ? "test BLEU, no length penalty" : "test BLEU") : "validation BLEU";
  return (
    <g>
      <Axes label={label} />
      <ArLine score={pick === "test" ? score : best} />
      {METHODS.map((m) => [false, true].map((sc) => {
        const pts = VOCABS.map((v) => [px(v), py(score(row(m.id, sc, v))), true]);
        return (
          <g key={`${m.id}${sc}`}>
            <path d={path(pts)} fill="none" stroke={m.color()} strokeWidth={sc ? 2.4 : 1.8}
              strokeDasharray={sc ? undefined : "4 3"} opacity={sc ? 1 : 0.85} />
            {pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={sc ? 4 : 3.5} fill={sc ? m.color() : P.bg} stroke={m.color()} strokeWidth={1.6} />
            ))}
          </g>
        );
      }))}
      <HoverBand hover={hover} setHover={setHover} />
    </g>
  );
}

// ─── Readout panel ────────────────────────────────────────────────────────────
function Readout({ view, method, sc, pick, mode, hover }) {
  const x = 588;
  const line = (y, color, label, value, bold, extra) => (
    <g key={label + y}>
      <circle cx={x} cy={y - 3.5} r={4} fill={color} />
      <text x={x + 10} y={y} fill={bold ? P.text : P.muted} fontSize={10.5} fontWeight={bold ? 700 : 400}>{label}</text>
      {value != null && <text x={W - 6} y={y} fill={bold ? P.text : P.muted} fontSize={10.5} fontWeight={bold ? 700 : 400} textAnchor="end">{value}</text>}
      {extra}
    </g>
  );
  if (view === "samplers") {
    const v = hover;
    const r = v && row(method, sc, v);
    return (
      <g>
        <text x={x - 6} y={T + 6} fill={P.dim} fontSize={10} letterSpacing="0.08em">{v ? `VOCAB ${vocabLabel(v)}` : "SAMPLERS"}</text>
        {SAMPLERS.map((s, i) => line(T + 30 + i * 22, s.color(), s.label,
          r ? val(r, s.id).toFixed(2) : null, r && r.chosen === s.id))}
        {line(T + 30 + 5 * 22, P.dim2, "AR (best)", v ? best(row("ar", null, v)).toFixed(2) : null)}
        <g transform={`translate(${x - 6}, ${T + 30 + 6 * 22 + 8})`}>
          {r ? (
            <>
              <text fill={P.muted} fontSize={10}>chosen: <tspan fill={samplerOf(r.chosen).color()}>{samplerOf(r.chosen).label}</tspan></text>
              <text y={16} fill={P.muted} fontSize={10}>test BLEU: <tspan fill={P.text} fontWeight={700}>{r.test.toFixed(2)}</tspan></text>
              <text y={32} fill={P.muted} fontSize={10}>no length penalty: <tspan fill={P.highlight} fontWeight={700}>{r.test_nobp.toFixed(2)}</tspan></text>
              <text y={48} fill={P.dim} fontSize={9.5}>length {Math.round(r.test_len_ratio * 100)}% of real</text>
            </>
          ) : (
            <>
              <circle cx={6} cy={-3.5} r={7} fill="none" stroke={P.text} strokeWidth={1.5} />
              <text x={20} fill={P.muted} fontSize={10}>= chosen sampler</text>
              <text y={18} fill={P.dim} fontSize={9.5}>Hover a vocab size</text>
              <text y={32} fill={P.dim} fontSize={9.5}>for every score.</text>
            </>
          )}
        </g>
      </g>
    );
  }
  const v = hover;
  const score = scorer(pick, mode);
  const head = pick === "test" ? (mode === "nobp" ? "TEST · NO PENALTY" : "TEST · CHOSEN") : pick === "best" ? "BEST SAMPLER" : "NATIVE ONLY";
  return (
    <g>
      <text x={x - 6} y={T + 6} fill={P.dim} fontSize={10} letterSpacing="0.08em">{v ? `VOCAB ${vocabLabel(v)}` : head}</text>
      {METHODS.map((m, mi) => [true, false].map((s, si) => {
        const r = v && row(m.id, s, v);
        const y = T + 30 + (mi * 2 + si) * 20 + mi * 6;
        return (
          <g key={`${m.id}${s}`}>
            <line x1={x - 7} x2={x + 5} y1={y - 3.5} y2={y - 3.5} stroke={m.color()} strokeWidth={2.4} strokeDasharray={s ? undefined : "3 2"} />
            <text x={x + 10} y={y} fill={s ? P.text : P.muted} fontSize={10.5} fontWeight={s ? 700 : 400}>{`${m.label}${s ? " + SC" : ""}`}</text>
            {r && <text x={W - 6} y={y} fill={s ? P.text : P.muted} fontSize={10.5} fontWeight={s ? 700 : 400} textAnchor="end">{score(r).toFixed(2)}</text>}
          </g>
        );
      }))}
      {line(T + 30 + 6 * 20 + 18, P.dim2, pick === "test" ? "AR" : "AR (best)", v ? (pick === "test" ? score : best)(row("ar", null, v)).toFixed(2) : null)}
      <text x={x - 6} y={T + 30 + 7 * 20 + 30} fill={P.dim} fontSize={9.5}>solid = SC</text>
      <text x={x - 6} y={T + 30 + 7 * 20 + 44} fill={P.dim} fontSize={9.5}>dashed = no SC</text>
      {!v && <text x={x - 6} y={T + 30 + 7 * 20 + 64} fill={P.dim} fontSize={9.5}>Hover a vocab size.</text>}
    </g>
  );
}

function VocabLadderInner() {
  const [mode] = useBleuMode();
  const [view, setView] = useState("samplers");
  const [method, setMethod] = useState("gaussian");
  const [sc, setSc] = useState(false);
  const [pick, setPick] = useState("native");
  const [hover, setHover] = useState(null);
  return (
    <Frame
      kicker="Figure I · tokenizer ladder"
      title="How each sampler does as the vocabulary grows"
      subtitle={view === "methods" && pick === "test"
        ? "TinyStories with BPE tokenizers from 260 tokens (bytes) to 10k. Each model's chosen sampler, scored on the test split."
        : "TinyStories with BPE tokenizers from 260 tokens (bytes) to 10k. Each model was tuned with five samplers; these are validation scores for all of them."}
      controls={<>
        <Pills value={view} onChange={setView} options={[{ id: "samplers", label: "Samplers per method" }, { id: "methods", label: "Compare methods" }]} />
        {view === "samplers" ? <>
          <Pills value={method} onChange={setMethod} options={METHODS} />
          <Pills value={sc ? "sc" : "none"} onChange={(id) => setSc(id === "sc")}
            options={[{ id: "none", label: "no SC" }, { id: "sc", label: "SC", color: () => P.candi }]} />
        </> : (
          <>
            <Pills value={pick} onChange={setPick} options={[{ id: "native", label: "Native · val" }, { id: "best", label: "Best · val" }, { id: "test", label: "Chosen · test" }]} />
            {pick === "test" && <BleuPills />}
          </>
        )}
      </>}
      note="Validation corpus BLEU, 128 examples, two seeds, 128 NFE, one training seed; differences under about 0.3 are within seed noise. Validation scores can only be shown with the length penalty; the chosen sampler's test score (256 examples) can be shown either way under Compare methods → Chosen · test. Scores under 4 sit on the dotted floor. Native and renoising tune the temperature (16 tries); the greedy variants only choose the final step (2 tries). AR = the same 8-layer transformer trained left to right, best of its two samplers."
    >
      <svg viewBox={`0 0 ${W} ${H + 20}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {view === "samplers"
          ? <SamplerView method={method} sc={sc} hover={hover} setHover={setHover} />
          : <MethodView pick={pick} mode={mode} hover={hover} setHover={setHover} />}
        <Readout view={view} method={method} sc={sc} pick={pick} mode={mode} hover={hover} />
      </svg>
    </Frame>
  );
}

export const VocabLadder = withVizTheme(VocabLadderInner);
export default VocabLadder;
