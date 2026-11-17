// Part 3, coding view: three binary channels matched to the same capacity.
// Top: the spread of |L| (trust) across positions for each channel.
// Bottom: what two observations tell you, for two copies of one bit and for the
// parity of two bits. The parity number uses the chain-rule identity
// I(copies) + I(parity) = 2C, which holds for any binary memoryless symmetric channel.
import { useMemo, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";

const SANS = "Helvetica, Arial, sans-serif";
const LN2 = Math.log(2);
const h2 = (p) => (p <= 0 || p >= 1 ? 0 : -(p * Math.log2(p) + (1 - p) * Math.log2(1 - p)));

// Mutual information of a binary symmetric-LLR channel whose L ~ N(m, 2m) given X = +1.
function infoGaussianL(m) {
  if (m <= 0) return 0;
  const sd = Math.sqrt(2 * m), n = 900, lo = m - 9 * sd, hi = m + 9 * sd, dx = (hi - lo) / n;
  let s = 0;
  for (let i = 0; i <= n; i++) {
    const x = lo + i * dx;
    const w = Math.exp(-((x - m) ** 2) / (4 * m)) / Math.sqrt(4 * Math.PI * m);
    const loss = x > 30 ? Math.exp(-x) / LN2 : Math.log1p(Math.exp(-x)) / LN2;
    s += w * (1 - loss) * (i === 0 || i === n ? 0.5 : 1);
  }
  return s * dx;
}
// Gaussian channel with signal ±1 and noise σ: L ~ N(2/σ², 4/σ²), so m = 2/σ².
function bisect(f, target, lo, hi) {
  for (let k = 0; k < 60; k++) { const mid = (lo + hi) / 2; if (f(mid) < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

function channels(C) {
  const eps = 1 - C;
  const p = bisect((q) => -(1 - h2(q)), -C, 1e-9, 0.5); // 1 - h2(p) = C, p in (0, 1/2)
  const m = bisect(infoGaussianL, C, 1e-4, 80);          // Gaussian LLR mean with capacity C
  const lBsc = Math.log((1 - p) / p);
  const copies = {
    masked: 1 - eps * eps,
    gauss: infoGaussianL(2 * m),
    uniform: (1 - p) ** 2 * (1 - Math.log1p(Math.exp(-2 * lBsc)) / LN2)
      + p * p * (1 - Math.log1p(Math.exp(2 * lBsc)) / LN2),
  };
  const parity = { masked: 2 * C - copies.masked, gauss: 2 * C - copies.gauss, uniform: 2 * C - copies.uniform };
  return { eps, p, m, lBsc, sigma: Math.sqrt(2 / m), copies, parity };
}

const CH = [
  { id: "masked", label: "Masked", name: "erasure", color: () => P.mdlm },
  { id: "gauss", label: "Gaussian", name: "Gaussian", color: () => P.accent },
  { id: "uniform", label: "Uniform", name: "flip", color: () => P.duo },
];

const LMAX = 12; // |L| shown from 0 to 12 nats, plus an ∞ slot

function Hist({ ch, d, w = 190, hgt = 92 }) {
  const c = ch.color();
  const x0 = 8, x1 = w - 34, xInf = w - 14, base = hgt - 18;
  const X = (l) => x0 + (Math.min(l, LMAX) / LMAX) * (x1 - x0);
  const bar = (x, frac, key) => (
    <rect key={key} x={x - 3} y={base - frac * (base - 8)} width={6} height={frac * (base - 8)} rx={1.5} fill={c} />
  );
  let marks = null;
  if (ch.id === "masked") marks = <>{bar(X(0), d.eps, "a")}{bar(xInf, 1 - d.eps, "b")}</>;
  if (ch.id === "uniform") marks = d.lBsc > LMAX ? bar(xInf, 1, "a") : bar(X(d.lBsc), 1, "a");
  if (ch.id === "gauss") {
    const m = d.m, v = 2 * m, pts = [];
    let peak = 0; const ys = [];
    for (let i = 0; i <= 80; i++) {
      const l = (i / 80) * LMAX;
      const y = (Math.exp(-((l - m) ** 2) / (2 * v)) + Math.exp(-((l + m) ** 2) / (2 * v))) / Math.sqrt(2 * Math.PI * v);
      ys.push(y); peak = Math.max(peak, y);
    }
    ys.forEach((y, i) => pts.push(`${X((i / 80) * LMAX).toFixed(1)},${(base - (y / peak) * (base - 14)).toFixed(1)}`));
    marks = <>
      <polygon points={`${X(0)},${base} ${pts.join(" ")} ${X(LMAX)},${base}`} fill={rgba(c, 0.18)} />
      <polyline points={pts.join(" ")} fill="none" stroke={c} strokeWidth={1.8} strokeLinejoin="round" />
    </>;
  }
  return (
    <svg viewBox={`0 0 ${w} ${hgt}`} width="100%" style={{ display: "block", fontFamily: SANS }}>
      <line x1={x0} y1={base + 0.5} x2={x1 + 4} y2={base + 0.5} stroke={P.line2} />
      <line x1={xInf - 8} y1={base + 0.5} x2={xInf + 8} y2={base + 0.5} stroke={P.line2} />
      <text x={(x1 + xInf) / 2 + 2} y={base + 4} fontSize={10} fill={P.dim} textAnchor="middle">⋯</text>
      {marks}
      <text x={x0} y={hgt - 3} fontSize={10} fill={P.dim2} fontFamily={FONT}>0</text>
      <text x={X(LMAX / 2)} y={hgt - 3} fontSize={10} fill={P.dim2} fontFamily={FONT} textAnchor="middle">|L|</text>
      <text x={xInf} y={hgt - 3} fontSize={10} fill={P.dim2} fontFamily={FONT} textAnchor="middle">∞</text>
    </svg>
  );
}

function Bars({ title, sub, vals, max }) {
  const order = [...CH].sort((a, b) => vals[b.id] - vals[a.id]);
  return (
    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: P.text }}>{title}</div>
      <div style={{ fontSize: 12, color: P.muted, marginBottom: 8 }}>{sub}</div>
      {CH.map((ch) => (
        <div key={ch.id} style={{ display: "flex", alignItems: "center", gap: 8, margin: "5px 0" }}>
          <div style={{ width: 70, fontSize: 12, color: P.muted }}>{ch.label}</div>
          <div style={{ flex: 1, height: 10, background: rgba(P.text, 0.06), borderRadius: 5, overflow: "hidden" }}>
            <div style={{ width: `${(vals[ch.id] / max) * 100}%`, height: "100%", background: ch.color(), borderRadius: 5, transition: "width 250ms" }} />
          </div>
          <div style={{ width: 54, textAlign: "right", fontFamily: FONT, fontSize: 11.5, color: P.text }}>{vals[ch.id].toFixed(3)}</div>
        </div>
      ))}
      <div style={{ fontSize: 11.5, color: P.dim2, marginTop: 4, fontFamily: FONT }}>
        best: {order[0].label.toLowerCase()} · worst: {order[2].label.toLowerCase()}
      </div>
    </div>
  );
}

function LSpreadInner() {
  const [C, setC] = useState(0.5);
  const d = useMemo(() => channels(C), [C]);
  return (
    <Frame
      kicker="Figure 3"
      title="Same capacity, different spread of trust"
      subtitle="Three channels tuned so each one carries the same information per position. The top row shows how trust |L| is spread across positions. The bottom row shows what two observations are worth, for two copies of one bit and for the parity of two bits."
      controls={
        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, color: P.muted, flexWrap: "wrap" }}>
          <span>Capacity per position</span>
          <input type="range" min={0.1} max={0.9} step={0.01} value={C} onChange={(e) => setC(+e.target.value)} style={{ width: 180, accentColor: P.accent }} />
          <span style={{ fontFamily: FONT, color: P.text }}>{C.toFixed(2)} bits</span>
        </label>
      }
      note={<>Matched settings: erasure probability {d.eps.toFixed(2)}, flip probability {d.p.toFixed(3)}, Gaussian noise σ = {d.sigma.toFixed(2)} (signal ±1). The parity value follows from the chain rule: for these channels the two numbers always sum to twice the capacity, so a channel can only gain on one by losing on the other.</>}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, margin: "8px 0 16px" }}>
        {CH.map((ch) => (
          <div key={ch.id} style={{ flex: "1 1 170px", minWidth: 0, border: `1px solid ${P.line}`, borderRadius: 10, padding: "8px 10px 4px", background: P.inset }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: ch.color() }}>{ch.label}</div>
            <div style={{ fontSize: 11.5, color: P.dim2, marginBottom: 2 }}>{ch.name} channel</div>
            <Hist ch={ch} d={d} />
          </div>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
        <Bars title="Two copies of one bit" sub="I(X; Y₁, Y₂), in bits" vals={d.copies} max={1} />
        <Bars title="Parity of two bits" sub="I(X₁ ⊕ X₂; Y₁, Y₂), in bits" vals={d.parity} max={1} />
      </div>
    </Frame>
  );
}

export const LSpread = withVizTheme(LSpreadInner);
export default LSpread;
