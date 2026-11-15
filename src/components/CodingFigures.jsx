// Figures for the coding-theory parts of Part 3: a constellation, generation as decoding,
// turbo decoding, and turbo decoding mapped onto self-conditioned sampling.
// Numbers in the constellation figure are computed; the turbo EXIT curves are illustrative.
import { useEffect, useId, useMemo, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";

const btn = () => ({
  border: `1px solid ${P.line2}`, background: P.inset, color: P.muted, cursor: "pointer",
  borderRadius: 999, padding: "5px 12px", fontFamily: FONT, fontSize: 11.5,
});
const small = () => ({ fontFamily: FONT, fontSize: 11, color: P.dim2, lineHeight: 1.5 });
const strong = (v) => <strong style={{ color: P.text }}>{v}</strong>;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const normalFrom = (r) => { let a = 0; while (a === 0) a = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * r()); };

// Arrow marker defs with a unique id per figure.
function useArrow() {
  const id = `arr${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const defs = (color, name = "") => (
    <marker id={id + name} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill={color} />
    </marker>
  );
  return { id, defs };
}

function Node({ x, y, w, h = 40, title, sub, tone, on = true, dashed }) {
  const c = tone || P.dim2;
  return (
    <g opacity={on ? 1 : 0.32} style={{ transition: "opacity 250ms" }}>
      <rect x={x} y={y} width={w} height={h} rx={9} fill={rgba(c, 0.13)} stroke={c} strokeWidth={1.3} strokeDasharray={dashed ? "4 3" : undefined} />
      <text x={x + w / 2} y={y + (sub ? h / 2 - 3 : h / 2 + 4)} textAnchor="middle" fontSize={12} fontWeight={650} fill={P.text}>{title}</text>
      {sub && <text x={x + w / 2} y={y + h / 2 + 12} textAnchor="middle" fontSize={10} fill={P.muted}>{sub}</text>}
    </g>
  );
}
function Wire({ d, color, marker, label, lx, ly, on = true, dashed, anchor = "middle", width = 1.5 }) {
  return (
    <g opacity={on ? 1 : 0.25} style={{ transition: "opacity 250ms" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeDasharray={dashed ? "5 4" : undefined} markerEnd={marker ? `url(#${marker})` : undefined} />
      {label && <text x={lx} y={ly} textAnchor={anchor} fontSize={10} fill={color}>{label}</text>}
    </g>
  );
}

