import React, { useState, useMemo, useCallback } from "react";

// ── Math utilities ───────────────────────────────────────────────────────────

function ndtr(x) {
  // Standard normal CDF approximation (Abramowitz & Stegun)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741;
  const a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const tt = 1.0 / (1.0 + p * ax);
  const y = 1.0 - ((((a5 * tt + a4) * tt + a3) * tt + a2) * tt + a1) * tt * Math.exp(-ax * ax);
  return 0.5 * (1.0 + sign * y);
}

function rhoValue(t, V = 50257) {
  if (t <= 0.001) return 0;
  if (t >= 0.999) return 1 - 1 / V;
  const mu = 1 - t;
  const std = t;
  // Numerical integration via Simpson's rule
  const lo = mu - 8 * std;
  const hi = mu + 8 * std;
  const N = 400;
  const h = (hi - lo) / N;
  let sum = 0;
  for (let i = 0; i <= N; i++) {
    const s = lo + i * h;
    const phiPow = Math.pow(ndtr(s / std), V - 1);
    const gauss = Math.exp(-0.5 * ((s - mu) / std) ** 2) / (std * Math.sqrt(2 * Math.PI));
    const w = i === 0 || i === N ? 1 : i % 2 === 1 ? 4 : 2;
    sum += w * phiPow * gauss;
  }
  const probCorrect = (h / 3) * sum;
  return Math.max(0, Math.min(1, 1 - probCorrect));
}

function rValue(t) {
  if (t <= 0.001) return 0;
  if (t >= 0.999) return 0.5;
  return ndtr(-(1 - t) / (t * Math.SQRT2));
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SENTENCE = ["the", "cat", "sat", "down"];
const COMPETITORS = {
  the: ["the", "a", "this", "that", "each", "every", "its", "one"],
  cat: ["cat", "dog", "fox", "rat", "bird", "bear", "wolf", "fish"],
  sat: ["sat", "lay", "fell", "stood", "knelt", "leaned", "slept", "ran"],
  down: ["down", "back", "away", "still", "up", "out", "flat", "here"],
};

const N_VOCAB = 50257;
const N_DISPLAY = 6;
const TEMP = 0.6;
const SPREAD_EXP = 2.0;

const n_bg = N_VOCAB - N_DISPLAY;
// ppf(0.5^(1/n_bg)) ≈ 4.15
const bg_eps = 4.15;
const BG_SLOT = 1;

// Noise vectors from Python's np.random.default_rng(42) — hardcoded to match GIFs exactly
const allComps = SENTENCE.map((w) => COMPETITORS[w].slice(0, N_DISPLAY));
const allNoise = [
  [ 0.3047, -1.0400,  0.7505,  0.9406, -1.9510, -1.3022],  // the
  [-0.0168, -0.8530,  0.8794,  0.7778,  0.0660,  1.1272],  // cat
  [ 0.3688, -0.9589,  0.8785, -0.0499, -0.1849, -0.6809],  // sat
  [-0.4283, -0.3521,  0.5323,  0.3654,  0.4127,  0.4308],  // down
];
const allOnehot = allComps.map((c) => c.map((_, i) => (i === 0 ? 1 : 0)));

// CANDI thresholds — evenly spaced then shuffled
const candiThresholds = [0.6, 0.2, 0.8, 0.4];

function softmaxComp(xt) {
  const logits = xt.map((v) => v / TEMP);
  const mx = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - mx));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / s);
}

function computeFrame(t, tokenIdx) {
  const onehot = allOnehot[tokenIdx];
  const noise = allNoise[tokenIdx];
  const n = onehot.length;

  let xt = onehot.map((o, j) => (1 - t) * o + t * noise[j]);

  // Background winner injection
  const bgVal = bg_eps * t;
  if (bgVal > xt[0]) {
    xt = [...xt];
    xt[BG_SLOT] = bgVal;
  }

  const probs = softmaxComp(xt);
  const margin = xt[0] - Math.max(...xt.slice(1));
  const argmax = xt.indexOf(Math.max(...xt));

  return { xt, probs, margin, argmax };
}

