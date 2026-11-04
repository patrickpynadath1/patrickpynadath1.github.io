// Block diffusion: scaling the encoder vs scaling the decoder (E2D2) against a
// shared-transformer block baseline. Data: src/data/block_scaling.json, built
// from the portable-v2-mi210 snapshot (final test scores, one training seed,
// two evaluation seeds, 128 NFE, block size 32, native samplers only).
import { useMemo, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, Pills, rgba } from "./SelfCondDepth.jsx";
import DATA from "../data/block_scaling.json";

const TASKS = [
  { id: "text8", label: "text8", metric: "unique valid words / sample", fmt: (v) => v.toFixed(2), tick: (v) => v.toFixed(0) },
  { id: "tinystories", label: "TinyStories (BPE 10k)", metric: "reference BLEU", fmt: (v) => v.toFixed(2), tick: (v) => v.toFixed(1) },
  { id: "sudoku_hard", label: "Sudoku (unvalidated)", metric: "solve rate", fmt: (v) => `${(v * 100).toFixed(1)}%`, tick: (v) => `${(v * 100).toFixed(0)}%`, weak: true },
];
const LAYERS = [0, 1, 2, 4, 8];
const POLICY = { native: "native", native_greedy: "native greedy" };

const SERIES = [
  { id: "dec", label: "Scale the decoder", sub: "encoder fixed at 8", color: () => P.highlight },
  { id: "enc", label: "Scale the encoder", sub: "decoder fixed at 8", color: () => P.duo },
  { id: "kv", label: "Encoder-K/V mixture", sub: "reads all encoder layers", color: () => P.accent },
];

const describe = (r) => {
  if (r.kind === "shared") return "Shared transformer, 8 layers";
  if (r.kind === "raw") return "No encoder (raw context) · decoder 8";
  if (r.kind === "kv") return `K/V mixture · encoder ${r.enc} · decoder ${r.dec}`;
  return `Encoder ${r.enc} · decoder ${r.dec}`;
};

function niceTicks(lo, hi, n = 5) {
  const step0 = (hi - lo) / n;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(6));
  return out;
}

const move = (x, y) => ({ transform: `translate(${x}px, ${y}px)`, transition: "transform 700ms cubic-bezier(.2,.8,.2,1)" });

