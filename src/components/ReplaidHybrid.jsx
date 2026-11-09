// REPLAiD vs the REPLAiD hybrid on GSM8K: pass@1 against network calls (NFE).
// Data: src/data/replaid_hybrid_nfe.json. Filled points are finished runs;
// hollow circles marked ??? are budgets still to be run.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, rgba } from "./SelfCondDepth.jsx";
import DATA from "../data/replaid_hybrid_nfe.json";

const NFES = [33, 65, 129, 257, 513, 1025];
const COLOR = { replaid: () => P.accent, hybrid: () => P.highlight };
const pct = (v) => `${(v * 100).toFixed(1)}%`;

function ReplaidHybridNfeInner() {
  const [hover, setHover] = useState(null);
  const L = 58, T = 16, W = 430, H = 280;
  const yDom = [0, 0.6];
  const y = (v) => T + H - ((v - yDom[0]) / (yDom[1] - yDom[0])) * H;
  const lx = (n) => Math.log2(n);
  const xDom = [lx(NFES[0]), lx(DATA.paper.nfe)];
  const x = (n) => L + 18 + ((lx(n) - xDom[0]) / (xDom[1] - xDom[0])) * (W - 36);
  const yTicks = [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6];
  const RX = L + W + 30;
  const h = hover && DATA.rows.find((r) => `${r.family}${r.nfe}` === hover);

  const done = (fam) => DATA.rows.filter((r) => r.family === fam && r.status === "completed").sort((a, b) => a.nfe - b.nfe);
  const path = (pts) => pts.map((r, i) => `${i ? "L" : "M"}${x(r.nfe).toFixed(1)},${y(r.accuracy).toFixed(1)}`).join("");
  // Pending points sit on a shared row near the floor, offset per series so both stay visible.
  const pendingY = (fam) => y(0.04) + (fam === "hybrid" ? 14 : 0);

  return (
    <Frame
      kicker="Figure L · hybrid in place of self conditioning"
      title="At 1,025 network calls, the hybrid stays within about one point of REPLAiD."
      subtitle="GSM8K pass@1 against the number of network calls per sample. Purple: REPLAiD with the paper's sampler settings and trajectory self conditioning. Orange: the REPLAiD hybrid, with no self conditioning, using the best sampler from a grid on 128 problems. Hollow circles marked ??? are budgets we have not run yet. Dashed line: the paper's REPLAiD with bootstrap self conditioning, which costs two calls per step."
      note={<>
        Full GSM8K test set ({DATA.n_full} problems), one sampling seed. The 128 problems used to pick the hybrid's sampler come from the test set, so we also report the {DATA.n_outside} problems outside them (hover a point).
        Each budget is 2<sup>k</sup> sampler steps plus one final call. A 95% interval on {DATA.n_full} problems is about ±2.7 points, so the two finished points are within noise of each other.
      </>}
    >
      <svg viewBox="0 0 720 350" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        <rect x={L} y={T} width={W} height={H} fill={rgba(P.panel, 0.6)} rx={4} />
        {yTicks.map((v) => (
          <g key={`y${v}`}>
            <line x1={L} x2={L + W} y1={y(v)} y2={y(v)} stroke={P.grid} strokeWidth={0.6} />
            <text x={L - 6} y={y(v) + 3} fill={P.dim} fontSize={9.5} textAnchor="end">{`${(v * 100).toFixed(0)}%`}</text>
          </g>
        ))}
        {[...NFES, DATA.paper.nfe].map((n) => (
          <g key={`x${n}`}>
            <line x1={x(n)} x2={x(n)} y1={T} y2={T + H} stroke={P.grid} strokeWidth={0.6} strokeDasharray={n === DATA.paper.nfe ? "2 3" : undefined} />
            <text x={x(n)} y={T + H + 14} fill={P.dim} fontSize={9.5} textAnchor="middle">{n.toLocaleString()}</text>
          </g>
        ))}
        <text x={L + W / 2} y={T + H + 32} fill={P.muted} fontSize={10.5} textAnchor="middle">network calls per sample (log scale)</text>
        <text transform={`translate(14, ${T + H / 2}) rotate(-90)`} fill={P.muted} fontSize={10.5} textAnchor="middle">GSM8K pass@1</text>

        <line x1={L} x2={L + W} y1={y(DATA.paper.accuracy)} y2={y(DATA.paper.accuracy)} stroke={P.dim2} strokeWidth={1.4} strokeDasharray="6 5" />
        <g transform={`translate(${x(DATA.paper.nfe)}, ${y(DATA.paper.accuracy)})`}>
          <rect x={-5} y={-5} width={10} height={10} transform="rotate(45)" fill={P.bg} stroke={P.dim2} strokeWidth={2} />
          <text x={-8} y={-10} fill={P.dim2} fontSize={9.5} textAnchor="end">paper {pct(DATA.paper.accuracy)}</text>
        </g>

        {DATA.series.map((s) => <path key={`p${s.id}`} d={path(done(s.id))} fill="none" stroke={COLOR[s.id]()} strokeWidth={2.2} />)}
        {DATA.rows.map((r) => {
          const c = COLOR[r.family]();
          const key = `${r.family}${r.nfe}`;
          const on = hover === key;
          if (r.status !== "completed") {
            const py = pendingY(r.family);
            return (
              <g key={key} transform={`translate(${x(r.nfe)}, ${py})`} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} cursor="pointer">
                <circle r={12} fill="transparent" />
                <circle r={on ? 6.5 : 5} fill={P.bg} stroke={c} strokeWidth={1.6} strokeDasharray="2 2" />
                <text x={8} y={4} fill={c} fontSize={9} opacity={0.85}>???</text>
              </g>
            );
          }
          return (
            <g key={key} transform={`translate(${x(r.nfe)}, ${y(r.accuracy)})`} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} cursor="pointer">
              <circle r={12} fill="transparent" />
              <circle r={on ? 6.5 : 5} fill={c} stroke={c} strokeWidth={2} />
              <text x={-9} y={r.family === "hybrid" ? 16 : -10} fill={c} fontSize={9.5} textAnchor="end">{pct(r.accuracy)}</text>
            </g>
          );
        })}

        <g transform={`translate(${RX}, ${T + 4})`} fontSize={10.5}>
          {DATA.series.map((s, i) => (
            <g key={s.id} transform={`translate(0, ${i * 32})`}>
              <line x1={0} x2={16} y1={-4} y2={-4} stroke={COLOR[s.id]()} strokeWidth={2.4} />
              <text x={22} fill={COLOR[s.id]()} fontWeight={650}>{s.label}</text>
              <text x={22} y={13} fill={P.dim} fontSize={9.5}>{s.sub}</text>
            </g>
          ))}
          <g transform="translate(0, 64)">
            <line x1={0} x2={16} y1={-4} y2={-4} stroke={P.dim2} strokeWidth={1.6} strokeDasharray="5 4" />
            <text x={22} fill={P.dim2} fontWeight={650}>Paper, bootstrap SC</text>
            <text x={22} y={13} fill={P.dim} fontSize={9.5}>1,024 steps, 2 calls each</text>
          </g>
          <g transform="translate(0, 104)">
            <line x1={0} x2={190} y1={-12} y2={-12} stroke={P.line2} />
            {h ? (
              <>
                <text fill={P.text} fontWeight={650}>{DATA.series.find((s) => s.id === h.family).label}, {h.nfe.toLocaleString()} calls</text>
                <text y={18} fill={P.muted}>steps <tspan fill={P.text}>{h.steps}</tspan></text>
                {h.status === "completed" ? (
                  <>
                    <text y={34} fill={P.muted}>all {DATA.n_full} <tspan fill={P.text}>{pct(h.accuracy)}</tspan></text>
                    <text y={50} fill={P.muted}>outside the 128 <tspan fill={P.text}>{pct(h.outside)}</tspan></text>
                    <text y={66} fill={P.muted} fontSize={9.5}>{h.sampler}</text>
                  </>
                ) : (
                  <text y={34} fill={P.muted}>not run yet</text>
                )}
              </>
            ) : (
              <text fill={P.dim} fontSize={9.5}>Hover a point for details.</text>
            )}
          </g>
        </g>
      </svg>
    </Frame>
  );
}

export const ReplaidHybridNfe = withVizTheme(ReplaidHybridNfeInner);
export default ReplaidHybridNfe;
