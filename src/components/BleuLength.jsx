// Where BLEU's brevity (length) penalty bites. Every TinyStories BPE run in the
// post (tokenizer ladder + the 10k runs in the SC and CDCD figures), test split,
// chosen sampler. Data: vocab_ladder.json, sc_depth_results.json,
// cdcd_performance.json (score_nobp / bp / len_ratio recomputed with sacrebleu
// 2.6.0 from the stored test samples; standard scores match the archive exactly).
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";
import { useBleuMode, BleuPills } from "./bleuMode.jsx";
import LADDER from "../data/vocab_ladder.json";
import SC from "../data/sc_depth_results.json";
import CDCD from "../data/cdcd_performance.json";
import BLOCK from "../data/block_scaling.json";

const FAMILIES = [
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "masked", label: "Masked", color: () => P.mdlm },
  { id: "uniform", label: "Uniform", color: () => P.duo },
  { id: "simplex", label: "Simplex", color: () => P.lime },
  { id: "spherical", label: "Spherical", color: () => P.orange2 },
  { id: "vmf", label: "vMF", color: () => P.pinkText },
  { id: "block", label: "Block / E2D2", color: () => P.warn },
  { id: "ar", label: "AR", color: () => P.dim2 },
];
const famOf = (id) => FAMILIES.find((f) => f.id === id);
const vlab = (v) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