// ─── 1. Constellation ─────────────────────────────────────────────────────────
const LEVELS = [-3, -1, 1, 3];
const LABELS = { gray: ["00", "01", "11", "10"], plain: ["00", "01", "10", "11"] };
const SIGMAS = [{ id: "0.5", label: "low noise" }, { id: "1", label: "medium noise" }, { id: "1.6", label: "high noise" }];
const gauss = (y, m, s) => Math.exp(-((y - m) ** 2) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
// Mutual information between a group label and Y, for a 1-D constellation with equiprobable points.
// groups: array of arrays of point indices, each group equally likely.
function infoGroups(groups, s) {
  const lo = -3 - 7 * s, hi = 3 + 7 * s, n = 1400, dy = (hi - lo) / n;
  let I = 0;
  for (let i = 0; i <= n; i++) {
    const y = lo + i * dy;
    const py = LEVELS.reduce((a, m) => a + gauss(y, m, s), 0) / 4;
    if (py < 1e-300) continue;
    groups.forEach((g) => {
      const pyg = g.reduce((a, k) => a + gauss(y, LEVELS[k], s), 0) / g.length;
      if (pyg > 1e-300) I += (1 / groups.length) * pyg * Math.log2(pyg / py) * dy;
    });
  }
  return Math.max(0, I);
}
// Capacity of the binary-input Gaussian channel at snr s (amplitude 1, noise variance 1/s).
const J = (s) => {
  if (s <= 0) return 0;
  const mu = 2 * s, sd = Math.sqrt(4 * s), n = 600, lo = mu - 9 * sd, hi = mu + 9 * sd, dx = (hi - lo) / n;
  let e = 0;
  for (let i = 0; i <= n; i++) {
    const l = lo + i * dx, w = (i === 0 || i === n ? 0.5 : 1) * Math.exp(-((l - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
    e += w * (l > 30 ? Math.exp(-l) / Math.LN2 : Math.log2(1 + Math.exp(-l))) * dx;
  }
  return Math.max(0, Math.min(1, 1 - e));
};

function ConstellationInner() {
  const [shape, setShape] = useState("line");
  const [lab, setLab] = useState("gray");
  const [sig, setSig] = useState("1");
  const [seed, setSeed] = useState(3);
  const s = Number(sig);
  const labels = LABELS[lab];
  const bit = (k, j) => labels[k][j] === "1";
  const nums = useMemo(() => {
    if (shape === "square") {
      const a = Math.sqrt(2.5); // same average power as the line: (9+1+1+9)/4 = 5 = 2a²
      const each = J((a * a) / (s * s));
      return { IX: 2 * each, I1: each, I2c: each, I2: each };
    }
    const idx = [0, 1, 2, 3];
    const IX = infoGroups(idx.map((k) => [k]), s);
    const g = (j, v) => idx.filter((k) => bit(k, j) === v);
    const I1 = infoGroups([g(0, false), g(0, true)], s);
    const I2 = infoGroups([g(1, false), g(1, true)], s);
    return { IX, I1, I2c: IX - I1, I2 };
  }, [shape, lab, s]);
  // One noisy draw: a token, its noisy observation, and the posterior over tokens and bits.
  const draw = useMemo(() => {
    const r = rng(seed * 7919 + (shape === "square" ? 1 : 0));
    const k = Math.floor(r() * 4);
    if (shape === "square") {
      const a = Math.sqrt(2.5);
      const pt = [bit(k, 0) ? a : -a, bit(k, 1) ? a : -a];
      const y = [pt[0] + s * normalFrom(r), pt[1] + s * normalFrom(r)];
      const like = [0, 1, 2, 3].map((q) => gauss(y[0], bit(q, 0) ? a : -a, s) * gauss(y[1], bit(q, 1) ? a : -a, s));
      const Z = like.reduce((u, v) => u + v, 0);
      const post = like.map((v) => v / Z);
      return { k, y, post };
    }
    const y = LEVELS[k] + s * normalFrom(r);
    const like = LEVELS.map((m) => gauss(y, m, s));
    const Z = like.reduce((u, v) => u + v, 0);
    return { k, y, post: like.map((v) => v / Z) };
  }, [seed, shape, s, lab]);
  const pBit = (j) => draw.post.reduce((acc, p, q) => acc + (bit(q, j) ? p : 0), 0);
  const tok = ["A", "B", "C", "D"];
  const tone = [P.mdlm, P.duo, P.candi, P.accent2];

  const W = 440;
  let plot;
  if (shape === "line") {
    const X = (v) => 30 + ((v + 5) / 10) * (W - 60), H = 150, base = 92;
    const dens = (m) => {
      const pts = [];
      for (let i = 0; i <= 120; i++) { const v = -5 + (10 * i) / 120; pts.push(`${i ? "L" : "M"}${X(v).toFixed(1)},${(base - 52 * gauss(v, m, s) * s * Math.sqrt(2 * Math.PI)).toFixed(1)}`); }
      return pts.join(" ");
    };
    const b2lines = lab === "gray" ? [-2, 2] : [-2, 0, 2];
    plot = (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, display: "block", fontFamily: FONT }} role="img"
        aria-label={`Four tokens on a line at minus 3, minus 1, 1 and 3, labeled ${labels.join(", ")}, with Gaussian noise of spread ${s}.`}>
        {LEVELS.map((m, k) => <path key={k} d={dens(m)} fill="none" stroke={tone[k]} strokeWidth={1.4} opacity={0.75} />)}
        <line x1={X(0)} x2={X(0)} y1={30} y2={base + 4} stroke={P.text} strokeWidth={1.2} strokeDasharray="4 3" />
        <text x={X(0)} y={24} textAnchor="middle" fontSize={9.5} fill={P.text}>bit 1 line</text>
        {b2lines.filter((v) => v !== 0 || lab === "plain").map((v) => (
          <g key={v}>
            <line x1={X(v)} x2={X(v)} y1={40} y2={base + 4} stroke={P.accent} strokeWidth={1.2} strokeDasharray="2 3" />
          </g>
        ))}
        <text x={X(-2)} y={36} textAnchor="middle" fontSize={9.5} fill={P.accent}>bit 2</text>
        <line x1={20} x2={W - 20} y1={base} y2={base} stroke={P.line2} />
        {LEVELS.map((m, k) => (
          <g key={k}>
            <circle cx={X(m)} cy={base} r={6} fill={tone[k]} />
            <text x={X(m)} y={base + 22} textAnchor="middle" fontSize={11} fontWeight={650} fill={P.text}>{tok[k]}</text>
            <text x={X(m)} y={base + 36} textAnchor="middle" fontSize={11} fill={P.muted}>{labels[k]}</text>
          </g>
        ))}
        <g>
          <path d={`M${X(Math.max(-5, Math.min(5, draw.y)))},${base - 16} l-5,-9 l10,0 z`} fill={P.text} />
          <text x={X(Math.max(-5, Math.min(5, draw.y)))} y={base - 30} textAnchor="middle" fontSize={9.5} fill={P.text}>y</text>
        </g>
      </svg>
    );
  } else {
    const H = 230, c = 115, sc = 30, a = Math.sqrt(2.5);
    const cx = (v) => W / 2 + v * sc, cy = (v) => c - v * sc;
    plot = (
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, display: "block", fontFamily: FONT }} role="img"
        aria-label="Four tokens at the corners of a square; each axis carries one bit.">
        <line x1={cx(-3.5)} x2={cx(3.5)} y1={c} y2={c} stroke={P.text} strokeDasharray="4 3" />
        <line x1={W / 2} x2={W / 2} y1={cy(3.5)} y2={cy(-3.5)} stroke={P.accent} strokeDasharray="2 3" />
        <text x={cx(3.5)} y={c - 6} textAnchor="end" fontSize={9.5} fill={P.text}>bit 1 axis</text>
        <text x={W / 2 + 6} y={cy(3.3)} fontSize={9.5} fill={P.accent}>bit 2 axis</text>
        {[0, 1, 2, 3].map((k) => {
          const x = bit(k, 0) ? a : -a, y = bit(k, 1) ? a : -a;
          return (
            <g key={k}>
              <circle cx={cx(x)} cy={cy(y)} r={s * sc} fill={rgba(tone[k], 0.12)} stroke={tone[k]} strokeDasharray="3 3" />
              <circle cx={cx(x)} cy={cy(y)} r={6} fill={tone[k]} />
              <text x={cx(x) + (x > 0 ? 12 : -12)} y={cy(y) + 4} textAnchor={x > 0 ? "start" : "end"} fontSize={11} fill={P.text}>{tok[k]} {labels[k]}</text>
            </g>
          );
        })}
        <path d={`M${cx(draw.y[0])},${cy(draw.y[1]) - 6} l-5,-9 l10,0 z`} fill={P.text} />
        <text x={cx(draw.y[0])} y={cy(draw.y[1]) - 19} textAnchor="middle" fontSize={9.5} fill={P.text}>y</text>
      </svg>
    );
  }
  const bar = (label, v, max, color) => (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 1.1fr) 2fr auto", gap: 8, alignItems: "center", margin: "3px 0" }}>
      <span style={small()}>{label}</span>
      <div style={{ height: 8, borderRadius: 4, background: P.grid, overflow: "hidden" }}>
        <div style={{ width: `${Math.min(100, (v / max) * 100)}%`, height: "100%", background: color, transition: "width 250ms" }} />
      </div>
      <span style={{ ...small(), color: P.text }}>{v.toFixed(2)}</span>
    </div>
  );
  const bicm = nums.I1 + nums.I2;
  return (
    <Frame kicker="Computed · coded modulation with four tokens" title="What noise on an embedding does to the bits"
      subtitle="Four tokens, A to D, are points in space, each with a two-bit label. Gaussian noise moves the point, never the bits. Each bit's information depends on where the points sit and how they are labeled."
      controls={<>
        <Pills value={shape} onChange={setShape} options={[{ id: "line", label: "On a line" }, { id: "square", label: "Square (analog bits)" }]} />
        <Pills value={lab} onChange={setLab} options={[{ id: "gray", label: "Gray labels" }, { id: "plain", label: "Plain binary" }]} />
        <Pills value={sig} onChange={setSig} options={SIGMAS} />
        <button type="button" style={btn()} onClick={() => setSeed((v) => v + 1)}>New noisy draw</button>
      </>}
      note={shape === "line"
        ? "On a line the bits share one noisy number, so their evidence is coupled. With Gray labels, bit 1 (left or right half) is the easy bit and bit 2 the hard one. With plain binary, bit 2 alternates between neighbors, so a small push can flip it, and reading the bits one at a time loses more. The total for the token never depends on the labels. Richardson and Urbanke §5.4."
        : "Each bit has its own axis, so Gaussian noise acts on each bit separately: two independent binary-input Gaussian channels. Nothing is lost by reading the bits one at a time. This is the analog-bits setting (Chen et al. 2022). Same average power as the line."}>
      {plot}
      <div style={{ marginTop: 8 }}>
        {bar("token: I(X;Y)", nums.IX, 2, P.text)}
        {bar("bit 1: I(B₁;Y)", nums.I1, 2, P.duo)}
        {bar("bit 2 given bit 1", nums.I2c, 2, P.candi)}
        {bar("bit 2 alone: I(B₂;Y)", nums.I2, 2, P.accent2)}
      </div>
      <div style={{ ...small(), marginTop: 6 }}>
        chain rule: {strong(nums.I1.toFixed(2))} + {strong(nums.I2c.toFixed(2))} = {strong(nums.IX.toFixed(2))} bits ·
        reading each bit alone: {strong(bicm.toFixed(2))} bits (loses {strong(Math.max(0, nums.IX - bicm).toFixed(2))})
      </div>
      <div style={{ ...small(), marginTop: 4 }}>
        this draw: sent {strong(tok[draw.k])} · belief over tokens {draw.post.map((p, q) => `${tok[q]} ${(100 * p).toFixed(0)}%`).join(", ")} ·
        P(bit 1 = 1) {strong(`${(100 * pBit(0)).toFixed(0)}%`)} · P(bit 2 = 1) {strong(`${(100 * pBit(1)).toFixed(0)}%`)}
      </div>
    </Frame>
  );
}
export const Constellation = withVizTheme(ConstellationInner);

