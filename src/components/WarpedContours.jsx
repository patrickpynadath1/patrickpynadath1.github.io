import { useState, useCallback, useRef, useEffect, useMemo } from "react";

const BG        = "#0d0d1a";
const PANEL_BG  = "#13132b";
const CARD_BG   = "#0a0a18";
const GRID      = "#1a1a3a";
const TEXT      = "#ffffff";
const DIM       = "#444466";
const MUTED     = "#555";
const ACCENT    = "#7ee8fa";
const FONT      = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const KL_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5];
const KL_COLORS = [
  "#3dd68c","#a8e063","#e8d44d","#f0a830","#e05060",
];

const H_MIN   = 4.0;
const H_MAX   = 6.5;
const FREQ    = 6.5;
const ALPHA_MAX = (1 / FREQ) * 0.93;

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function warpVal(h, alpha)   { return h + alpha * Math.sin(FREQ * h); }
function warpDeriv(h, alpha) { return 1 + alpha * FREQ * Math.cos(FREQ * h); }
function unwarpVal(target, alpha) {
  let h = target;
  for (let i = 0; i < 32; i++) {
    const f  = warpVal(h, alpha) - target;
    const df = warpDeriv(h, alpha) || 1e-9;
    h -= f / df;
    h  = clamp(h, H_MIN - 0.5, H_MAX + 0.5);
  }
  return clamp(h, H_MIN, H_MAX);
}

function niceTicks(min, max, n = 5) {
  if (max <= min) return [];
  const range = max - min;
  const raw   = range / n;
  const mag   = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-10))));
  const step  = [1,2,2.5,5,10].map(s => s * mag).find(s => s >= raw) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + 1e-9; t += step)
    ticks.push(parseFloat(t.toFixed(10)));
  return ticks;
}

// ─── Slider ───────────────────────────────────────────────────────────────────
function Slider({ value, onChange, min, max, label, format, color = ACCENT, centerNotch = false }) {
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
    e.preventDefault(); dragging.current = true; setIsDragging(true);
    onChange(getVal(e.touches ? e.touches[0].clientX : e.clientX));
  }, [onChange, getVal]);

  const fillLeft  = centerNotch ? Math.min(0.5, fraction) : 0;
  const fillWidth = centerNotch ? Math.abs(fraction - 0.5) : fraction;

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
        {centerNotch && (
          <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 2, height: 10, borderRadius: 1, background: DIM, opacity: 0.5, zIndex: 1 }} />
        )}
        <div style={{
          position: "absolute", left: `${fillLeft * 100}%`, width: `${fillWidth * 100}%`,
          top: "50%", transform: "translateY(-50%)", height: 4, borderRadius: 2,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
        }} />
        <div style={{
          position: "absolute", left: `${fraction * 100}%`, top: "50%",
          transform: "translate(-50%, -50%)",
          width: isDragging ? 20 : 16, height: isDragging ? 20 : 16,
          borderRadius: "50%", background: color, border: `2px solid ${BG}`,
          boxShadow: isDragging ? `0 0 0 5px ${color}22, 0 0 14px ${color}44` : `0 0 0 3px ${color}18`,
          transition: "all 100ms ease", zIndex: 2,
        }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2, fontSize: 9, color: DIM, fontFamily: FONT }}>
        <span>{format(min)}</span><span>{format(max)}</span>
      </div>
    </div>
  );
}

