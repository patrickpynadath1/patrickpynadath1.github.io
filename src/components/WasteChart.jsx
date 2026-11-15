// Wasted bits vs number of steps when the model is a decoder with a fixed number of
// belief-propagation rounds per pass (our stand-in for compute), with and without self
// conditioning (messages carried across steps). Masked, Gaussian (analog bits) and uniform
// corruption at equal information per step. Computed by Monte Carlo (bp_waste.py, saved with the
// post's iterations). Waste = KL(true path || sampler path), in bits.
import { useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT, rgba } from "./SelfCondDepth.jsx";

const DATA = {"Ns":[1,2,4,8,16],"data":{"base":{"TC":7,"masked":{"exact":[[7,0],[3.3652,0.0298],[1.648,0.0255],[0.7992,0.019],[0.396,0.0131]],"r1":[[7,0],[3.3652,0.0298],[1.648,0.0255],[0.7992,0.019],[0.396,0.0131]],"r1sc":[[7,0],[3.3652,0.0298],[1.648,0.0255],[0.7992,0.019],[0.396,0.0131]],"r2":[[7,0],[3.3652,0.0298],[1.648,0.0255],[0.7992,0.019],[0.396,0.0131]],"r2sc":[[7,0],[3.3652,0.0298],[1.648,0.0255],[0.7992,0.019],[0.396,0.0131]]},"gaussian":{"exact":[[7,0],[3.6067,0.0482],[1.8321,0.0415],[0.915,0.0303],[0.4475,0.0222]],"r1":[[7,0],[3.6067,0.0482],[1.8321,0.0415],[0.915,0.0303],[0.4475,0.0222]],"r1sc":[[7,0],[3.6067,0.0482],[1.8321,0.0415],[0.915,0.0303],[0.4475,0.0222]],"r2":[[7,0],[3.6067,0.0482],[1.8321,0.0415],[0.915,0.0303],[0.4475,0.0222]],"r2sc":[[7,0],[3.6067,0.0482],[1.8321,0.0415],[0.915,0.0303],[0.4475,0.0222]]},"uniform":{"exact":[[7,0],[3.5861,0.0501],[1.8581,0.0421],[0.9099,0.0319],[0.447,0.0223]],"r1":[[7,0],[4.0942,0.0439],[2.5696,0.0422],[1.6823,0.0376],[1.2523,0.0333]],"r1sc":[[7,0],[4.0942,0.0439],[2.2992,0.0429],[1.2295,0.0347],[0.655,0.0268]],"r2":[[7,0],[3.6764,0.0494],[1.988,0.043],[1.0874,0.0333],[0.5883,0.0254]],"r2sc":[[7,0],[3.6764,0.0494],[1.9628,0.0429],[1.0413,0.0331],[0.541,0.0251]]}},"wide":{"TC":11,"masked":{"exact":[[11,0],[4.8084,0.0516],[2.198,0.0408],[1.0008,0.0281],[0.494,0.019]],"r1":[[11,0],[4.8084,0.0516],[2.198,0.0408],[1.0008,0.0281],[0.494,0.019]],"r1sc":[[11,0],[4.8084,0.0516],[2.198,0.0408],[1.0008,0.0281],[0.494,0.019]],"r2":[[11,0],[4.8084,0.0516],[2.198,0.0408],[1.0008,0.0281],[0.494,0.019]],"r2sc":[[11,0],[4.8084,0.0516],[2.198,0.0408],[1.0008,0.0281],[0.494,0.019]]},"gaussian":{"exact":[[11,0],[5.1319,0.0629],[2.4389,0.0523],[1.176,0.036],[0.5419,0.0239]],"r1":[[11,0],[5.1319,0.0629],[2.4389,0.0523],[1.176,0.036],[0.5419,0.0239]],"r1sc":[[11,0],[5.1319,0.0629],[2.4389,0.0523],[1.176,0.036],[0.5419,0.0239]],"r2":[[11,0],[5.1319,0.0629],[2.4389,0.0523],[1.176,0.036],[0.5419,0.0239]],"r2sc":[[11,0],[5.1319,0.0629],[2.4389,0.0523],[1.176,0.036],[0.5419,0.0239]]},"uniform":{"exact":[[11,0],[5.5042,0.0737],[2.6597,0.0586],[1.2549,0.0415],[0.5917,0.0288]],"r1":[[11,0],[6.2289,0.0676],[3.6303,0.0585],[2.4605,0.0488],[1.8151,0.0442]],"r1sc":[[11,0],[6.2289,0.0676],[3.4525,0.062],[1.9671,0.0528],[1.2177,0.0483]],"r2":[[11,0],[5.7502,0.0767],[2.9953,0.0605],[1.6936,0.0483],[1.0272,0.0382]],"r2sc":[[11,0],[5.7502,0.0767],[2.9844,0.0639],[1.6544,0.0525],[1.0303,0.0447]]}},"local":{"TC":4,"masked":{"exact":[[4,0],[2.0156,0.0197],[1.0104,0.0172],[0.4956,0.0132],[0.2524,0.0098]],"r1":[[4,0],[2.0156,0.0197],[1.0104,0.0172],[0.4956,0.0132],[0.2524,0.0098]],"r1sc":[[4,0],[2.0156,0.0197],[1.0104,0.0172],[0.4956,0.0132],[0.2524,0.0098]],"r2":[[4,0],[2.0156,0.0197],[1.0104,0.0172],[0.4956,0.0132],[0.2524,0.0098]],"r2sc":[[4,0],[2.0156,0.0197],[1.0104,0.0172],[0.4956,0.0132],[0.2524,0.0098]]},"gaussian":{"exact":[[4,0],[2.0806,0.0331],[1.085,0.0314],[0.5105,0.0232],[0.2419,0.0163]],"r1":[[4,0],[2.0806,0.0331],[1.085,0.0314],[0.5105,0.0232],[0.2419,0.0163]],"r1sc":[[4,0],[2.0806,0.0331],[1.085,0.0314],[0.5105,0.0232],[0.2419,0.0163]],"r2":[[4,0],[2.0806,0.0331],[1.085,0.0314],[0.5105,0.0232],[0.2419,0.0163]],"r2sc":[[4,0],[2.0806,0.0331],[1.085,0.0314],[0.5105,0.0232],[0.2419,0.0163]]},"uniform":{"exact":[[4,0],[2.1793,0.0351],[1.0941,0.0298],[0.6514,0.0256],[0.3016,0.0178]],"r1":[[4,0],[2.3291,0.0313],[1.3006,0.0284],[0.8605,0.0282],[0.5334,0.0237]],"r1sc":[[4,0],[2.3291,0.0313],[1.2212,0.0293],[0.7084,0.0263],[0.3326,0.0182]],"r2":[[4,0],[2.1886,0.0347],[1.1127,0.0297],[0.6598,0.0254],[0.3164,0.0179]],"r2sc":[[4,0],[2.1886,0.0347],[1.107,0.0298],[0.6556,0.0256],[0.3032,0.0178]]}},"private":{"TC":1,"masked":{"exact":[[1,0],[0.4968,0.01],[0.2504,0.0087],[0.124,0.0066],[0.0632,0.0049]],"r1":[[1,0],[0.4968,0.01],[0.2504,0.0087],[0.124,0.0066],[0.0632,0.0049]],"r1sc":[[1,0],[0.4968,0.01],[0.2504,0.0087],[0.124,0.0066],[0.0632,0.0049]],"r2":[[1,0],[0.4968,0.01],[0.2504,0.0087],[0.124,0.0066],[0.0632,0.0049]],"r2sc":[[1,0],[0.4968,0.01],[0.2504,0.0087],[0.124,0.0066],[0.0632,0.0049]]},"gaussian":{"exact":[[1,0],[0.502,0.0165],[0.2489,0.0148],[0.1467,0.0119],[0.0748,0.0086]],"r1":[[1,0],[0.502,0.0165],[0.2489,0.0148],[0.1467,0.0119],[0.0748,0.0086]],"r1sc":[[1,0],[0.502,0.0165],[0.2489,0.0148],[0.1467,0.0119],[0.0748,0.0086]],"r2":[[1,0],[0.502,0.0165],[0.2489,0.0148],[0.1467,0.0119],[0.0748,0.0086]],"r2sc":[[1,0],[0.502,0.0165],[0.2489,0.0148],[0.1467,0.0119],[0.0748,0.0086]]},"uniform":{"exact":[[1,0],[0.5544,0.0153],[0.3059,0.0137],[0.1626,0.0106],[0.0904,0.0076]],"r1":[[1,0],[0.5544,0.0153],[0.3059,0.0137],[0.1626,0.0106],[0.0904,0.0076]],"r1sc":[[1,0],[0.5544,0.0153],[0.3059,0.0137],[0.1626,0.0106],[0.0904,0.0076]],"r2":[[1,0],[0.5544,0.0153],[0.3059,0.0137],[0.1626,0.0106],[0.0904,0.0076]],"r2sc":[[1,0],[0.5544,0.0153],[0.3059,0.0137],[0.1626,0.0106],[0.0904,0.0076]]}},"chain":{"TC":4,"masked":{"exact":[[4,0],[2.2304,0.0199],[1.166,0.0183],[0.5956,0.0143],[0.2956,0.0104]],"r1":[[4,0],[2.8568,0.0155],[2.2628,0.0148],[1.97,0.0127],[1.8148,0.0113]],"r1sc":[[4,0],[2.8568,0.0155],[1.746,0.019],[1.0224,0.0172],[0.5976,0.0144]],"r2":[[4,0],[2.3564,0.0199],[1.3868,0.0188],[0.8712,0.0158],[0.5972,0.0132]],"r2sc":[[4,0],[2.3564,0.0199],[1.3436,0.0189],[0.7716,0.016],[0.4528,0.0127]]},"gaussian":{"exact":[[4,0],[2.3633,0.0345],[1.2466,0.0323],[0.6251,0.0259],[0.3124,0.0188]],"r1":[[4,0],[2.9605,0.026],[2.3076,0.026],[1.9941,0.0227],[1.7945,0.0189]],"r1sc":[[4,0],[2.9605,0.026],[1.8297,0.0319],[1.0202,0.0302],[0.5033,0.0227]],"r2":[[4,0],[2.5574,0.0317],[1.5722,0.0312],[1.0347,0.026],[0.7239,0.0222]],"r2sc":[[4,0],[2.5574,0.0317],[1.393,0.0324],[0.7285,0.0272],[0.3508,0.0195]]},"uniform":{"exact":[[4,0],[2.2839,0.0331],[1.2765,0.0313],[0.677,0.0237],[0.3561,0.0185]],"r1":[[4,0],[2.9947,0.0232],[2.4513,0.0251],[2.0998,0.0214],[1.895,0.0201]],"r1sc":[[4,0],[2.9947,0.0232],[2.0356,0.0305],[1.2895,0.0312],[0.7787,0.0295]],"r2":[[4,0],[2.5315,0.029],[1.6393,0.0297],[1.118,0.0254],[0.78,0.0239]],"r2sc":[[4,0],[2.5315,0.029],[1.5718,0.0334],[0.9725,0.0294],[0.5986,0.0257]]}},"parity":{"TC":3,"masked":{"exact":[[3,0],[1.494,0.022],[0.7572,0.017],[0.3892,0.0126],[0.1972,0.009]],"r1":[[3,0],[2.6288,0.0129],[2.346,0.0158],[2.1888,0.0169],[2.0944,0.0174]],"r1sc":[[3,0],[2.6288,0.0129],[1.5288,0.0199],[0.794,0.0169],[0.4188,0.0128]],"r2":[[3,0],[1.7388,0.0205],[1.0064,0.0173],[0.64,0.0141],[0.4508,0.0118]],"r2sc":[[3,0],[1.7388,0.0205],[0.9088,0.0175],[0.4836,0.0135],[0.27,0.0102]]},"gaussian":{"exact":[[3,0],[1.5592,0.0371],[0.7659,0.0264],[0.4109,0.0198],[0.203,0.0152]],"r1":[[3,0],[2.6331,0.0213],[2.3502,0.0268],[2.155,0.0272],[2.0934,0.0289]],"r1sc":[[3,0],[2.6331,0.0213],[1.531,0.0334],[0.8187,0.0302],[0.5054,0.0334]],"r2":[[3,0],[1.756,0.033],[0.9828,0.0266],[0.6112,0.0224],[0.4053,0.0196]],"r2sc":[[3,0],[1.756,0.033],[0.9351,0.0286],[0.5172,0.0234],[0.3212,0.0218]]},"uniform":{"exact":[[3,0],[1.6682,0.0359],[0.8481,0.0322],[0.417,0.0245],[0.2009,0.0176]],"r1":[[3,0],[2.6559,0.0229],[2.3892,0.0291],[2.1835,0.0346],[2.1393,0.0372]],"r1sc":[[3,0],[2.6559,0.0229],[1.5929,0.037],[0.7995,0.033],[0.4482,0.0295]],"r2":[[3,0],[1.7727,0.0321],[0.9969,0.0309],[0.544,0.0259],[0.3514,0.022]],"r2sc":[[3,0],[1.7727,0.0321],[1.0129,0.0339],[0.5346,0.0272],[0.3283,0.0226]]}}}};
const LAYOUT_OPTS = [
  { id: "chain", label: "Chain of blends" }, { id: "parity", label: "Parity only" }, { id: "base", label: "Example" },
  { id: "wide", label: "Sequence-wide" }, { id: "local", label: "Local" }, { id: "private", label: "Mostly private" },
];
const DESC = {
  base: "The seven-color example: shared colors, no blends.",
  wide: "One bit runs through every position; others span several. No blends.",
  local: "Each shared bit sits in two neighboring positions. No blends.",
  private: "Almost nothing is shared.",
  chain: "Bits linked through a chain of blends.",
  parity: "Three bits and their three pairwise blends.",
};
// Validated categorical steps (dataviz validator, both modes).
const SERIES = [
  { id: "masked", label: "Masked", light: "#c43c3c", dark: "#d9585d" },
  { id: "gaussian", label: "Gaussian", light: "#2f6fae", dark: "#4e8fcf" },
  { id: "uniform", label: "Uniform", light: "#c2541a", dark: "#cf7a2a" },
];
const small = () => ({ fontFamily: FONT, fontSize: 11, color: P.dim2, lineHeight: 1.5 });