// ─── 2. Generation as decoding ────────────────────────────────────────────────
const GD_MODES = [
  { id: "coding", label: "Coding" },
  { id: "sender", label: "Insert a sender" },
  { id: "gen", label: "Generation" },
];
function GenAsDecodingInner() {
  const [mode, setMode] = useState("coding");
  const { id, defs } = useArrow();
  const W = 440, H = 280;
  const t = {
    coding: {
      a: ["message", "chosen by the sender"], b: ["encoder + channel", "adds structure, then noise"],
      c: ["received word y", "fixed once sent"], d: ["decoder", "recovers the message"],
      ab: "", bc: "noise", loop: false, cap: "A sender chooses a message, the channel damages it, and the decoder recovers it from the code's structure. The received word never changes.",
    },
    sender: {
      a: ["sender holds x₀", "a real sample"], b: ["forward step", "q(z_s | z_t, x₀)"],
      c: ["state z_s", "a cleaner look"], d: ["receiver = denoiser", "p_θ(x₀ | z_s)"],
      ab: "", bc: "costs KL bits", loop: false, cap: "Put a sender back in. It holds a real sample and sends the states one step at a time; each step costs the KL divergence between the true next state and what the receiver expected. The total is the training loss (Ho et al. 2020; Theis et al. 2022).",
    },
    gen: {
      a: ["candidate x₀", "drawn by the receiver"], b: ["forward step", "q(z_s | z_t, x₀)"],
      c: ["state z_s", "written by the sampler"], d: ["denoiser", "p_θ(x₀ | z_s)"],
      ab: "", bc: "paid in randomness", loop: true, cap: "Remove the sender. The receiver draws its own candidate from its prediction and passes it through the same forward step. With a perfect model the trajectories look exactly like the sender's. The bill is now paid in randomness, and every draw becomes part of the sample.",
    },
  }[mode];
  const col = mode === "coding" ? P.dim2 : P.accent;
  return (
    <Frame kicker="Diagram" title="From a decoder to a sampler"
      subtitle="The same loop seen three ways. Switch between them to see what changes."
      controls={<Pills value={mode} onChange={setMode} options={GD_MODES} />}
      note={t.cap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, display: "block", fontFamily: FONT }} role="img" aria-label={t.cap}>
        <defs>{defs(P.muted)}{defs(P.accent2, "o")}</defs>
        <Node x={14} y={30} w={170} h={50} title={t.a[0]} sub={t.a[1]} tone={mode === "gen" ? P.accent2 : P.duo} />
        <Node x={256} y={30} w={170} h={50} title={t.b[0]} sub={t.b[1]} tone={col} />
        <Node x={256} y={190} w={170} h={50} title={t.c[0]} sub={t.c[1]} tone={P.duo} />
        <Node x={14} y={190} w={170} h={50} title={t.d[0]} sub={t.d[1]} tone={P.candi} />
        <Wire d="M184,55 L252,55" color={P.muted} marker={id} />
        <Wire d="M341,80 L341,186" color={P.muted} marker={id} label={t.bc} lx={333} ly={160} anchor="end" />
        <Wire d="M256,215 L188,215" color={P.muted} marker={id} />
        <Wire d="M99,190 L99,84" color={P.accent2} marker={id + "o"} on={t.loop} label="next draw" lx={108} ly={118} anchor="start" />
        {mode === "sender" && <text x={99} y={20} textAnchor="middle" fontSize={10} fill={P.duo}>outside the model</text>}
        {mode === "gen" && <text x={W / 2} y={272} textAnchor="middle" fontSize={10} fill={P.dim2}>repeat until the state is clean</text>}
      </svg>
    </Frame>
  );
}
export const GenAsDecoding = withVizTheme(GenAsDecodingInner);