function runs() {
  const out = [];
  for (const r of LADDER.rows)
    out.push({ family: r.method, vocab: r.vocab, arm: r.method === "ar" ? "" : r.sc ? "SC" : "no SC",
      bleu: r.test, nobp: r.test_nobp, len: r.test_len_ratio });
  const seen = new Set(out.map((o) => `${o.family}|${o.vocab}|${o.arm}`));
  for (const r of [...SC.rows, ...CDCD.rows]) {
    if (r.task !== "tinystories") continue;
    const arm = r.arm === "sc" ? "SC" : r.arm === "depth" ? "16 layers" : "no SC";
    const k = `${r.method}|10000|${arm}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ family: r.method, vocab: 10000, arm, bleu: r.score, nobp: r.score_nobp, len: r.len_ratio });
  }
  for (const r of BLOCK.rows) {
    if (r.task !== "tinystories" || r.status !== "completed" || r.kind === "kv") continue;
    const arm = r.kind === "shared" ? "shared 8 layers" : r.kind === "raw" ? "no encoder, decoder 8" : `encoder ${r.enc}, decoder ${r.dec}`;
    out.push({ family: "block", vocab: 10000, arm, bleu: r.score, nobp: r.score_nobp, len: r.len_ratio });
  }
  return out;
}
const RUNS = runs();

const W = 720, H = 360;
const L = 56, R = 500, T = 16, B = 300;
const X0 = 0.72, X1 = 1.06, Y0 = 5.5, Y1 = 10;
const px = (v) => L + ((Math.min(Math.max(v, X0), X1) - X0) / (X1 - X0)) * (R - L);
const py = (v) => B - ((v - Y0) / (Y1 - Y0)) * (B - T);

function BleuLengthInner() {
  const [mode] = useBleuMode();
  const [hover, setHover] = useState(null);
  const [fam, setFam] = useState(null);
  const h = hover != null && RUNS[hover];
  const shown = (r) => !fam || r.family === fam;
  const short = RUNS.filter((r) => r.len < 0.95);
  const byFam = (id) => RUNS.filter((r) => r.family === id);
  const meanLen = (id) => byFam(id).reduce((a, r) => a + r.len, 0) / byFam(id).length;

  return (
    <Frame
      kicker="A note on the metric"
      title="BLEU's length penalty hits some methods much harder than others"
      subtitle="Every TinyStories run in this post. Across: how long the model's continuations are, relative to the real endings. Hollow: standard BLEU. Filled: the same output without the length penalty."
      controls={<BleuPills />}
      note={`Test split (256 prompts, two seeds), with the sampler chosen on validation. BLEU multiplies n-gram overlap by a brevity penalty, exp(1 − real length / output length), when the output is shorter than the references. ${short.length} of ${RUNS.length} runs are under 95% of the real length. The switch above sets every TinyStories BLEU in the post. Click a method in the legend to isolate it.`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        <rect x={px(X0)} y={T} width={px(1) - px(X0)} height={B - T} fill={rgba(P.highlight, 0.05)} />
        <text x={px(X0) + 8} y={T + 14} fill={P.highlight} fontSize={10}>shorter than the real endings: penalized</text>
        {[6, 7, 8, 9, 10].map((v) => (
          <g key={v}>
            <line x1={L} x2={R} y1={py(v)} y2={py(v)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 8} y={py(v) + 3.5} fill={P.dim} fontSize={9.5} textAnchor="end">{v}</text>
          </g>
        ))}
        {[0.75, 0.8, 0.85, 0.9, 0.95, 1, 1.05].map((v) => (
          <g key={v}>
            <line x1={px(v)} x2={px(v)} y1={T} y2={B} stroke={v === 1 ? P.line2 : P.grid} strokeWidth={v === 1 ? 1.2 : 0.6} />
            <text x={px(v)} y={B + 16} fill={P.dim} fontSize={9.5} textAnchor="middle">{`${Math.round(v * 100)}%`}</text>
          </g>
        ))}
        <text x={(L + R) / 2} y={B + 34} fill={P.muted} fontSize={10.5} textAnchor="middle">output length / real length →</text>
        <text transform={`translate(16, ${(T + B) / 2}) rotate(-90)`} fill={P.muted} fontSize={10.5} textAnchor="middle">test BLEU</text>

        {RUNS.map((r, i) => {
          const c = famOf(r.family).color();
          const on = hover === i;
          const x = px(r.len);
          const filled = mode === "nobp" ? r.nobp : r.bleu;
          return (
            <g key={i} opacity={shown(r) ? 1 : 0.1} style={{ cursor: "help" }}
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <line x1={x} x2={x} y1={py(r.bleu)} y2={py(r.nobp)} stroke={c} strokeWidth={on ? 2.5 : 1.4} opacity={0.7} />
              <circle cx={x} cy={py(r.bleu)} r={on ? 5 : 3.5} fill={P.bg} stroke={c} strokeWidth={1.4} />
              <circle cx={x} cy={py(r.nobp)} r={on ? 5.5 : 4} fill={c} stroke={on ? P.text : "none"} strokeWidth={1.2} />
              <circle cx={x} cy={py(filled)} r={12} fill="transparent" />
            </g>
          );
        })}

        <g transform={`translate(${R + 30}, ${T + 4})`}>
          {h ? (
            <g>
              <text fill={famOf(h.family).color()} fontSize={12.5} fontWeight={700}>{famOf(h.family).label}{h.arm ? ` · ${h.arm}` : ""}</text>
              <text y={18} fill={P.muted} fontSize={10.5}>vocab {vlab(h.vocab)}</text>
              <text y={46} fill={P.muted} fontSize={10.5}>BLEU</text>
              <text x={170} y={46} fill={P.text} fontSize={10.5} fontWeight={700} textAnchor="end">{h.bleu.toFixed(2)}</text>
              <text y={66} fill={P.muted} fontSize={10.5}>no length penalty</text>
              <text x={170} y={66} fill={P.highlight} fontSize={10.5} fontWeight={700} textAnchor="end">{h.nobp.toFixed(2)}</text>
              <text y={86} fill={P.muted} fontSize={10.5}>length vs real</text>
              <text x={170} y={86} fill={P.text} fontSize={10.5} textAnchor="end">{Math.round(h.len * 100)}%</text>
              <text y={106} fill={P.muted} fontSize={10.5}>penalty cost</text>
              <text x={170} y={106} fill={h.nobp - h.bleu > 0.3 ? P.bad : P.text} fontSize={10.5} textAnchor="end">−{(h.nobp - h.bleu).toFixed(2)}</text>
            </g>
          ) : (
            <g>
              <text fill={P.dim} fontSize={9.5} letterSpacing="0.1em">METHOD · mean length</text>
              {FAMILIES.map((f, i) => (
                <g key={f.id} transform={`translate(0, ${22 + i * 22})`} style={{ cursor: "pointer" }}
                  onClick={() => setFam(fam === f.id ? null : f.id)}>
                  <rect x={-4} y={-12} width={176} height={20} rx={6} fill={fam === f.id ? rgba(f.color(), 0.16) : "transparent"} />
                  <circle cx={6} cy={-2} r={5} fill={f.color()} opacity={!fam || fam === f.id ? 1 : 0.3} />
                  <text x={20} y={2} fill={!fam || fam === f.id ? P.text : P.dim} fontSize={11.5}>{f.label}</text>
                  <text x={170} y={2} fill={P.muted} fontSize={10.5} textAnchor="end">{Math.round(meanLen(f.id) * 100)}%</text>
                </g>
              ))}
              <text y={22 + FAMILIES.length * 22 + 8} fill={P.dim} fontSize={9.5}>Hover a run for its scores.</text>
            </g>
          )}
        </g>
      </svg>
    </Frame>
  );
}

export const BleuLength = withVizTheme(BleuLengthInner);
export default BleuLength;