function WasteChartInner() {
  const [lay, setLay] = useState("chain");
  const [rounds, setRounds] = useState("r1");
  const [sc, setSc] = useState("off");
  const [view, setView] = useState("chart");
  const [hover, setHover] = useState(null);
  const d = DATA.data[lay], Ns = DATA.Ns;
  const model = rounds === "exact" ? "exact" : rounds + (sc === "on" ? "sc" : "");
  const dark = P.bg === "#121321";
  const col = (s) => (dark ? s.dark : s.light);
  const W = 420, H = 260, L = 44, R = 82, T = 14, B = 40;
  const lx = (n) => L + (Math.log2(n) / 4) * (W - L - R);
  const ymax = Math.ceil(d.TC + 0.5);
  const ly = (v) => T + (1 - v / ymax) * (H - T - B);
  const yticks = Array.from({ length: ymax + 1 }, (_, i) => i).filter((v) => ymax <= 6 || v % 2 === 0);
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * W;
    let best = 0;
    Ns.forEach((n, i) => { if (Math.abs(lx(n) - x) < Math.abs(lx(Ns[best]) - x)) best = i; });
    setHover(best);
  };
  const val = (id, m, i) => d[id][m][i][0];
  const label = rounds === "exact" ? "exact beliefs" : `${rounds === "r1" ? "1 round" : "2 rounds"} per pass, ${sc === "on" ? "with" : "without"} self conditioning`;
  return (
    <Frame kicker="Computed · rounds of belief propagation stand in for compute" title="Wasted bits when the model can only work so far per pass"
      subtitle={`${DESC[lay]} Total correlation TC = ${d.TC} bits. The model is a decoder that runs a fixed number of rounds of belief propagation per pass; every channel gets the same information per box at each step.`}
      controls={<>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {LAYOUT_OPTS.map((o) => (
            <button key={o.id} type="button" onClick={() => setLay(o.id)} style={{
              border: `1px solid ${o.id === lay ? P.accent : P.line2}`, cursor: "pointer", borderRadius: 999, padding: "5px 11px",
              fontFamily: FONT, fontSize: 11.5, background: o.id === lay ? rgba(P.accent, 0.2) : P.inset, color: o.id === lay ? P.accentSoft : P.dim2,
            }}>{o.label}</button>
          ))}
        </div>
        <Pills value={rounds} onChange={setRounds} options={[{ id: "r1", label: "1 round" }, { id: "r2", label: "2 rounds" }, { id: "exact", label: "exact" }]} />
        {rounds !== "exact" && <Pills value={sc} onChange={setSc} options={[{ id: "off", label: "no self conditioning" }, { id: "on", label: "self conditioning" }]} />}
        <Pills value={view} onChange={setView} options={[{ id: "chart", label: "Chart" }, { id: "table", label: "Table" }]} />
      </>}
      note="Solid lines: the chosen model. Faint dashed lines: exact beliefs, for the same channel. Waste is the KL divergence between the true sampling path and the sampler's path, in bits; it bounds how far the final samples drift from the data. With exact beliefs, waste falls roughly like TC/N. With a round limit and no self conditioning it levels off: extra steps cannot recover what each pass fails to work out. Self conditioning, modeled as carrying the decoder's messages from step to step, lets the rounds add up, and waste falls again. Monte Carlo estimates; ±1 standard error in the table.">
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "2px 0 8px", ...small() }}>
        {SERIES.map((s) => (
          <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <svg width={22} height={10}><line x1={0} x2={22} y1={5} y2={5} stroke={col(s)} strokeWidth={2} /><circle cx={11} cy={5} r={3.5} fill={col(s)} /></svg>{s.label}
          </span>
        ))}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={22} height={10}><line x1={0} x2={22} y1={5} y2={5} stroke={P.muted} strokeWidth={1.4} strokeDasharray="4 3" opacity={0.6} /></svg>exact beliefs
        </span>
      </div>
      {view === "chart" ? (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: 640, display: "block", fontFamily: FONT, touchAction: "none" }}
          role="img" aria-label={`Wasted bits against number of steps, ${lay} layout, ${label}. ${SERIES.map((s) => `${s.label}: ${Ns.map((_, i) => val(s.id, model, i).toFixed(2)).join(", ")}`).join("; ")}.`}
          onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
          {yticks.map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={ly(v)} y2={ly(v)} stroke={P.grid} />
              <text x={L - 6} y={ly(v) + 3.5} textAnchor="end" fontSize={10} fill={P.dim2}>{v}</text>
            </g>
          ))}
          {Ns.map((n) => <text key={n} x={lx(n)} y={H - B + 15} textAnchor="middle" fontSize={10} fill={P.dim2}>{n}</text>)}
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={10} fill={P.dim2}>number of steps N</text>
          <text x={11} y={(T + H - B) / 2} textAnchor="middle" fontSize={10} fill={P.dim2} transform={`rotate(-90 11 ${(T + H - B) / 2})`}>wasted bits</text>
          {hover !== null && <line x1={lx(Ns[hover])} x2={lx(Ns[hover])} y1={T} y2={H - B} stroke={P.dim} />}
          {SERIES.map((s) => (
            <path key={s.id + "x"} d={Ns.map((n, i) => `${i ? "L" : "M"}${lx(n)},${ly(val(s.id, "exact", i))}`).join(" ")} fill="none" stroke={col(s)} strokeWidth={1.3} strokeDasharray="4 3" opacity={0.45} />
          ))}
          {SERIES.map((s) => (
            <g key={s.id}>
              <path d={Ns.map((n, i) => `${i ? "L" : "M"}${lx(n)},${ly(val(s.id, model, i))}`).join(" ")} fill="none" stroke={col(s)} strokeWidth={2} />
              {Ns.map((n, i) => <circle key={i} cx={lx(n)} cy={ly(val(s.id, model, i))} r={4} fill={col(s)} stroke={P.panel} strokeWidth={2} />)}
            </g>
          ))}
          {(() => {
            const items = SERIES.map((s) => ({ s, y: ly(val(s.id, model, Ns.length - 1)) })).sort((a, b) => a.y - b.y);
            for (let i = 1; i < items.length; i++) items[i].y = Math.max(items[i].y, items[i - 1].y + 12);
            return items.map(({ s, y }) => (
              <g key={s.id}>
                <circle cx={W - R + 10} cy={y} r={3} fill={col(s)} />
                <text x={W - R + 17} y={y + 3.5} fontSize={10} fill={P.text}>{s.label}</text>
              </g>
            ));
          })()}
          {hover !== null && (() => {
            const i = hover, x = lx(Ns[i]), left = x > W / 2;
            return (
              <g transform={`translate(${left ? x - 178 : x + 8}, ${T + 4})`}>
                <rect width={170} height={58} rx={6} fill={P.inset} stroke={P.line2} />
                <text x={8} y={15} fontSize={10} fill={P.text} fontWeight={650}>N = {Ns[i]}</text>
                {SERIES.map((s, j) => <text key={s.id} x={8} y={30 + j * 12} fontSize={10} fill={P.text}>{s.label} {val(s.id, model, i).toFixed(2)} (exact {val(s.id, "exact", i).toFixed(2)})</text>)}
              </g>
            );
          })()}
        </svg>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <div style={{ ...small(), marginBottom: 4 }}>{label}</div>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONT, fontSize: 11.5, color: P.text }}>
            <thead><tr>{["N", ...SERIES.map((s) => s.label)].map((h) => <th key={h} style={{ textAlign: "right", padding: "4px 6px", color: P.dim2, borderBottom: `1px solid ${P.line2}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {Ns.map((n, i) => (
                <tr key={n}>
                  <td style={{ textAlign: "right", padding: "4px 6px" }}>{n}</td>
                  {SERIES.map((s) => <td key={s.id} style={{ textAlign: "right", padding: "4px 6px" }}>{val(s.id, model, i).toFixed(2)} <span style={{ color: P.dim2 }}>±{d[s.id][model][i][1].toFixed(2)}</span></td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Frame>
  );
}
export const WasteChart = withVizTheme(WasteChartInner);
