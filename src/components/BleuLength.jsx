// Where BLEU's brevity (length) penalty bites. Every TinyStories BPE run in the
// post (tokenizer ladder, the 10k runs in the SC and CDCD figures, and the
// block diffusion runs), test split, chosen sampler. Data: vocab_ladder.json,
// sc_depth_results.json, cdcd_performance.json, block_scaling.json
// (score_nobp / bp / len_ratio recomputed with sacrebleu 2.6.0 from the stored
// test samples; standard scores match the archives exactly).
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";
import { BleuPills } from "./bleuMode.jsx";
import LADDER from "../data/vocab_ladder.json";
import SC from "../data/sc_depth_results.json";
import CDCD from "../data/cdcd_performance.json";
import BLOCK from "../data/block_scaling.json";

const FAMILIES = [
  { id: "masked", label: "Masked", color: () => P.mdlm },
  { id: "block", label: "Block / E2D2", color: () => P.warn },
  { id: "simplex", label: "Simplex", color: () => P.lime },
  { id: "uniform", label: "Uniform", color: () => P.duo },
  { id: "spherical", label: "Spherical", color: () => P.orange2 },
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "vmf", label: "vMF", color: () => P.pinkText },
  { id: "ar", label: "AR", color: () => P.dim2 },
];
const vlab = (v) => (v >= 1000 ? `${v / 1000}k` : `${v}`);

function runs() {
  const out = [];
  for (const r of LADDER.rows)
    out.push({ family: r.method, name: `${r.method === "ar" ? "" : r.sc ? "SC, " : "no SC, "}vocab ${vlab(r.vocab)}`,
      bleu: r.test, nobp: r.test_nobp, len: r.test_len_ratio });
  const seen = new Set(out.map((o) => `${o.family}|${o.name}`));
  for (const r of [...SC.rows, ...CDCD.rows]) {
    if (r.task !== "tinystories") continue;
    const name = `${r.arm === "sc" ? "SC" : r.arm === "depth" ? "16 layers" : "no SC"}, vocab 10k`;
    if (seen.has(`${r.method}|${name}`)) continue;
    seen.add(`${r.method}|${name}`);
    out.push({ family: r.method, name, bleu: r.score, nobp: r.score_nobp, len: r.len_ratio });
  }
  for (const r of BLOCK.rows) {
    if (r.task !== "tinystories" || r.status !== "completed" || r.kind === "kv") continue;
    const name = r.kind === "shared" ? "shared, 8 layers" : r.kind === "raw" ? "no encoder" : `enc ${r.enc} / dec ${r.dec}`;
    out.push({ family: "block", name, bleu: r.score, nobp: r.score_nobp, len: r.len_ratio });
  }
  return out;
}
const RUNS = runs();
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const ROWS = FAMILIES.map((f) => {
  const rs = RUNS.filter((r) => r.family === f.id);
  return { f, rs, len: mean(rs.map((r) => r.len)), bp: mean(rs.map((r) => r.bleu / r.nobp)),
    lost: mean(rs.map((r) => r.nobp - r.bleu)), maxLost: Math.max(...rs.map((r) => r.nobp - r.bleu)) };
}).sort((a, b) => b.lost - a.lost);

const W = 720, rowH = 40, T = 46;
const H = T + ROWS.length * rowH + 14;
// columns
const LX0 = 170, LX1 = 420, L0 = 0.74, L1 = 1.06;
const lx = (v) => LX0 + ((Math.min(Math.max(v, L0), L1) - L0) / (L1 - L0)) * (LX1 - LX0);
const MX = 470;
const BX0 = 530, BX1 = 680, BMAX = 2;
const bx = (v) => BX0 + (Math.min(v, BMAX) / BMAX) * (BX1 - BX0);