// ── Precompute rho curve for reparam inversion ───────────────────────────────

const LUT_SIZE = 500;
const rhoLutT = Array.from({ length: LUT_SIZE }, (_, i) => (i / (LUT_SIZE - 1)) * 0.9999);
const rhoLutVal = rhoLutT.map((t) => rhoValue(t));
const rhoMax = rhoLutVal[rhoLutVal.length - 1];

function rhoToT(rhoTarget) {
  // Linear interpolation on the LUT
  for (let i = 0; i < LUT_SIZE - 1; i++) {
    if (rhoLutVal[i] <= rhoTarget && rhoTarget <= rhoLutVal[i + 1]) {
      const frac = (rhoTarget - rhoLutVal[i]) / (rhoLutVal[i + 1] - rhoLutVal[i] + 1e-12);
      return rhoLutT[i] + frac * (rhoLutT[i + 1] - rhoLutT[i]);
    }
  }
  return rhoTarget >= rhoMax ? 0.9999 : 0;
}

// ── Precompute metric curves for panel drawing ───────────────────────────────

const CURVE_PTS = 120;

function buildCurvePoints(schedule) {
  const pts = [];
  for (let i = 0; i <= CURVE_PTS; i++) {
    const tau = i / CURVE_PTS; // 0 = noise, 1 = clean
    let t;
    if (schedule === "uniform") {
      t = 1 - tau;
    } else if (schedule === "reparam") {
      const rhoTarget = rhoMax * (1 - tau);
      t = rhoToT(rhoTarget);
    } else {
      t = 1 - tau;
    }
    pts.push({ tau, t, rho: schedule === "candi" ? t : rhoValue(t), r: schedule === "candi" ? t * 0.5 : rValue(t) });
  }
  return pts;
}

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: "#0d0d1a",
  card: "#13132b",
  panel: "#0a0a18",
  correct: "#7ee8fa",
  correctDim: "#2a6a7a",
  other: ["#e879f9", "#f97316", "#a3e635", "#60a5fa", "#fb7185", "#fbbf24"],
  rho: "#f97316",
  r: "#a3e635",
  label: "#444466",
  white: "#ffffff",
  muted: "#555",
  border: "#222",
  tabActive: "#7ee8fa",
  tabInactive: "#444466",
};

// ── Component ────────────────────────────────────────────────────────────────

const SCHEDULES = [
  { key: "uniform", label: "Uniform" },
  { key: "reparam", label: "Reparam" },
  { key: "candi", label: "CANDI" },
];