function BlockEncDecInner() {
  const [task, setTask] = useState("text8");
  const [view, setView] = useState("layers");
  const [hover, setHover] = useState(null);
  const T0 = TASKS.find((t) => t.id === task);

  const rows = useMemo(() => DATA.rows.filter((r) => r.task === task && r.status === "completed"), [task]);
  const pending = DATA.rows.filter((r) => r.task === task && r.status !== "completed");
  const shared = rows.find((r) => r.kind === "shared");
  // E2D2 8/8 is the top of both scaling paths.
  const dec = rows.filter((r) => r.kind === "e2d2" && r.enc === 8).sort((a, b) => a.dec - b.dec);
  const enc = rows.filter((r) => (r.kind === "e2d2" && r.dec === 8) || r.kind === "raw").sort((a, b) => a.enc - b.enc);
  const kv = rows.filter((r) => r.kind === "kv");

  const L = 58, T = 16, W = 430, H = 300;
  const vals = rows.flatMap((r) => [r.score, ...r.seeds]);
  const lo0 = Math.min(...vals), hi0 = Math.max(...vals), pad = (hi0 - lo0) * 0.1;
  const yDom = [Math.max(0, lo0 - pad), hi0 + pad];
  const y = (v) => T + H - ((v - yDom[0]) / (yDom[1] - yDom[0])) * H;
  const yTicks = niceTicks(yDom[0], yDom[1]);

  const tMax = Math.max(...rows.map((r) => r.eval_seconds)) * 1.08;
  const xTime = (s) => L + (s / tMax) * W;
  const xLayer = (n) => L + 22 + (LAYERS.indexOf(n) / (LAYERS.length - 1)) * (W - 44);
  const xOf = (r, side) => (view === "time" ? xTime(r.eval_seconds) : xLayer(side === "dec" ? r.dec : r.enc));
  const xTicks = view === "time" ? niceTicks(0, tMax, 5) : LAYERS;

  const line = (pts, side) => pts.map((r, i) => `${i ? "L" : "M"}${xOf(r, side).toFixed(1)},${y(r.score).toFixed(1)}`).join("");
  const encMain = enc.filter((r) => r.kind !== "raw");
  const raw = enc.find((r) => r.kind === "raw");

  const gain = (pts) => (pts.length > 1 ? pts[pts.length - 1].score - pts[0].score : null);
  const dGain = gain(dec), eGain = gain(encMain);
  const fmtGain = (g) => (g == null ? "n/a" : `${g >= 0 ? "+" : "−"}${T0.fmt(Math.abs(g))}`);

  const h = hover && rows.find((r) => r.name === hover);
  const RX = L + W + 30;

  const point = (r, side, color, shape = "circle") => {
    const px = xOf(r, side), py = y(r.score);
    const on = hover === r.name;
    const lo = Math.min(...r.seeds), hi = Math.max(...r.seeds);
    return (
      <g key={r.name + side} style={move(px, py)} onMouseEnter={() => setHover(r.name)} onMouseLeave={() => setHover(null)} cursor="pointer">
        <line x1={0} x2={0} y1={y(lo) - py} y2={y(hi) - py} stroke={color} strokeWidth={1.4} opacity={0.55} />
        <circle r={14} fill="transparent" />
        {shape === "diamond"
          ? <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" fill={P.bg} stroke={color} strokeWidth={2} />
          : <circle r={on ? 6.5 : 5} fill={r.kind === "raw" ? P.bg : color} stroke={color} strokeWidth={2} />}
        {view === "time" && (side === "dec" || r.kind === "kv") && (
          <text x={8} y={-7} fill={color} fontSize={9.5}>{r.kind === "kv" ? `K/V enc ${r.enc}` : `dec ${r.dec}`}</text>
        )}
      </g>
    );
  };

  return (
    <Frame
      kicker="Figure H · encoder or decoder?"
      title="Decoder depth drives quality. Encoder depth barely moves it."
      subtitle="E2D2 splits block diffusion into an encoder that reads the clean context and a decoder that denoises the current block. Orange: decoder depth grows with an 8-layer encoder. Blue: encoder depth grows with an 8-layer decoder. Both paths end at the same 8/8 model. Dashed line: ordinary block diffusion with one shared 8-layer transformer."
      controls={<>
        <Pills value={task} onChange={(v) => { setTask(v); setHover(null); }} options={TASKS.map((t) => ({ id: t.id, label: t.label }))} />
        <Pills value={view} onChange={setView} options={[{ id: "layers", label: "By layer count" }, { id: "time", label: "By inference time" }]} />
      </>}
      note={<>
        Final test scores on 256 held-out examples. Bars span the two evaluation seeds; there is one training seed, so gaps smaller than a bar are noise.
        All models: 20k updates, block size 32, 128 NFE, native or native-greedy sampler chosen on validation (renoising was not supported for block models).
        Inference time: seconds to generate the 256 test examples, mean of both seeds, same GPU type.
        {T0.weak && <> <b>Sudoku:</b> the block settings for Sudoku were never validated and every block model solves under 5% of puzzles, so read this tab as a broken configuration, not a result.</>}
        {pending.length > 0 && <> Still running in this snapshot: {pending.map(describe).join(", ")}.</>}
      </>}
    >
      <svg viewBox="0 0 720 370" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, opacity: T0.weak ? 0.75 : 1 }}>
        <rect x={L} y={T} width={W} height={H} fill={rgba(P.panel, 0.6)} rx={4} />
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={L + W} y1={y(v)} y2={y(v)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 6} y={y(v) + 3} fill={P.dim} fontSize={9.5} textAnchor="end">{T0.tick(v)}</text>
          </g>
        ))}
        {xTicks.map((v) => {
          const px = view === "time" ? xTime(v) : xLayer(v);
          return (
            <g key={`x${view}${v}`}>
              <line x1={px} x2={px} y1={T} y2={T + H} stroke={P.grid} strokeWidth={0.6} />
              <text x={px} y={T + H + 14} fill={P.dim} fontSize={9.5} textAnchor="middle">{view === "time" ? `${v}s` : v}</text>
            </g>
          );
        })}
        <text x={L + W / 2} y={T + H + 34} fill={P.muted} fontSize={10.5} textAnchor="middle">
          {view === "time" ? "inference time for 256 samples (lower is cheaper)" : "layers in the side being scaled (other side fixed at 8)"}
        </text>
        <text transform={`translate(14, ${T + H / 2}) rotate(-90)`} fill={P.muted} fontSize={10.5} textAnchor="middle">{T0.metric}</text>

        {shared && view === "layers" && (
          <g pointerEvents="none">
            <line x1={L} x2={L + W} y1={y(shared.score)} y2={y(shared.score)} stroke={P.candi} strokeWidth={1.6} strokeDasharray="6 5" />
            <rect x={L} y={y(Math.max(...shared.seeds))} width={W} height={Math.max(1, y(Math.min(...shared.seeds)) - y(Math.max(...shared.seeds)))} fill={rgba(P.candi, 0.08)} />
          </g>
        )}
        {shared && view === "time" && (
          <g style={move(xTime(shared.eval_seconds), y(shared.score))} onMouseEnter={() => setHover(shared.name)} onMouseLeave={() => setHover(null)} cursor="pointer">
            <line x1={0} x2={0} y1={y(Math.min(...shared.seeds)) - y(shared.score)} y2={y(Math.max(...shared.seeds)) - y(shared.score)} stroke={P.candi} strokeWidth={1.4} opacity={0.55} />
            <circle r={14} fill="transparent" />
            <rect x={-5.5} y={-5.5} width={11} height={11} rx={2} fill={P.candi} />
            <text x={8} y={-7} fill={P.candi} fontSize={9.5}>shared</text>
          </g>
        )}

        <path d={line(dec, "dec")} fill="none" stroke={P.highlight} strokeWidth={2.2} style={{ transition: "d 700ms cubic-bezier(.2,.8,.2,1)" }} pointerEvents="none" />
        <path d={line(encMain, "enc")} fill="none" stroke={P.duo} strokeWidth={2.2} style={{ transition: "d 700ms cubic-bezier(.2,.8,.2,1)" }} pointerEvents="none" />
        {raw && encMain[0] && (
          <path d={line([raw, encMain[0]], "enc")} fill="none" stroke={P.duo} strokeWidth={1.6} strokeDasharray="3 4" style={{ transition: "d 700ms cubic-bezier(.2,.8,.2,1)" }} pointerEvents="none" />
        )}
        {enc.map((r) => point(r, "enc", P.duo))}
        {dec.map((r) => point(r, "dec", P.highlight))}
        {kv.map((r) => point(r, "enc", P.accent, "diamond"))}
        {view === "time" && enc.length > 0 && (() => {
          const top = Math.max(...enc.map((r) => r.score));
          const xs = enc.map((r) => xTime(r.eval_seconds));
          return (
            <text x={Math.min(...xs) - 10} y={y(top) - 12} fill={P.duo} fontSize={9.5} textAnchor="end" pointerEvents="none"
              style={{ transition: "x 700ms, y 700ms" }}>
              enc {enc[0].enc}–{enc[enc.length - 1].enc}
            </text>
          );
        })()}

        <g transform={`translate(${RX}, ${T + 4})`} fontSize={10.5}>
          {SERIES.filter((s) => s.id !== "kv" || kv.length).map((s, i) => (
            <g key={s.id} transform={`translate(0, ${i * 32})`}>
              {s.id === "kv"
                ? <rect x={3} y={-8} width={8} height={8} transform="rotate(45 7 -4)" fill={P.bg} stroke={s.color()} strokeWidth={2} />
                : <line x1={0} x2={16} y1={-4} y2={-4} stroke={s.color()} strokeWidth={2.4} />}
              <text x={22} fill={s.color()} fontWeight={650}>{s.label}</text>
              <text x={22} y={13} fill={P.dim} fontSize={9.5}>{s.sub}</text>
            </g>
          ))}
          {shared && (
            <g transform={`translate(0, ${(kv.length ? 3 : 2) * 32})`}>
              <line x1={0} x2={16} y1={-4} y2={-4} stroke={P.candi} strokeWidth={1.8} strokeDasharray="5 4" />
              <text x={22} fill={P.candi} fontWeight={650}>Shared block (8 layers)</text>
              <text x={22} y={13} fill={P.dim} fontSize={9.5}>one transformer for both</text>
            </g>
          )}

          <g transform={`translate(0, ${(kv.length ? 4 : 3) * 32 + 8})`}>
            <line x1={0} x2={190} y1={-12} y2={-12} stroke={P.line2} />
            {h ? (
              <>
                <text fill={P.text} fontWeight={650}>{describe(h)}</text>
                <text y={18} fill={P.muted}>test <tspan fill={P.text}>{T0.fmt(h.score)}</tspan></text>
                <text y={34} fill={P.muted}>seeds <tspan fill={P.text}>{h.seeds.map(T0.fmt).join(" / ")}</tspan></text>
                <text y={50} fill={P.muted}>validation <tspan fill={P.text}>{T0.fmt(h.validation)}</tspan></text>
                <text y={66} fill={P.muted}>sampler <tspan fill={P.text}>{POLICY[h.policy] || h.policy}</tspan></text>
                <text y={82} fill={P.muted}>inference <tspan fill={P.text}>{h.eval_seconds.toFixed(1)}s</tspan></text>
                <text y={98} fill={P.muted}>training <tspan fill={P.text}>~{h.train_hours.toFixed(1)} h</tspan></text>
              </>
            ) : (
              <>
                <text fill={P.muted}>Going from 1 to 8 layers</text>
                <text y={20} fill={P.highlight}>decoder <tspan fill={P.text} fontWeight={650}>{fmtGain(dGain)}</tspan></text>
                <text y={38} fill={P.duo}>encoder <tspan fill={P.text} fontWeight={650}>{fmtGain(eGain)}</tspan></text>
                <text y={62} fill={P.dim} fontSize={9.5}>Hover a point for details.</text>
              </>
            )}
          </g>
        </g>
      </svg>
    </Frame>
  );
}

export const BlockEncDec = withVizTheme(BlockEncDecInner);
export default BlockEncDec;