// ─── 3. Turbo decoding ────────────────────────────────────────────────────────
// Illustrative transfer curves for a symmetric parallel turbo code (not a real code).
const TURBO_CH = {
  good: { label: "cleaner channel", T: (I) => 1 - 0.55 * (1 - I) ** 1.6 },
  bad: { label: "noisier channel", T: (I) => 0.3 + 0.55 * I },
};
function TurboInner() {
  const [ch, setCh] = useState("good");
  const [k, setK] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { id, defs } = useArrow();
  const T = TURBO_CH[ch].T;
  const b = useMemo(() => { const out = [0]; for (let i = 0; i < 14; i++) out.push(T(out[out.length - 1])); return out; }, [ch]);
  const max = 11;
  useEffect(() => {
    if (!playing) return undefined;
    if (k >= max) { setPlaying(false); return undefined; }
    const tid = setTimeout(() => setK((v) => v + 1), 700);
    return () => clearTimeout(tid);
  }, [playing, k]);
  const active = k % 2 === 0 ? 1 : 2;
  const W = 440, H = 250;
  // EXIT chart
  const CW = 300, CH = 220, L = 40, B = 30, TT = 12, R = 12;
  const X = (v) => L + v * (CW - L - R), Y = (v) => TT + (1 - v) * (CH - TT - B);
  const xs = Array.from({ length: 101 }, (_, i) => i / 100);
  const curve1 = xs.map((v, i) => `${i ? "L" : "M"}${X(v)},${Y(T(v))}`).join(" ");
  const curve2 = xs.map((v, i) => `${i ? "L" : "M"}${X(T(v))},${Y(v)}`).join(" ");
  // Half-iteration i moves along decoder 1 (vertical, even i) or decoder 2 (horizontal, odd i).
  let stair = `M${X(0)},${Y(0)}`, px = 0, py = 0;
  for (let i = 0; i <= k; i++) {
    if (i % 2 === 0) py = b[i + 1]; else px = b[i + 1];
    stair += ` L${X(px)},${Y(py)}`;
  }
  const reached = b[k + 1];
  return (
    <Frame kicker="Diagram · EXIT curves are illustrative" title="Turbo decoding: two decoders that take turns"
      subtitle="A turbo code sends the data bits, check bits from encoder 1, and check bits from encoder 2, which reads the data in a shuffled order (π). Two decoders take turns. Each passes on only what it newly learned, the extrinsic information."
      controls={<>
        <Pills value={ch} onChange={(v) => { setCh(v); setK(0); setPlaying(false); }} options={Object.entries(TURBO_CH).map(([cid, c]) => ({ id: cid, label: c.label }))} />
        <button type="button" style={btn()} onClick={() => { setK(0); setPlaying(true); }}>{playing ? "Playing…" : "Play"}</button>
        <button type="button" style={btn()} onClick={() => { setPlaying(false); setK((v) => Math.max(0, v - 1)); }} aria-label="Previous half-iteration">Back</button>
        <button type="button" style={btn()} onClick={() => { setPlaying(false); setK((v) => Math.min(max, v + 1)); }} aria-label="Next half-iteration">Next</button>
        <span style={{ ...small(), alignSelf: "center" }}>half-iteration {k + 1}</span>
      </>}
      note="Each decoder's output for a bit is channel evidence + prior + extrinsic. Only the extrinsic part crosses to the other decoder, which uses it as its prior; this avoids feeding a decoder its own evidence back (Berrou et al. 1993; Hagenauer 2004). The EXIT chart tracks how much the prior going in knows (horizontal) against how much the extrinsic output knows (vertical). With an open tunnel the staircase climbs to full knowledge; when the curves meet, it stalls (ten Brink 2001).">
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, display: "block", fontFamily: FONT }} role="img"
        aria-label={`Turbo decoder, half-iteration ${k + 1}: decoder ${active} is active.`}>
        <defs>{defs(P.muted)}{defs(P.accent2, "e")}</defs>
        <Node x={150} y={8} w={140} h={42} title="channel" sub="y_data, y₁, y₂" tone={P.duo} />
        <Node x={14} y={100} w={136} h={56} title="decoder 1" sub="BCJR on code 1" tone={active === 1 ? P.candi : P.dim2} />
        <Node x={290} y={100} w={136} h={56} title="decoder 2" sub="BCJR on code 2" tone={active === 2 ? P.candi : P.dim2} />
        <Node x={192} y={80} w={56} h={28} title="π" tone={P.accent} />
        <Node x={192} y={150} w={56} h={28} title="π⁻¹" tone={P.accent} />
        <Wire d="M168,50 L98,96" color={P.duo} marker={id} label="y_data, y₁" lx={124} ly={66} anchor="end" />
        <Wire d="M272,50 L342,96" color={P.duo} marker={id} label="y_data, y₂" lx={316} ly={66} anchor="start" />
        <Wire d="M150,112 L172,112 L172,94 L188,94" color={P.accent2} marker={id + "e"} on={active === 1} width={2} />
        <Wire d="M248,94 L268,94 L268,112 L286,112" color={P.accent2} marker={id + "e"} on={active === 1} width={2} />
        <Wire d="M290,144 L268,144 L268,164 L252,164" color={P.accent2} marker={id + "e"} on={active === 2} width={2} />
        <Wire d="M192,164 L172,164 L172,144 L154,144" color={P.accent2} marker={id + "e"} on={active === 2} width={2} />
        <text x={220} y={74} textAnchor="middle" fontSize={10} fill={P.accent2} opacity={active === 1 ? 1 : 0.35}>extrinsic of 1 → prior of 2</text>
        <text x={220} y={194} textAnchor="middle" fontSize={10} fill={P.accent2} opacity={active === 2 ? 1 : 0.35}>extrinsic of 2 → prior of 1</text>
        <text x={220} y={222} textAnchor="middle" fontSize={10.5} fill={P.text}>each output = channel + prior + extrinsic</text>
        <text x={220} y={238} textAnchor="middle" fontSize={10.5} fill={P.accent2}>pass on only: output − channel − prior</text>
      </svg>
      <svg viewBox={`0 0 ${CW} ${CH}`} style={{ width: "100%", maxWidth: 420, display: "block", margin: "6px auto 0", fontFamily: FONT }} role="img"
        aria-label={`EXIT chart, ${TURBO_CH[ch].label}. After half-iteration ${k + 1}, the extrinsic output knows ${reached.toFixed(2)} of a bit.`}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={X(0)} x2={X(1)} y1={Y(v)} y2={Y(v)} stroke={P.grid} />
            <text x={L - 6} y={Y(v) + 3} textAnchor="end" fontSize={9} fill={P.dim2}>{v}</text>
            <text x={X(v)} y={CH - B + 13} textAnchor="middle" fontSize={9} fill={P.dim2}>{v}</text>
          </g>
        ))}
        <text x={(L + CW - R) / 2} y={CH - 4} textAnchor="middle" fontSize={9} fill={P.dim2}>information in the prior going in</text>
        <text x={10} y={(TT + CH - B) / 2} textAnchor="middle" fontSize={9} fill={P.dim2} transform={`rotate(-90 10 ${(TT + CH - B) / 2})`}>information out</text>
        <path d={curve1} fill="none" stroke={P.candi} strokeWidth={2} />
        <path d={curve2} fill="none" stroke={P.duo} strokeWidth={2} strokeDasharray="5 3" />
        <path d={stair} fill="none" stroke={P.accent2} strokeWidth={1.6} />
      </svg>
      <div style={{ ...small(), textAlign: "center" }}>
        solid: decoder 1 · dashed: decoder 2, axes swapped · staircase: decoding so far · reached {strong(reached.toFixed(2))} of 1 bit
        {ch === "bad" && k >= 6 ? " · the curves meet, so decoding stalls" : ""}
      </div>
    </Frame>
  );
}
export const TurboDecoding = withVizTheme(TurboInner);