export default function FlowMatchingViz() {
  const [schedule, setSchedule] = useState("uniform");
  const [tau, setTau] = useState(0); // 0 = noise, 1 = clean

  const curvePoints = useMemo(() => buildCurvePoints(schedule), [schedule]);

  // Map tau → t
  const t = useMemo(() => {
    if (schedule === "uniform" || schedule === "candi") return 1 - tau;
    if (schedule === "reparam") {
      const rhoTarget = rhoMax * (1 - tau);
      return rhoToT(rhoTarget);
    }
    return 1 - tau;
  }, [schedule, tau]);

  // Current metric values
  const currentRho = schedule === "candi" ? t : rhoValue(t);
  const currentR = schedule === "candi" ? t * 0.5 : rValue(t);

  // Compute frames for each token
  const tokenFrames = useMemo(() => {
    return SENTENCE.map((_, idx) => {
      const frame = computeFrame(t, idx);
      // Spread = (1-t)^SPREAD_EXP: monotonic, 0 at t=1 (noise), 1 at t=0 (clean)
      const spread = Math.pow(1 - t, SPREAD_EXP);
      return { ...frame, spread };
    });
  }, [t]);

  const handleTauChange = useCallback((e) => {
    setTau(Number(e.target.value) / 1000);
  }, []);

  // Y positions for spread
  const ySpread = Array.from({ length: N_DISPLAY }, (_, i) => 0.88 - (i * 0.82) / (N_DISPLAY - 1));
  const yCenter = 0.47;

  const isCandi = schedule === "candi";
  const rhoLabel = isCandi ? "discrete corruption  ρ = t" : "discrete corruption  ρ(t)";
  const rLabel = isCandi ? "continuous rank degradation  r = t/2" : "rank degradation  r(t)";

  return (
    <div
      style={{
        background: C.bg,
        minHeight: "auto",
        padding: "12px 8px 20px",
        fontFamily: "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace",
        color: C.white,
        overflow: "hidden",
      }}
    >
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div
          style={{
            fontSize: "clamp(13px, 3.2vw, 19px)",
            fontWeight: 700,
            margin: 0,
            letterSpacing: "0.02em",
            background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Flow Matching · Token Emergence from Noise
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: 0,
          marginBottom: 14,
        }}
      >
        {SCHEDULES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setSchedule(key)}
            style={{
              background: schedule === key ? "rgba(126,232,250,0.12)" : "transparent",
              color: schedule === key ? C.tabActive : C.tabInactive,
              border: `1px solid ${schedule === key ? "rgba(126,232,250,0.35)" : "#222"}`,
              borderRadius: key === "uniform" ? "8px 0 0 8px" : key === "candi" ? "0 8px 8px 0" : 0,
              padding: "8px 18px",
              fontSize: "clamp(11px, 2.5vw, 14px)",
              fontFamily: "inherit",
              fontWeight: schedule === key ? 700 : 400,
              cursor: "pointer",
              transition: "all 0.2s",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Main layout: tokens + panels */}
      <div
        style={{
          display: "flex",
          gap: 8,
          maxWidth: 1100,
          margin: "0 auto",
        }}
      >
        {/* Token cards */}
        <div style={{ flex: 3, display: "flex", gap: 4 }}>
          {SENTENCE.map((word, idx) => {
            const frame = tokenFrames[idx];
            const comp = allComps[idx];
            // CANDI: individual thresholds for each position
            // Uniform/Reparam: all positions snap clean together at the very end
            const isClean = isCandi ? (t <= candiThresholds[idx]) : (t <= 0.05);

            return (
              <div
                key={word}
                style={{
                  flex: 1,
                  background: isClean ? "rgba(126,232,250,0.06)" : C.card,
                  borderRadius: 8,
                  border: `1px solid ${isClean ? "rgba(126,232,250,0.2)" : "#1a1a3a"}`,
                  position: "relative",
                  height: "clamp(180px, 45vw, 300px)",
                  overflow: "hidden",
                  transition: "background 0.4s, border 0.4s",
                }}
              >
                {/* Target label */}
                <div
                  style={{
                    position: "absolute",
                    top: 4,
                    width: "100%",
                    textAlign: "center",
                    fontSize: "clamp(8px, 1.8vw, 11px)",
                    color: C.label,
                    fontStyle: "italic",
                    letterSpacing: "0.05em",
                  }}
                >
                  {word}
                </div>

                {/* Words */}
                {isClean ? (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      fontSize: "clamp(16px, 4vw, 24px)",
                      fontWeight: 700,
                      color: C.correct,
                      textShadow: "0 0 18px rgba(126,232,250,0.5)",
                      transition: "all 0.3s",
                    }}
                  >
                    {comp[0]}
                  </div>
                ) : (
                  comp.slice(0, N_DISPLAY).map((w, slot) => {
                    const yTarget = ySpread[slot];
                    const y = yCenter + frame.spread * (yTarget - yCenter);
                    const pct = (1 - y) * 100;

                    const isCorrect = slot === 0;
                    const isArgmax = slot === frame.argmax;
                    const prob = frame.probs[slot];

                    let color, weight, size, alpha;
                    if (isArgmax && isCorrect) {
                      color = C.correct;
                      weight = 700;
                      size = "clamp(13px, 3.2vw, 18px)";
                      alpha = 1;
                    } else if (isArgmax) {
                      color = C.white;
                      weight = 400;
                      size = "clamp(13px, 3.2vw, 18px)";
                      alpha = 1;
                    } else if (isCorrect) {
                      color = C.correctDim;
                      weight = 400;
                      size = "clamp(11px, 2.8vw, 16px)";
                      alpha = 0.92;
                    } else {
                      color = C.other[(slot - 1) % C.other.length];
                      weight = 400;
                      size = "clamp(11px, 2.8vw, 16px)";
                      alpha = 0.9;
                    }

                    return (
                      <div
                        key={slot}
                        style={{
                          position: "absolute",
                          top: `${pct}%`,
                          left: "50%",
                          transform: "translate(-50%, -50%)",
                          color,
                          fontWeight: weight,
                          fontSize: size,
                          opacity: alpha,
                          transition: "top 0.08s linear, opacity 0.15s, color 0.15s",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {w}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>

        {/* Side panels */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
          {/* ρ panel */}
          <MetricPanel
            label={rhoLabel}
            color={C.rho}
            value={currentRho}
            maxY={1.05}
            curvePoints={curvePoints}
            metric="rho"
            tau={tau}
            candiThresholds={isCandi ? candiThresholds : null}
          />
          {/* r panel */}
          <MetricPanel
            label={rLabel}
            color={C.r}
            value={currentR}
            maxY={0.55}
            curvePoints={curvePoints}
            metric="r"
            tau={tau}
            dashAt={0.5}
            candiThresholds={isCandi ? candiThresholds : null}
          />
        </div>
      </div>

      {/* Slider */}
      <div style={{ maxWidth: 1100, margin: "16px auto 0", padding: "0 4px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "clamp(9px, 2vw, 12px)",
            color: C.muted,
            marginBottom: 6,
            letterSpacing: "0.04em",
          }}
        >
          <span>noise (t = 1)</span>
          <span style={{ color: "#888", fontWeight: 600 }}>
            t = {t.toFixed(3)} &nbsp;·&nbsp; τ = {tau.toFixed(3)}
          </span>
          <span>clean (t = 0)</span>
        </div>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(tau * 1000)}
          onChange={handleTauChange}
          style={{
            width: "100%",
            height: 40,
            appearance: "none",
            WebkitAppearance: "none",
            background: "transparent",
            cursor: "pointer",
            outline: "none",
          }}
          className="flow-slider"
        />
      </div>

      {/* Schedule description */}
      <div
        style={{
          maxWidth: 1100,
          margin: "8px auto 0",
          textAlign: "center",
          fontSize: "clamp(9px, 2vw, 11px)",
          color: "#555",
          lineHeight: 1.5,
          letterSpacing: "0.02em",
        }}
      >
        {schedule === "uniform" && "Uniform: τ steps linearly through t. Corruption ρ(t) has a sharp S-curve — most denoising happens in a narrow t-band."}
        {schedule === "reparam" && "Reparam: τ steps so ρ(t) decreases linearly — equal corruption progress per step. Spends more time where denoising is hardest."}
        {schedule === "candi" && "CANDI: Each position has a random threshold. Positions snap clean one-by-one as t drops below their threshold. ρ = t by construction."}
      </div>

      {/* Custom slider styles */}
      <style>{`
        .flow-slider::-webkit-slider-runnable-track {
          height: 6px;
          border-radius: 3px;
          background: linear-gradient(90deg, #1a1a3a 0%, rgba(126,232,250,0.25) 50%, #1a1a3a 100%);
        }
        .flow-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #b0f0ff, #7ee8fa 60%, #3a8a9a);
          border: 2px solid rgba(126,232,250,0.6);
          margin-top: -11px;
          box-shadow: 0 0 12px rgba(126,232,250,0.4), 0 2px 8px rgba(0,0,0,0.5);
          cursor: pointer;
        }
        .flow-slider::-moz-range-track {
          height: 6px;
          border-radius: 3px;
          background: linear-gradient(90deg, #1a1a3a 0%, rgba(126,232,250,0.25) 50%, #1a1a3a 100%);
          border: none;
        }
        .flow-slider::-moz-range-thumb {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: radial-gradient(circle at 40% 35%, #b0f0ff, #7ee8fa 60%, #3a8a9a);
          border: 2px solid rgba(126,232,250,0.6);
          box-shadow: 0 0 12px rgba(126,232,250,0.4), 0 2px 8px rgba(0,0,0,0.5);
          cursor: pointer;
        }
        .flow-slider:active::-webkit-slider-thumb {
          box-shadow: 0 0 20px rgba(126,232,250,0.7), 0 2px 8px rgba(0,0,0,0.5);
          transform: scale(1.1);
        }
      `}</style>
    </div>
  );
}

// ── Metric panel (SVG mini chart) ────────────────────────────────────────────

function MetricPanel({ label, color, value, maxY, curvePoints, metric, tau, dashAt, candiThresholds }) {
  const W = 200;
  const H = 80;
  const pad = { t: 4, r: 4, b: 16, l: 4 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;

  const toX = (tauVal) => pad.l + tauVal * cw;
  const toY = (val) => pad.t + ch - (val / maxY) * ch;

  // Build path
  const pathD = curvePoints
    .map((p, i) => {
      const x = toX(p.tau);
      const y = toY(metric === "rho" ? p.rho : p.r);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Current dot position
  const dotX = toX(tau);
  const dotY = toY(value);

  // Filled area up to current tau
  const fillPoints = curvePoints.filter((p) => p.tau <= tau + 0.005);
  let fillD = "";
  if (fillPoints.length > 1) {
    fillD = fillPoints
      .map((p, i) => {
        const x = toX(p.tau);
        const y = toY(metric === "rho" ? p.rho : p.r);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
    const lastX = toX(fillPoints[fillPoints.length - 1].tau);
    fillD += ` L${lastX.toFixed(1)},${toY(0).toFixed(1)} L${pad.l},${toY(0).toFixed(1)} Z`;
  }

  return (
    <div
      style={{
        background: C.panel,
        borderRadius: 6,
        border: "1px solid #1a1a3a",
        padding: "6px 6px 2px",
        flex: 1,
      }}
    >
      <div
        style={{
          fontSize: "clamp(7px, 1.6vw, 9px)",
          color,
          fontWeight: 600,
          textAlign: "center",
          marginBottom: 2,
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        {/* Zero line */}
        <line x1={pad.l} y1={toY(0)} x2={W - pad.r} y2={toY(0)} stroke="#222" strokeWidth="0.5" />

        {/* Dash line (e.g., r max = 0.5) */}
        {dashAt != null && (
          <line
            x1={pad.l}
            y1={toY(dashAt)}
            x2={W - pad.r}
            y2={toY(dashAt)}
            stroke="#444"
            strokeWidth="0.5"
            strokeDasharray="3,3"
          />
        )}

        {/* CANDI snap thresholds */}
        {candiThresholds &&
          candiThresholds.map((u, i) => {
            const tauSnap = 1 - u;
            return (
              <line
                key={i}
                x1={toX(tauSnap)}
                y1={pad.t}
                x2={toX(tauSnap)}
                y2={H - pad.b}
                stroke="#333"
                strokeWidth="0.5"
                strokeDasharray="2,2"
              />
            );
          })}

        {/* Filled area */}
        {fillD && <path d={fillD} fill={color} opacity={0.08} />}

        {/* Curve */}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" opacity={0.5} />

        {/* Current dot */}
        <circle cx={dotX} cy={dotY} r="4" fill={color} />

        {/* Value text */}
        <text x={W - pad.r - 2} y={pad.t + 12} textAnchor="end" fill={color} fontSize="9" fontFamily="inherit">
          {value.toFixed(3)}
        </text>

        {/* Axis labels */}
        <text x={pad.l} y={H - 2} fill="#555" fontSize="6" fontFamily="inherit">
          noise
        </text>
        <text x={W - pad.r} y={H - 2} textAnchor="end" fill="#555" fontSize="6" fontFamily="inherit">
          clean
        </text>
      </svg>
    </div>
  );
}