// ─── Chart ────────────────────────────────────────────────────────────────────
function ContourChart({ alpha, points, onDragPoint, showContours }) {
  const svgRef   = useRef(null);
  const dragging = useRef(null);

  const W = 620, H = 420;
  const PL = 72, PR = 108, PT = 24, PB = 52;
  const pw = W - PL - PR, ph = H - PT - PB;

  // Compute Y range dynamically from the visible PPL values across all contours
  // so the chart always fills nicely regardless of H range
  const { pplMin, pplMax } = useMemo(() => {
    // Use the lowest KL curve's left endpoint and highest KL curve's right endpoint
    const lowestPPL = Math.exp(KL_LEVELS[0] + H_MIN);
    const highestPPL = Math.exp(KL_LEVELS[KL_LEVELS.length - 1] + H_MAX);
    return { pplMin: lowestPPL * 0.85, pplMax: highestPPL * 1.1 };
  }, []);

  const wMin = useMemo(() => warpVal(H_MIN, alpha), [alpha]);
  const wMax = useMemo(() => warpVal(H_MAX, alpha), [alpha]);

  const toX = useCallback((h) =>
    PL + ((warpVal(h, alpha) - wMin) / (wMax - wMin)) * pw,
    [alpha, wMin, wMax, pw]
  );

  // LINEAR Y — low PPL at TOP (small y = better), high PPL at BOTTOM
  const toY = useCallback((hxp) => {
    const ppl = Math.exp(hxp);
    return PT + ((clamp(ppl, pplMin, pplMax) - pplMin) / (pplMax - pplMin)) * ph;
  }, [ph, pplMin, pplMax]);

  const fromX = useCallback((px) => {
    const wTarget = wMin + ((px - PL) / pw) * (wMax - wMin);
    return unwarpVal(wTarget, alpha);
  }, [alpha, wMin, wMax, pw]);

  const fromY = useCallback((py) => {
    const ppl = pplMin + ((py - PT) / ph) * (pplMax - pplMin);
    return Math.log(clamp(ppl, pplMin, pplMax));
  }, [ph, pplMin, pplMax]);

  // Contour paths: PPL = exp(KL + H), plotted on linear Y
  const N = 400;
  const contourPaths = useMemo(() => KL_LEVELS.map((kl, ci) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const h   = H_MIN + (i / N) * (H_MAX - H_MIN);
      const hxp = kl + h;
      const ppl = Math.exp(hxp);
      if (ppl < pplMin || ppl > pplMax * 1.05) continue;
      pts.push({ x: toX(h), y: toY(hxp) });
    }
    if (pts.length < 2) return null;
    return {
      color: KL_COLORS[ci], kl,
      d: pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" "),
      labelPt: pts[Math.floor(pts.length * 0.88)],
    };
  }).filter(Boolean), [toX, toY, pplMin, pplMax]);

  const screenPts = useMemo(() =>
    points.map(p => ({ x: toX(p.h), y: toY(p.hxp) })),
    [points, toX, toY]
  );
  const pointKLs = points.map(p => p.hxp - p.h);

  // Drag
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const getPos = (e) => {
      const rect = svg.getBoundingClientRect();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      const cy = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        h:   clamp(fromX((cx - rect.left) * (W / rect.width)),  H_MIN, H_MAX),
        hxp: clamp(fromY((cy - rect.top)  * (H / rect.height)), Math.log(pplMin), Math.log(pplMax)),
      };
    };
    const onMove = (e) => {
      if (dragging.current === null) return;
      if (e.cancelable) e.preventDefault();
      const pos = getPos(e);
      onDragPoint(dragging.current, pos.h, pos.hxp);
    };
    const onUp = () => { dragging.current = null; };
    svg.addEventListener("mousemove",   onMove);
    window.addEventListener("mouseup",  onUp);
    svg.addEventListener("touchmove",   onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      svg.removeEventListener("mousemove",   onMove);
      window.removeEventListener("mouseup",  onUp);
      svg.removeEventListener("touchmove",   onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [fromX, fromY, onDragPoint, pplMin, pplMax]);

  const POINT_COLORS = ["#57c27c", "#e05c5c"];
  const POINT_LABELS = ["A", "B"];

  const xTicks  = useMemo(() => niceTicks(H_MIN, H_MAX, 6), []);
  const yTicks  = useMemo(() => niceTicks(pplMin, pplMax, 5), [pplMin, pplMax]);

  return (
    <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible", cursor: "crosshair" }}>
      <defs>
        <clipPath id="cc-clip">
          <rect x={PL} y={PT} width={pw} height={ph} />
        </clipPath>
      </defs>

      {/* Grid */}
      {xTicks.map(t => (
        <line key={t} x1={toX(t)} y1={PT} x2={toX(t)} y2={PT + ph}
          stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
      ))}
      {yTicks.map(v => (
        <line key={v} x1={PL} y1={toY(Math.log(v))} x2={PL + pw} y2={toY(Math.log(v))}
          stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
      ))}

      {/* Better annotation */}
      <text x={PL + 8} y={PT + 16} fill={DIM} fontSize={9} fontFamily={FONT} opacity={0.5}>
        ↑ better (lower PPL)
      </text>

      {/* KL contours */}
      {showContours && contourPaths.map(({ color, kl, d, labelPt }) => (
        <g key={kl} clipPath="url(#cc-clip)">
          <path d={d} fill="none" stroke={color} strokeWidth={1.8} opacity={0.65} />
          {labelPt && (
            <g>
              <rect x={labelPt.x - 40} y={labelPt.y - 9} width={36} height={13} rx={3}
                fill={BG} opacity={0.88} />
              <text x={labelPt.x - 36} y={labelPt.y + 1}
                fill={color} fontSize={9} fontFamily={FONT} fontWeight={700}>
                KL={kl.toFixed(2)}
              </text>
            </g>
          )}
        </g>
      ))}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + ph} stroke={GRID} strokeWidth={1.2} />
      <line x1={PL} y1={PT + ph} x2={PL + pw} y2={PT + ph} stroke={GRID} strokeWidth={1.2} />

      {/* Y ticks */}
      {yTicks.map(v => (
        <text key={v} x={PL - 8} y={toY(Math.log(v)) + 4} textAnchor="end"
          fill={DIM} fontSize={9} fontFamily={FONT}>{v.toFixed(0)}</text>
      ))}

      {/* X ticks */}
      {xTicks.map(t => (
        <text key={t} x={toX(t)} y={PT + ph + 16} textAnchor="middle"
          fill={DIM} fontSize={9.5} fontFamily={FONT}>{t.toFixed(1)}</text>
      ))}

      {/* Axis labels */}
      <text x={PL + pw / 2} y={H - 6} textAnchor="middle"
        fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}>
        {alpha === 0 ? "Entropy  H(q)" : "Warped Entropy  H̃(q)"}
      </text>
      <text x={14} y={PT + ph / 2} textAnchor="middle"
        fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}
        transform={`rotate(-90, 14, ${PT + ph / 2})`}>
        Gen Perplexity  ↓ worse (linear)
      </text>

      {alpha !== 0 && (
        <text x={PL + pw - 4} y={PT + 14} textAnchor="end"
          fill={ACCENT} fontSize={9} fontFamily={FONT} opacity={0.5}>
          H̃ = H + {alpha.toFixed(3)}·sin({FREQ}·H)
        </text>
      )}

      {/* Draggable points */}
      {screenPts.map((sp, i) => (
        <g key={i}
          onMouseDown={(e) => { e.preventDefault(); dragging.current = i; }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = i; }}
          style={{ cursor: "grab" }}>
          <circle cx={sp.x} cy={sp.y} r={18} fill={POINT_COLORS[i]} opacity={0.08} />
          <circle cx={sp.x} cy={sp.y} r={9}  fill={POINT_COLORS[i]} stroke={BG} strokeWidth={2} />
          <text x={sp.x} y={sp.y + 4} textAnchor="middle"
            fill="#fff" fontSize={10} fontFamily={FONT} fontWeight={700}>
            {POINT_LABELS[i]}
          </text>
          <rect x={sp.x - 24} y={sp.y - 28} width={48} height={15} rx={4}
            fill={PANEL_BG} stroke={POINT_COLORS[i]} strokeWidth={0.8} opacity={0.95} />
          <text x={sp.x} y={sp.y - 17} textAnchor="middle"
            fill={POINT_COLORS[i]} fontSize={9} fontFamily={FONT} fontWeight={700}>
            KL={pointKLs[i].toFixed(2)}
          </text>
        </g>
      ))}

      {/* Legend */}
      {showContours && (() => {
        const lx = PL + pw + 8, ly = PT + 8, lw = PR - 12;
        return (
          <g>
            <rect x={lx} y={ly} width={lw} height={KL_LEVELS.length * 18 + 18}
              rx={6} fill={PANEL_BG} stroke={GRID} strokeWidth={1} />
            <text x={lx + lw / 2} y={ly + 12} textAnchor="middle"
              fill={DIM} fontSize={8} fontFamily={FONT} letterSpacing="0.08em">KL LEVELS</text>
            {KL_LEVELS.map((kl, i) => (
              <g key={kl}>
                <line x1={lx + 8} y1={ly + 22 + i * 18} x2={lx + 22} y2={ly + 22 + i * 18}
                  stroke={KL_COLORS[i]} strokeWidth={2} />
                <text x={lx + 26} y={ly + 26 + i * 18}
                  fill={KL_COLORS[i]} fontSize={9} fontFamily={FONT}>{kl.toFixed(1)}</text>
              </g>
            ))}
          </g>
        );
      })()}
    </svg>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function KLContours() {
  const [alpha, setAlpha]               = useState(0);
  const [showContours, setShowContours] = useState(true);
  const [points, setPoints]             = useState([
    { h: 4.6, hxp: Math.log(80)  },  // A: KL = hxp - h ≈ 0.83
    { h: 5.4, hxp: Math.log(200) },  // B: KL ≈ 0.93 — slightly worse
  ]);

  const onDragPoint = useCallback((i, h, hxp) => {
    setPoints(prev => { const n = [...prev]; n[i] = { h, hxp }; return n; });
  }, []);

  const pointKLs  = points.map(p => p.hxp - p.h);
  const klDiff    = Math.abs(pointKLs[0] - pointKLs[1]);
  const gtWinner  = pointKLs[0] < pointKLs[1] ? "A" : "B";
  const ambiguous = !showContours || (klDiff < 0.25 + 0.9 * Math.abs(alpha / ALPHA_MAX) * 1.5);
  const pointPPLs = points.map(p => Math.exp(p.hxp).toFixed(0));

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: FONT, padding: "24px 20px 28px", userSelect: "none" }}>

      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          fontSize: 20, fontWeight: 700, letterSpacing: "0.02em", marginBottom: 6,
          background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          KL Contours Under Entropy Warping
        </div>
        <div style={{ fontSize: 11, color: MUTED }}>
          Drag A and B · warp the entropy axis to represent an imperfect but order preserving approximation · toggle contours to see how ordering becomes ambiguous
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, alignItems: "stretch" }}>
        <div style={{ flex: 1, background: PANEL_BG, borderRadius: 8, border: `1px solid ${GRID}`, padding: "12px 16px 10px" }}>
          <Slider
            value={alpha}
            onChange={(v) => setAlpha(parseFloat(v.toFixed(4)))}
            min={-ALPHA_MAX} max={ALPHA_MAX}
            label="Warp amplitude  α"
            format={(v) => v === 0 ? "α = 0  (identity)" : `α = ${v > 0 ? "+" : ""}${v.toFixed(3)}`}
            color={ACCENT} centerNotch
          />
        </div>
        <button
          onClick={() => setShowContours(s => !s)}
          style={{
            background: showContours ? ACCENT + "18" : PANEL_BG,
            border: `1px solid ${showContours ? ACCENT + "66" : GRID}`,
            borderRadius: 8, color: showContours ? ACCENT : DIM,
            fontFamily: FONT, fontSize: 10, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            padding: "0 18px", cursor: "pointer",
            transition: "all 180ms ease", whiteSpace: "nowrap",
          }}>
          {showContours ? "Hide\nContours" : "Show\nContours"}
        </button>
      </div>

      {/* Chart */}
      <div style={{ background: CARD_BG, borderRadius: 8, border: `1px solid ${GRID}`, padding: "14px 12px 8px", marginBottom: 10 }}>
        <ContourChart
          alpha={alpha} points={points}
          onDragPoint={onDragPoint} showContours={showContours}
        />
      </div>

      {/* Status */}
      <div style={{
        background: CARD_BG,
        border: `1px solid ${ambiguous ? "#e8d44d44" : "#3dd68c44"}`,
        borderLeft: `3px solid ${ambiguous ? "#e8d44d" : "#3dd68c"}`,
        borderRadius: 6, padding: "9px 14px",
        fontSize: 11, color: MUTED, lineHeight: 1.8,
        transition: "border-color 300ms ease",
      }}>
        <span style={{ color: ambiguous ? "#e8d44d" : "#3dd68c", fontWeight: 700 }}>
          {ambiguous
            ? (!showContours
                ? "⚠  Contours hidden — ordering unreadable from axes alone"
                : "⚠  Ordering visually ambiguous in warped space")
            : `✓  Clear ordering — ${gtWinner} has lower KL`}
        </span>
        {"  ·  "}
        KL(A)=<span style={{ color: "#57c27c", fontWeight: 700 }}>{pointKLs[0].toFixed(2)}</span>
        {" "}
        KL(B)=<span style={{ color: "#e05c5c", fontWeight: 700 }}>{pointKLs[1].toFixed(2)}</span>
        {"  ·  PPL(A)="}
        <span style={{ color: "#57c27c", fontWeight: 700 }}>{pointPPLs[0]}</span>
        {" PPL(B)="}
        <span style={{ color: "#e05c5c", fontWeight: 700 }}>{pointPPLs[1]}</span>
        {alpha !== 0 && <span style={{ color: DIM }}>{"  ·  entropy order preserved"}</span>}
      </div>
    </div>
  );
}