function BleuLengthInner() {
  const [hover, setHover] = useState(null);
  const short = RUNS.filter((r) => r.len < 0.95).length;
  return (
    <Frame
      kicker="A note on the metric"
      title="Which models BLEU's length penalty hits"
      subtitle="Every TinyStories run in this post, grouped by method. BLEU multiplies its score by a penalty when a model's stories are shorter than the real ones, so models that stop early lose points for length alone."
      controls={<><span style={{ fontSize: 12, color: P.dim, marginRight: 8 }}>Show every TinyStories BLEU in this post as:</span><BleuPills /></>}
      note={`Test split (256 prompts, two seeds), each model's chosen sampler. Small dots are single runs; the large dot is the method's average. Penalty = exp(1 − real length / output length) when the output is shorter, else 1. ${short} of ${RUNS.length} runs are under 95% of the real length. Hover a row for its runs.`}
    >
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {/* column headers */}
        <text x={LX0} y={16} fill={P.muted} fontSize={10.5} fontWeight={600}>Story length vs real endings</text>
        <text x={MX} y={16} fill={P.muted} fontSize={10.5} fontWeight={600} textAnchor="middle">Penalty</text>
        <text x={BX0} y={16} fill={P.muted} fontSize={10.5} fontWeight={600}>BLEU lost to it</text>
        {[0.8, 0.9, 1].map((v) => (
          <g key={v}>
            <line x1={lx(v)} x2={lx(v)} y1={T - 12} y2={H - 10} stroke={v === 1 ? P.line2 : P.grid} strokeWidth={v === 1 ? 1.4 : 0.7} strokeDasharray={v === 1 ? undefined : "2 3"} />
            <text x={lx(v)} y={T - 16} fill={v === 1 ? P.text : P.dim} fontSize={9.5} textAnchor="middle">{v === 1 ? "same length" : `${v * 100}%`}</text>
          </g>
        ))}
        <rect x={LX0} y={T - 10} width={lx(1) - LX0} height={H - T} fill={rgba(P.highlight, 0.05)} />
        {[0, 1, 2].map((v) => (
          <g key={v}>
            <line x1={bx(v)} x2={bx(v)} y1={T - 12} y2={H - 10} stroke={P.grid} strokeWidth={0.7} strokeDasharray="2 3" />
            <text x={bx(v)} y={T - 16} fill={P.dim} fontSize={9.5} textAnchor="middle">{v === 0 ? "0" : `−${v}`}</text>
          </g>
        ))}

        {ROWS.map((row, i) => {
          const cy = T + i * rowH + rowH / 2 - 4;
          const c = row.f.color();
          const on = hover === row.f.id;
          return (
            <g key={row.f.id} onMouseEnter={() => setHover(row.f.id)} onMouseLeave={() => setHover(null)} style={{ cursor: "help" }}>
              <rect x={6} y={cy - rowH / 2 + 3} width={W - 12} height={rowH - 6} rx={8}
                fill={on ? rgba(c, 0.1) : i % 2 ? "transparent" : rgba(P.panel, 0.5)} />
              <circle cx={20} cy={cy} r={5} fill={c} />
              <text x={32} y={cy + 1} fill={P.text} fontSize={12.5} fontWeight={600}>{row.f.label}</text>
              <text x={32} y={cy + 14} fill={P.dim} fontSize={9.5}>{row.rs.length} runs</text>
              {/* length: runs + mean */}
              {row.rs.map((r, k) => (
                <circle key={k} cx={lx(r.len)} cy={cy} r={2.6} fill={rgba(c, 0.55)} />
              ))}
              <circle cx={lx(row.len)} cy={cy} r={6.5} fill={c} stroke={P.bg} strokeWidth={1.5} />
              {/* multiplier */}
              <text x={MX} y={cy + 4} fill={row.bp < 0.95 ? P.highlight : P.muted} fontSize={12} fontWeight={700} textAnchor="middle">×{row.bp.toFixed(2)}</text>
              {/* BLEU lost */}
              <rect x={BX0} y={cy - 6} width={Math.max(1.5, bx(row.lost) - BX0)} height={12} rx={3} fill={rgba(c, 0.85)} />
              <text x={bx(row.lost) + 6} y={cy + 4} fill={P.text} fontSize={11}>{`−${row.lost.toFixed(2)}`}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ fontFamily: FONT, fontSize: 11, color: P.muted, marginTop: 6, lineHeight: 1.7, minHeight: 64,
        display: "flex", flexWrap: "wrap", columnGap: 14 }}>
        {hover ? (() => {
          const row = ROWS.find((r) => r.f.id === hover);
          return [
            <span key="h" style={{ color: row.f.color(), fontWeight: 700 }}>{row.f.label}:</span>,
            ...row.rs.slice().sort((a, b) => a.len - b.len).map((r, k) => (
              <span key={k} style={{ whiteSpace: "nowrap" }}>
                {r.name} · {Math.round(r.len * 100)}% · {r.bleu.toFixed(2)} → {r.nobp.toFixed(2)}
              </span>
            )),
          ];
        })() : <span style={{ color: P.dim }}>Hover a row to list its runs: length, then BLEU → BLEU without the penalty.</span>}
      </div>
    </Frame>
  );
}

export const BleuLength = withVizTheme(BleuLengthInner);
export default BleuLength;
