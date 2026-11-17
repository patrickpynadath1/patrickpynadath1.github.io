// Part 3 map: DLM recipes placed by how hard their commits are (rows) and by how
// much the noisy state says about each position's reliability (columns: the spread
// of |L|, the size of the log-likelihood ratio). Each card carries a small sketch of
// that spread. The SC toggle pulls every recipe part of the way toward the center.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";

const W = 600, H = 392;
const CENTER = { x: 330, y: 190 };
const PULL = 0.25;
const CW = 150, CH = 54;
const wOf = (n) => n.w || CW;
const SANS = "Helvetica, Arial, sans-serif";

// Each recipe: position without SC, color, |L| sketch, and the caption shown on click.
const NODES = [
  { id: "uniform", label: "Uniform", x: 160, y: 84, color: () => P.duo, glyph: "spike",
    text: "No labels, hard commits. A replaced token is another valid token, so it looks just like a clean one. Every position gets the same trust, set by the noise level." },
  { id: "masked", label: "Masked", x: 500, y: 84, color: () => P.mdlm, glyph: "ends",
    text: "Exact labels, hard commits. Every position is either blank or certain, and the model can see which." },
  { id: "ug", label: "Uniform + Gaussian", x: 205, y: 190, color: () => P.muted, glyph: "lean",
    text: "The Gaussian copy labels the uniform tokens: when a token and its noisy embedding disagree, the model can doubt the token. The labels are only as sharp as the Gaussian noise allows." },
  { id: "mg", label: "Masked + Gaussian", x: 455, y: 190, color: () => P.muted, glyph: "bumpEnd",
    text: "Revealed positions stay certain. Masked positions are no longer total blanks: they carry graded evidence from the Gaussian copy." },
  { id: "gauss", label: "Gaussian, sphere, vMF", x: 355, y: 298, color: () => P.accent, glyph: "bump",
    text: "Graded labels, soft commits. A position's trust is its margin: how much closer the noisy point is to the nearest token than to the runner-up. The learned embedding layout makes recovery coarse to fine." },
  { id: "simplex", label: "Simplex", x: 165, y: 298, w: 110, color: () => P.accent, glyph: "lean",
    text: "Soft commits, weak labels at the small concentration used here. A token sampled from the noisy simplex point has the same distribution as under discrete (here uniform) diffusion (Deschenaux et al., Proposition 3.1). Raising the concentration moves it toward a Gaussian-like path with sharper labels (Proposition 4.1); it can never reach masked." },
];

const pos = (n, sc) => (sc
  ? { x: n.x + (CENTER.x - n.x) * PULL, y: n.y + (CENTER.y - n.y) * PULL }
  : { x: n.x, y: n.y });

// A tiny histogram of |L|: left edge is |L| = 0 (no trust), right edge is |L| = ∞ (certain).
function Glyph({ kind, x, y, w = 44, h = 16, color }) {
  const base = y + h;
  const bar = (bx, bh) => <rect x={x + bx - 2} y={base - bh} width={4} height={bh} rx={1} fill={color} />;
  const bump = (cx, sd, peak) => {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const u = i / 24, px = x + u * w;
      pts.push(`${px.toFixed(1)},${(base - peak * Math.exp(-((u - cx) ** 2) / (2 * sd * sd))).toFixed(1)}`);
    }
    return <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />;
  };
  return (
    <g>
      <line x1={x} y1={base + 0.5} x2={x + w} y2={base + 0.5} stroke={P.line2} strokeWidth={1} />
      {kind === "spike" && bar(w * 0.45, h)}
      {kind === "ends" && <>{bar(3, h)}{bar(w - 3, h)}</>}
      {kind === "bump" && bump(0.5, 0.2, h)}
      {kind === "bumpEnd" && <>{bump(0.38, 0.16, h * 0.8)}{bar(w - 3, h)}</>}
      {kind === "lean" && bump(0.5, 0.11, h)}
    </g>
  );
}