// ─── 4. Turbo decoding mapped onto self-conditioned sampling ─────────────────
const TS_MODES = [
  { id: "none", label: "No self conditioning" },
  { id: "sc", label: "Self conditioning" },
  { id: "turbo", label: "Turbo-style (extrinsic)" },
];
function TurboSamplingInner() {
  const [mode, setMode] = useState("sc");
  const { id, defs } = useArrow();
  const W = 440, H = 300;
  const cols = [70, 220, 370];
  const names = ["t", "s", "r"];
  const cap = {
    none: "Each pass reads only the state. Like a decoder with no prior, it starts from the channel every time, and everything it worked out is dropped except what the sampler writes.",
    sc: "Self conditioning feeds the last prediction into the next pass, like a turbo decoder's prior. Unlike turbo decoding, it feeds the full prediction, which already contains what the state said, so that evidence can be counted twice.",
    turbo: "A turbo-style version would feed back only the new part: the prediction minus what the state alone already gives (in log terms). This is the extrinsic rule applied to sampling. It is our suggestion, not an existing method we know of.",
  }[mode];
  return (
    <Frame kicker="Diagram · our mapping" title="Turbo decoding, unrolled over sampling steps"
      subtitle="Three sampling steps. In each, the denoiser reads the state and predicts; the sampler writes the next state. Switch how the prediction is carried between steps."
      controls={<Pills value={mode} onChange={setMode} options={TS_MODES} />}
      note={cap}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 620, display: "block", fontFamily: FONT }} role="img" aria-label={cap}>
        <defs>{defs(P.muted)}{defs(P.accent2, "s")}</defs>
        {cols.map((x, i) => (
          <g key={i}>
            <Node x={x - 48} y={14} w={96} h={36} title={`state z_${names[i]}`} tone={P.duo} />
            <Node x={x - 48} y={104} w={96} h={36} title="denoiser" tone={P.candi} />
            <Node x={x - 48} y={194} w={96} h={36} title={`x̂_${names[i]}`} sub="" tone={P.text} />
            <Wire d={`M${x},50 L${x},100`} color={P.muted} marker={id} />
            <Wire d={`M${x},140 L${x},190`} color={P.muted} marker={id} />
            {i < 2 && <Wire d={`M${x + 48},212 Q${x + 75},212 ${x + 75},120 L${x + 75},40 Q${x + 75},32 ${cols[i + 1] - 52},32`} color={P.muted} marker={id} label="sampler" lx={x + 79} ly={84} anchor="start" />}
            {i < 2 && mode !== "none" && (
              <g>
                {mode === "turbo" && (
                  <g>
                    <circle cx={x + 75} cy={262} r={9} fill={P.inset} stroke={P.accent2} />
                    <text x={x + 75} y={266} textAnchor="middle" fontSize={12} fill={P.accent2}>−</text>
                    <text x={x + 75} y={290} textAnchor="middle" fontSize={9} fill={P.accent2}>minus state-only part</text>
                  </g>
                )}
                <Wire d={mode === "turbo"
                  ? `M${x},230 L${x},262 L${x + 64},262 M${x + 86},262 L${cols[i + 1] - 20},262 L${cols[i + 1] - 20},144`
                  : `M${x},230 L${x},262 L${cols[i + 1] - 20},262 L${cols[i + 1] - 20},144`}
                  color={P.accent2} marker={id + "s"} width={2} />
              </g>
            )}
          </g>
        ))}
        {mode !== "none" && <text x={cols[1]} y={252} textAnchor="middle" fontSize={9.5} fill={P.accent2}>{mode === "turbo" ? "extrinsic part only" : "full prediction (prior)"}</text>}
      </svg>
      <div style={{ ...small(), marginTop: 4 }}>
        coding ↔ sampling: received signal ↔ state · decoder ↔ denoiser · prior from the other decoder ↔ fed-back prediction · decoding iteration ↔ sampling step
      </div>
    </Frame>
  );
}
export const TurboSampling = withVizTheme(TurboSamplingInner);
