import { useState, useCallback, useRef, useEffect, useMemo } from "react";

const BG        = "#0d0d1a";
const PANEL_BG  = "#13132b";
const CARD_BG   = "#0a0a18";
const GRID      = "#1a1a3a";
const TEXT      = "#ffffff";
const DIM       = "#444466";
const MUTED     = "#555";
const ACCENT    = "#7ee8fa";
const HIGHLIGHT = "#e879f9";
const FONT      = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const H_ABS_MIN = 0.5;
const H_ABS_MAX = 8.0;
const N_PTS     = 600;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function niceTicks(min, max, n = 5) {
  if (max <= min) return [];
  const range = max - min;
  const raw   = range / n;
  const mag   = Math.pow(10, Math.floor(Math.log10(raw)));
  const step  = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + 1e-9; t += step)
    ticks.push(parseFloat(t.toFixed(10)));
  return ticks;
}

// ─── Single slider ────────────────────────────────────────────────────────────
function Slider({ value, onChange, min, max, label, format, color = ACCENT }) {
  const railRef  = useRef(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const fraction = clamp((value - min) / (max - min), 0, 1);

  const getVal = useCallback((clientX) => {
    const rect = railRef.current.getBoundingClientRect();
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min);
  }, [min, max]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      onChange(getVal(e.touches ? e.touches[0].clientX : e.clientX));
    };
    const onUp = () => { dragging.current = false; setIsDragging(false); };
    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("touchmove",  onMove, { passive: false });
    window.addEventListener("touchend",   onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onUp);
    };
  }, [onChange, getVal]);

  const handleDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    onChange(getVal(e.touches ? e.touches[0].clientX : e.clientX));
  }, [onChange, getVal]);

  return (
    <div style={{ width: "100%", touchAction: "pan-y" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: DIM, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
        <div style={{
          fontSize: 14, fontWeight: 700, color, fontFamily: FONT,
          transition: "transform 120ms ease",
          transform: isDragging ? "scale(1.08)" : "scale(1)",
        }}>{format(value)}</div>
      </div>
      <div ref={railRef} onMouseDown={handleDown} onTouchStart={handleDown}
        style={{ position: "relative", width: "100%", height: 32, display: "flex", alignItems: "center", cursor: "ew-resize" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: 4, borderRadius: 2, background: GRID }} />
        <div style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: `${fraction * 100}%`, height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
        }} />
        <div style={{
          position: "absolute", left: `${fraction * 100}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: isDragging ? 20 : 16, height: isDragging ? 20 : 16,
          borderRadius: "50%", background: color, border: `2px solid ${BG}`,
          boxShadow: isDragging
            ? `0 0 0 5px ${color}22, 0 0 14px ${color}44`
            : `0 0 0 3px ${color}18`,
          transition: "all 100ms ease", zIndex: 2,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: DIM, fontFamily: FONT }}>
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

// ─── Range slider (two thumbs) ────────────────────────────────────────────────
function RangeSlider({ lo, hi, onChange, min, max, label, format }) {
  const railRef  = useRef(null);
  const dragging = useRef(null);

  const fracLo = clamp((lo - min) / (max - min), 0, 1);
  const fracHi = clamp((hi - min) / (max - min), 0, 1);

  const getVal = useCallback((clientX) => {
    const rect = railRef.current.getBoundingClientRect();
    return min + clamp((clientX - rect.left) / rect.width, 0, 1) * (max - min);
  }, [min, max]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      const v = getVal(e.touches ? e.touches[0].clientX : e.clientX);
      if (dragging.current === "lo") onChange(clamp(v, min, hi - 0.05), hi);
      else                           onChange(lo, clamp(v, lo + 0.05, max));
    };
    const onUp = () => { dragging.current = null; };
    window.addEventListener("mousemove",  onMove);
    window.addEventListener("mouseup",    onUp);
    window.addEventListener("touchmove",  onMove, { passive: false });
    window.addEventListener("touchend",   onUp);
    return () => {
      window.removeEventListener("mousemove",  onMove);
      window.removeEventListener("mouseup",    onUp);
      window.removeEventListener("touchmove",  onMove);
      window.removeEventListener("touchend",   onUp);
    };
  }, [onChange, getVal, lo, hi, min, max]);

  const handleDown = (thumb) => (e) => { e.preventDefault(); dragging.current = thumb; };

  return (
    <div style={{ width: "100%", touchAction: "pan-y" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <div style={{ fontSize: 10, color: DIM, letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: HIGHLIGHT, fontFamily: FONT }}>
          {format(lo)} — {format(hi)}
        </div>
      </div>
      <div ref={railRef} style={{ position: "relative", width: "100%", height: 32, display: "flex", alignItems: "center" }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: 4, borderRadius: 2, background: GRID }} />
        <div style={{
          position: "absolute",
          left: `${fracLo * 100}%`,
          width: `${(fracHi - fracLo) * 100}%`,
          top: "50%", transform: "translateY(-50%)",
          height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, ${HIGHLIGHT}88, ${HIGHLIGHT})`,
        }} />
        {["lo", "hi"].map((thumb) => (
          <div key={thumb}
            onMouseDown={handleDown(thumb)} onTouchStart={handleDown(thumb)}
            style={{
              position: "absolute",
              left: `${(thumb === "lo" ? fracLo : fracHi) * 100}%`,
              top: "50%", transform: "translate(-50%, -50%)",
              width: 16, height: 16, borderRadius: "50%",
              background: HIGHLIGHT, border: `2px solid ${BG}`,
              boxShadow: `0 0 0 3px ${HIGHLIGHT}18`,
              cursor: "ew-resize", zIndex: 3,
            }} />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: DIM, fontFamily: FONT }}>
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function KLSensitivity() {
  const [kl,   setKL]   = useState(1.5);
  const [hLo,  setHLo]  = useState(4.5);
  const [hHi,  setHHi]  = useState(5.8);

  const W = 600, H = 340;
  const PL = 80, PR = 20, PT = 20, PB = 48;
  const pw = W - PL - PR, ph = H - PT - PB;

  // X window: highlight range + padding
  const xMin = Math.max(H_ABS_MIN, hLo - 0.8);
  const xMax = Math.min(H_ABS_MAX, hHi + 0.8);

  // All curve points
  const allPts = useMemo(() => {
    const pts = [];
    for (let i = 0; i < N_PTS; i++) {
      const h   = H_ABS_MIN + (i / (N_PTS - 1)) * (H_ABS_MAX - H_ABS_MIN);
      const ppl = Math.exp(kl + h);
      pts.push({ h, ppl });
    }
    return pts;
  }, [kl]);

  // Visible points (linear Y — no log)
  const visiblePts = useMemo(() =>
    allPts.filter(p => p.h >= xMin && p.h <= xMax),
    [allPts, xMin, xMax]
  );

  // Y range from visible pts with padding
  const { yMin, yMax } = useMemo(() => {
    if (!visiblePts.length) return { yMin: 0, yMax: 100 };
    const ppls   = visiblePts.map(p => p.ppl);
    const rawMin = Math.min(...ppls);
    const rawMax = Math.max(...ppls);
    const pad    = (rawMax - rawMin) * 0.12;
    return { yMin: Math.max(0, rawMin - pad), yMax: rawMax + pad };
  }, [visiblePts]);

  const toX = useCallback((h)   => PL + ((h - xMin) / (xMax - xMin)) * pw,           [xMin, xMax, pw]);
  const toY = useCallback((ppl) => PT + ph - ((ppl - yMin) / (yMax - yMin)) * ph,     [yMin, yMax, ph]);

  const pathAll = useMemo(() =>
    visiblePts.map((p, i) =>
      `${i === 0 ? "M" : "L"}${toX(p.h).toFixed(2)},${toY(p.ppl).toFixed(2)}`
    ).join(" "),
    [visiblePts, toX, toY]
  );

  const highlightPts = useMemo(() =>
    visiblePts.filter(p => p.h >= hLo && p.h <= hHi),
    [visiblePts, hLo, hHi]
  );

  const pathHighlight = useMemo(() =>
    highlightPts.map((p, i) =>
      `${i === 0 ? "M" : "L"}${toX(p.h).toFixed(2)},${toY(p.ppl).toFixed(2)}`
    ).join(" "),
    [highlightPts, toX, toY]
  );

  const xTicks = useMemo(() => niceTicks(xMin, xMax, 6),  [xMin, xMax]);
  const yTicks = useMemo(() => niceTicks(yMin, yMax, 5),  [yMin, yMax]);

  const pplAtLo  = Math.exp(kl + hLo);
  const pplAtHi  = Math.exp(kl + hHi);
  const pplSwing = Math.abs(pplAtHi - pplAtLo);

  const labelPt = visiblePts[Math.floor(visiblePts.length * 0.3)];

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: FONT, padding: "24px 20px 28px", userSelect: "none" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          fontSize: 20, fontWeight: 700, letterSpacing: "0.02em", marginBottom: 6,
          background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Gen Perplexity vs Entropy at Fixed KL
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>
          GenPPL = exp(KL + H) — linear scale shows the true exponential shape
        </div>
      </div>

      {/* KL slider */}
      <div style={{ background: PANEL_BG, borderRadius: 8, border: `1px solid ${GRID}`, padding: "12px 16px 10px", marginBottom: 10 }}>
        <Slider
          value={kl} onChange={(v) => setKL(parseFloat(v.toFixed(2)))}
          min={0.5} max={4.0}
          label="KL Divergence"
          format={(v) => `KL = ${v.toFixed(2)}`}
          color={ACCENT}
        />
      </div>

      {/* Chart */}
      <div style={{ background: CARD_BG, borderRadius: 8, border: `1px solid ${GRID}`, padding: "14px 12px 8px", marginBottom: 10 }}>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
          <defs>
            <clipPath id="chart-clip">
              <rect x={PL} y={PT} width={pw} height={ph} />
            </clipPath>
          </defs>

          {/* Grid */}
          {xTicks.map(t => (
            <line key={t} x1={toX(t)} y1={PT} x2={toX(t)} y2={PT + ph}
              stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
          ))}
          {yTicks.map(v => (
            <line key={v} x1={PL} y1={toY(v)} x2={PL + pw} y2={toY(v)}
              stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
          ))}

          {/* Highlight band */}
          {hLo < xMax && hHi > xMin && (
            <rect
              x={toX(clamp(hLo, xMin, xMax))} y={PT}
              width={toX(clamp(hHi, xMin, xMax)) - toX(clamp(hLo, xMin, xMax))} height={ph}
              fill={HIGHLIGHT} opacity={0.06} clipPath="url(#chart-clip)"
            />
          )}
          {hLo >= xMin && hLo <= xMax && (
            <line x1={toX(hLo)} y1={PT} x2={toX(hLo)} y2={PT + ph}
              stroke={HIGHLIGHT} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          )}
          {hHi >= xMin && hHi <= xMax && (
            <line x1={toX(hHi)} y1={PT} x2={toX(hHi)} y2={PT + ph}
              stroke={HIGHLIGHT} strokeWidth={1} strokeDasharray="3,3" opacity={0.5} />
          )}

          {/* Base curve dimmed */}
          {pathAll && (
            <path d={pathAll} fill="none" stroke={ACCENT} strokeWidth={2}
              opacity={0.18} clipPath="url(#chart-clip)" strokeLinecap="round" />
          )}

          {/* Highlight glow */}
          {pathHighlight && (
            <path d={pathHighlight} fill="none" stroke={HIGHLIGHT}
              strokeWidth={10} opacity={0.10} clipPath="url(#chart-clip)" strokeLinecap="round" />
          )}
          {/* Highlight curve */}
          {pathHighlight && (
            <path d={pathHighlight} fill="none" strokeWidth={3}
              stroke="url(#hl-grad)" clipPath="url(#chart-clip)" strokeLinecap="round" />
          )}

          <defs>
            <linearGradient id="hl-grad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor={ACCENT} />
              <stop offset="100%" stopColor={HIGHLIGHT} />
            </linearGradient>
          </defs>

          {/* Endpoint dots + labels */}
          {hLo >= xMin && hLo <= xMax && pplAtLo >= yMin && pplAtLo <= yMax && (
            <g>
              <circle cx={toX(hLo)} cy={toY(pplAtLo)} r={5} fill={ACCENT} stroke={BG} strokeWidth={2} />
              <text x={toX(hLo) - 8} y={toY(pplAtLo) - 9} textAnchor="middle"
                fill={ACCENT} fontSize={9} fontFamily={FONT} fontWeight={700}>
                {pplAtLo.toFixed(1)}
              </text>
            </g>
          )}
          {hHi >= xMin && hHi <= xMax && pplAtHi >= yMin && pplAtHi <= yMax && (
            <g>
              <circle cx={toX(hHi)} cy={toY(pplAtHi)} r={5} fill={HIGHLIGHT} stroke={BG} strokeWidth={2} />
              <text x={toX(hHi) + 8} y={toY(pplAtHi) - 9} textAnchor="start"
                fill={HIGHLIGHT} fontSize={9} fontFamily={FONT} fontWeight={700}>
                {pplAtHi.toFixed(1)}
              </text>
            </g>
          )}

          {/* Equation label */}
          {labelPt && (
            <text x={toX(labelPt.h) + 10} y={toY(labelPt.ppl) - 10}
              fill={ACCENT} fontSize={11} fontFamily={FONT} fontWeight={700} opacity={0.8}>
              PPL = e^({kl.toFixed(2)} + H)
            </text>
          )}

          {/* Axes */}
          <line x1={PL} y1={PT} x2={PL} y2={PT + ph} stroke={GRID} strokeWidth={1.2} />
          <line x1={PL} y1={PT + ph} x2={PL + pw} y2={PT + ph} stroke={GRID} strokeWidth={1.2} />

          {yTicks.map(v => (
            <text key={v} x={PL - 8} y={toY(v) + 4} textAnchor="end"
              fill={DIM} fontSize={9} fontFamily={FONT}>{v.toFixed(0)}</text>
          ))}
          {xTicks.map(t => (
            <text key={t} x={toX(t)} y={PT + ph + 16} textAnchor="middle"
              fill={DIM} fontSize={9.5} fontFamily={FONT}>{t.toFixed(1)}</text>
          ))}

          <text x={PL + pw / 2} y={H - 6} textAnchor="middle"
            fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}>
            Entropy H(q)
          </text>
          <text x={14} y={PT + ph / 2} textAnchor="middle"
            fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}
            transform={`rotate(-90, 14, ${PT + ph / 2})`}>
            Gen Perplexity (linear)
          </text>
        </svg>
      </div>

      {/* Range slider */}
      <div style={{ background: PANEL_BG, borderRadius: 8, border: `1px solid ${GRID}`, padding: "12px 16px 10px", marginBottom: 10 }}>
        <RangeSlider
          lo={hLo} hi={hHi}
          onChange={(lo, hi) => { setHLo(parseFloat(lo.toFixed(2))); setHHi(parseFloat(hi.toFixed(2))); }}
          min={H_ABS_MIN} max={H_ABS_MAX}
          label="Entropy range (highlight + zoom)"
          format={(v) => `H=${v.toFixed(2)}`}
        />
      </div>

      {/* Callout */}
      <div style={{
        background: CARD_BG, border: `1px solid ${HIGHLIGHT}22`,
        borderLeft: `3px solid ${HIGHLIGHT}88`,
        borderRadius: 6, padding: "9px 14px",
        fontSize: 11, color: MUTED, lineHeight: 1.7,
      }}>
        <span style={{ color: HIGHLIGHT, fontWeight: 700 }}>Highlighted range: </span>
        H ∈ [{hLo.toFixed(2)}, {hHi.toFixed(2)}] →
        PPL swings from{" "}
        <span style={{ color: ACCENT, fontWeight: 700 }}>{pplAtLo.toFixed(1)}</span> to{" "}
        <span style={{ color: HIGHLIGHT, fontWeight: 700 }}>{pplAtHi.toFixed(1)}</span>
        {" "}(<span style={{ color: TEXT, fontWeight: 700 }}>Δ {pplSwing.toFixed(1)}</span>)
        {" "}at fixed KL = {kl.toFixed(2)}
      </div>
    </div>
  );
}