function ReliabilityMapInner({ kicker = "Figure 1" }) {
  const [pick, setPick] = useState("gauss");
  const on = true; // static figure: the self-conditioning view, with dashed outlines at the starting spots
  const picked = NODES.find((n) => n.id === pick);
  const move = (x, y) => ({ transform: `translate(${x}px, ${y}px)` });

  return (
    <Frame
      kicker={kicker}
      title="Two axes instead of one"
      subtitle="Rows: how hard the state's commits are. Columns: how much the noisy state says about each position's reliability. Dashed outlines mark where each recipe sits on its own; the filled cards show where self conditioning (SC) pulls it. The sketch on each card is the spread of |L| across positions, from no trust (left) to certain (right)."
      note={<span><strong style={{ color: picked.color() }}>{picked.label}.</strong> {picked.text}
        {on && <> <span style={{ color: P.candi }}>With self conditioning,</span> every recipe also receives its previous prediction: a soft, labeled belief for every position. Each recipe moves toward the center, but its state still sets how it commits.</>}
        <span style={{ color: P.dim }}> Click a card to read about it.</span></span>}
    >
      <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 30 ${W} ${H - 30}`} width="100%" role="img" aria-label="Map of DLM recipes by commitment and reliability labels" style={{ display: "block", fontFamily: SANS, minWidth: 520 }}>
        {/* row bands */}
        <rect x={64} y={40} width={W - 74} height={92} rx={10} fill={rgba(P.text, 0.03)} />
        <rect x={64} y={250} width={W - 74} height={96} rx={10} fill={rgba(P.text, 0.03)} />
        <text x={14} y={82} fontSize={12} fill={P.muted}>Hard</text>
        <text x={14} y={97} fontSize={12} fill={P.muted}>commits</text>
        <text x={14} y={293} fontSize={12} fill={P.muted}>Soft</text>
        <text x={14} y={308} fontSize={12} fill={P.muted}>commits</text>

        {/* continuous family outline */}
        <rect x={100} y={262} width={340} height={74} rx={10} fill="none" stroke={P.line2} strokeDasharray="5 4"
          style={{ opacity: on ? 0 : 1, transition: "opacity 400ms" }} />
        <text x={108} y={256} fontSize={11} fill={P.dim2} fontFamily={FONT} style={{ opacity: on ? 0 : 1, transition: "opacity 400ms" }}>continuous</text>


        {/* simplex concentration arrow */}
        <g style={{ opacity: on ? 0 : 1, transition: "opacity 400ms" }}>
          <line x1={165} y1={341} x2={262} y2={341} stroke={P.accent} strokeWidth={1.2} strokeDasharray="4 3" />
          <path d="M256,337 L263,341 L256,345" fill="none" stroke={P.accent} strokeWidth={1.2} />
          <text x={272} y={345} fontSize={11} fill={P.accent} fontFamily={FONT}>larger concentration</text>
        </g>

        {/* self conditioning center */}
        <g style={{ opacity: on ? 1 : 0, transition: "opacity 500ms" }}>
          <circle cx={CENTER.x} cy={CENTER.y} r={17} fill={rgba(P.candi, 0.12)} stroke={P.candi} strokeDasharray="3 3" />
          <text x={CENTER.x} y={CENTER.y + 4} fontSize={11} fill={P.candi} textAnchor="middle" fontFamily={FONT}>SC</text>
          {NODES.map((n) => {
            const p = pos(n, true);
            return <line key={n.id} x1={n.x} y1={n.y} x2={p.x} y2={p.y} stroke={P.candi} strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />;
          })}
        </g>

        {/* ghost outlines at the starting spots */}
        {NODES.map((n) => (
          <rect key={`g-${n.id}`} x={n.x - wOf(n) / 2} y={n.y - CH / 2} width={wOf(n)} height={CH} rx={8} fill="none"
            stroke={P.line2} strokeDasharray="3 3" style={{ opacity: on ? 0.8 : 0, transition: "opacity 400ms" }} />
        ))}

        {/* recipe cards */}
        {NODES.map((n) => {
          const p = pos(n, on);
          const c = n.color();
          const sel = n.id === pick;
          return (
            <g key={n.id} style={{ ...move(p.x - wOf(n) / 2, p.y - CH / 2), cursor: "pointer" }} onClick={() => setPick(n.id)}>
              <rect width={wOf(n)} height={CH} rx={8} fill={P.inset} stroke={c} strokeWidth={sel ? 2 : 1} />
              <rect width={wOf(n)} height={CH} rx={8} fill={rgba(c, sel ? 0.16 : 0.08)} />
              <text x={10} y={20} fontSize={12.5} fontWeight={600} fill={P.text}>{n.label}</text>
              <Glyph kind={n.glyph} x={10} y={28} w={wOf(n) - 20} color={c} />
            </g>
          );
        })}

        {/* x axis */}
        <line x1={70} y1={364} x2={W - 14} y2={364} stroke={P.line2} />
        <path d={`M${W - 20},359 L${W - 13},364 L${W - 20},369`} fill="none" stroke={P.line2} />
        <text x={150} y={383} fontSize={12} fill={P.muted} textAnchor="middle">no labels</text>
        <text x={330} y={383} fontSize={12} fill={P.muted} textAnchor="middle">graded labels</text>
        <text x={510} y={383} fontSize={12} fill={P.muted} textAnchor="middle">exact labels</text>
      </svg>
      </div>
    </Frame>
  );
}

export const ReliabilityMap = withVizTheme(ReliabilityMapInner);
export default ReliabilityMap;
