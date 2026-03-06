import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";

// ── Math utilities ───────────────────────────────────────────────────────────

function ndtr(x) {
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

// ── Vocab scaling ─────────────────────────────────────────────────────────────

function vocabToNDisplay(V) {
  const logV = Math.log(Math.max(V, 2));
  const logLo = Math.log(5);
  const logHi = Math.log(50257);
  const n = 5 + ((logV - logLo) / (logHi - logLo)) * (12 - 5);
  return Math.max(5, Math.min(16, Math.round(n)));
}

// ── Data ─────────────────────────────────────────────────────────────────────

const SENTENCE = ["the", "cat", "sat", "down"];

const COMPETITORS_ALL = {
  the:  ["the",  "a",     "this",  "that",  "each",  "every", "its",   "one",   "an",    "any",   "all",   "both",  "our",   "their", "some",  "no"],
  cat:  ["cat",  "dog",   "fox",   "rat",   "bird",  "bear",  "wolf",  "fish",  "frog",  "deer",  "crow",  "hawk",  "owl",   "lamb",  "mule",  "lynx"],
  sat:  ["sat",  "lay",   "fell",  "stood", "knelt", "leaned","slept", "ran",   "crept", "rested","stayed","curled","paused","settled","lounged","perched"],
  down: ["down", "back",  "away",  "still", "up",    "out",   "flat",  "here",  "near",  "low",   "soft",  "quiet", "slow",  "deep",  "close", "wide"],
};

const allNoiseBase = [
  [ 0.3047, -1.0400,  0.7505,  0.9406, -1.9510, -1.3022,  0.5123, -0.2341,  0.8834, -0.6123,  1.1023, -0.4512,  0.3341, -0.7823,  0.9012, -0.1234],
  [-0.0168, -0.8530,  0.8794,  0.7778,  0.0660,  1.1272, -0.3421,  0.6123, -0.9012,  0.4512,  0.2341, -0.5123,  0.7823, -0.3341,  1.0123, -0.8834],
  [ 0.3688, -0.9589,  0.8785, -0.0499, -0.1849, -0.6809,  0.4512, -0.7823,  0.2341, -0.9012,  0.5123, -0.3341,  0.8834, -0.1234,  0.6123, -0.4512],
  [-0.4283, -0.3521,  0.5323,  0.3654,  0.4127,  0.4308, -0.9012,  0.2341, -0.5123,  0.7823, -0.3341,  0.8834, -0.6123,  0.4512, -0.1234,  0.9012],
];

const TEMP = 0.6;
const SPREAD_EXP = 2.0;
const BG_SLOT = 1;
const candiThresholds = [0.6, 0.2, 0.8, 0.4];

// Random vocab for uniform corruption flickering
const RANDOM_VOCAB = [
  "blue", "nine", "from", "jump", "milk", "tree", "held", "warm",
  "plot", "song", "open", "dark", "kind", "fish", "told", "edge",
  "slow", "deep", "thin", "wide", "cold", "next", "long", "such",
];

// Mask thresholds — evenly spaced then shuffled (matches Python seed 42)
const maskThresholds = [0.6, 0.2, 0.8, 0.4]; // same as candiThresholds for visual consistency

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── Pre-simulate uniform CTMC states ─────────────────────────────────────────
// Returns states[frameIdx][tokenIdx] = null (correct) | string (wrong word)
function simulateUniformCTMC(nFrames = 200) {
  const rng = mulberry32(42);
  const randChoice = (arr) => arr[Math.floor(rng() * arr.length)];

  // Initialize all corrupted
  let current = SENTENCE.map(() => randChoice(RANDOM_VOCAB));

  const states = [];
  for (let f = 0; f < nFrames; f++) {
    const t2 = 1 - f / (nFrames - 1); // t goes 1→0 as frame goes 0→nFrames-1
    const t1 = 1 - Math.max(0, f - 1) / (nFrames - 1);

    if (f === 0) {
      states.push([...current]);
      continue;
    }

    const newState = current.map((cur, j) => {
      if (cur === null) return null; // already correct, stays correct
      if (t1 <= 0) return null;

      const pSnap = 1 - t2 / t1;
      const gamma = t2 > 0 ? (1 - t1) / (1 - t2) : 0;
      const pSame = gamma * (t2 / t1);

      const r = rng();
      if (r < pSnap) {
        return null; // snap to correct
      } else if (r < pSnap + pSame) {
        return cur; // keep same wrong word
      } else {
        // resample a new wrong word
        const pool = RANDOM_VOCAB.filter(w => w !== cur && w !== SENTENCE[j]);
        return pool[Math.floor(rng() * pool.length)];
      }
    });

    current = newState;
    states.push([...current]);
  }
  return states;
}

const UNIFORM_CTMC_STATES = simulateUniformCTMC(200);

// ── Continuous flow utilities ─────────────────────────────────────────────────

function softmaxComp(xt) {
  const logits = xt.map((v) => v / TEMP);
  const mx = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - mx));
  const s = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / s);
}

function computeFrame(t, tokenIdx, nDisplay, V) {
  const onehot = Array.from({ length: nDisplay }, (_, i) => (i === 0 ? 1 : 0));
  const noise = allNoiseBase[tokenIdx].slice(0, nDisplay);
  let xt = onehot.map((o, j) => (1 - t) * o + t * noise[j]);
  const bgVal = (Math.log(Math.max(V - nDisplay, 2)) / Math.log(50000)) * 4.15 * t;
  if (bgVal > xt[0]) { xt = [...xt]; xt[BG_SLOT] = bgVal; }
  const probs = softmaxComp(xt);
  const argmax = xt.indexOf(Math.max(...xt));
  return { xt, probs, argmax };
}

// ── LUT builders ─────────────────────────────────────────────────────────────

const LUT_SIZE = 500;

function buildRhoLut(V) {
  const rhoLutT = Array.from({ length: LUT_SIZE }, (_, i) => (i / (LUT_SIZE - 1)) * 0.9999);
  const rhoLutVal = rhoLutT.map((t) => rhoValue(t, V));
  return { rhoLutT, rhoLutVal, rhoMax: rhoLutVal[rhoLutVal.length - 1] };
}

function rhoToT(rhoTarget, rhoLutVal, rhoLutT, rhoMax) {
  for (let i = 0; i < LUT_SIZE - 1; i++) {
    if (rhoLutVal[i] <= rhoTarget && rhoTarget <= rhoLutVal[i + 1]) {
      const frac = (rhoTarget - rhoLutVal[i]) / (rhoLutVal[i + 1] - rhoLutVal[i] + 1e-12);
      return rhoLutT[i] + frac * (rhoLutT[i + 1] - rhoLutT[i]);
    }
  }
  return rhoTarget >= rhoMax ? 0.9999 : 0;
}

const CURVE_PTS = 120;

function buildCurvePoints(schedule, rhoLutVal, rhoLutT, rhoMax, V) {
  const pts = [];
  for (let i = 0; i <= CURVE_PTS; i++) {
    const tau = i / CURVE_PTS;
    let t;
    if (schedule === "uniform") t = 1 - tau;
    else if (schedule === "reparam") {
      const rhoTarget = rhoMax * (1 - tau);
      t = rhoToT(rhoTarget, rhoLutVal, rhoLutT, rhoMax);
    } else t = 1 - tau; // candi, masked, uniform-ctmc all linear
    pts.push({
      tau, t,
      rho: (schedule === "candi" || schedule === "masked" || schedule === "uniformctmc") ? t : rhoValue(t, V),
      r:   (schedule === "candi" || schedule === "masked" || schedule === "uniformctmc") ? t * 0.5 : rValue(t),
    });
  }
  return pts;
}

// ── Colors ───────────────────────────────────────────────────────────────────

const C = {
  bg: "#0d0d1a", card: "#13132b", panel: "#0a0a18",
  correct: "#7ee8fa", correctDim: "#2a6a7a",
  mask: "#555577",
  corrupt: "#e879f9",
  other: ["#e879f9","#f97316","#a3e635","#60a5fa","#fb7185","#fbbf24","#34d399","#f472b6","#818cf8","#fdba74","#86efac","#67e8f9"],
  rho: "#f97316", r: "#a3e635",
  label: "#444466", white: "#ffffff", muted: "#555", border: "#222",
  tabActive: "#7ee8fa", tabInactive: "#444466",
};

// ── Vocab presets ─────────────────────────────────────────────────────────────

const VOCAB_PRESETS = [
  { label: "5",  value: 5 },
  { label: "1K", value: 1000 },
  { label: "8K", value: 8192 },
  { label: "32K",value: 32000 },
  { label: "50K",value: 50257 },
];

const V_MIN = 5, V_MAX = 50257;
const logMin = Math.log(V_MIN), logMax = Math.log(V_MAX);

function sliderToVocab(v) {
  return Math.round(Math.exp(logMin + (v / 1000) * (logMax - logMin)));
}
function vocabToSlider(V) {
  return Math.round(((Math.log(V) - logMin) / (logMax - logMin)) * 1000);
}

// ── Schedules ─────────────────────────────────────────────────────────────────

const SCHEDULES = [
  { key: "masked",     label: "(D) Masked" },
  { key: "uniformctmc",label: "(D) Uniform" },
  { key: "uniform",    label: "(C) Linear Interpolation" },
  { key: "reparam",    label: "(C) Discrete Reparam" },
  { key: "candi",      label: "(H) Hybrid" },
];

// ── Main component ────────────────────────────────────────────────────────────

export default function FlowMatchingViz() {
  const [schedule, setSchedule] = useState("uniform");
  const [tau, setTau] = useState(0);
  const [vocabSize, setVocabSize] = useState(50257);

  const nDisplay = useMemo(() => vocabToNDisplay(vocabSize), [vocabSize]);
  const { rhoLutT, rhoLutVal, rhoMax } = useMemo(() => buildRhoLut(vocabSize), [vocabSize]);

  const curvePoints = useMemo(
    () => buildCurvePoints(schedule, rhoLutVal, rhoLutT, rhoMax, vocabSize),
    [schedule, rhoLutVal, rhoLutT, rhoMax, vocabSize]
  );

  const t = useMemo(() => {
    if (schedule === "reparam") {
      return rhoToT(rhoMax * (1 - tau), rhoLutVal, rhoLutT, rhoMax);
    }
    return 1 - tau;
  }, [schedule, tau, rhoMax, rhoLutVal, rhoLutT]);

  const isDiscrete = schedule === "masked" || schedule === "uniformctmc";
  const isCandi = schedule === "candi";
  const isMasked = schedule === "masked";
  const isUniformCTMC = schedule === "uniformctmc";

  const currentRho = (isCandi || isDiscrete) ? t : rhoValue(t, vocabSize);
  const currentR   = (isCandi || isDiscrete) ? t * 0.5 : rValue(t);

  // Continuous flow frames (only used for non-discrete modes)
  const tokenFrames = useMemo(() => {
    if (isDiscrete) return null;
    return SENTENCE.map((_, idx) => {
      const frame = computeFrame(t, idx, nDisplay, vocabSize);
      const spread = Math.pow(1 - t, SPREAD_EXP);
      return { ...frame, spread };
    });
  }, [t, nDisplay, vocabSize, isDiscrete]);

  // Uniform CTMC frame index from tau
  const ctmcFrameIdx = useMemo(() => {
    return Math.min(
      Math.floor(tau * (UNIFORM_CTMC_STATES.length - 1)),
      UNIFORM_CTMC_STATES.length - 1
    );
  }, [tau]);

  const handleTauChange = useCallback((e) => setTau(Number(e.target.value) / 1000), []);
  const handleVocabSlider = useCallback((e) => setVocabSize(sliderToVocab(Number(e.target.value))), []);

  const ySpread = Array.from({ length: nDisplay }, (_, i) => 0.88 - (i * 0.82) / Math.max(nDisplay - 1, 1));
  const yCenter = 0.47;

  const rhoLabel = (isCandi || isDiscrete) ? "discrete corruption  ρ = t" : "discrete corruption  ρ(t)";
  const rLabel   = (isCandi || isDiscrete) ? "rank degradation  r = t/2"  : "rank degradation  r(t)";

  const descMap = {
    masked:      "Masked: Each position is either [MASK] or the correct token — a binary state.",
    uniformctmc: "Uniform: Positions transition through random tokens until reaching their final words.",
    uniform:     "Linear Interpolation: Discrete corruption is controlled through Continuous noise, which follows the flow matching linear interpolation schedule.",
    reparam:     "Discrete Corruption Reparam (FLM): Noise schedule is reparameterized so that discrete corruption is uniformly distributed across the process.",
    candi:       "Hybrid Discrete-Continuous Kernel (CANDI, CADD, CCDD): Discrete and continuous corruption are handled separately through separate schedules.",
  };

  // Border radius helpers for the tab strip
  const tabRadius = (key) => {
    if (key === "uniform") return "8px 0 0 8px";
    if (key === "uniformctmc") return "0 8px 8px 0";
    return "0";
  };

  return (
    <div style={{
      background: C.bg, minHeight: "auto", padding: "12px 8px 20px",
      fontFamily: "'JetBrains Mono','Fira Code','SF Mono',monospace",
      color: C.white, overflow: "hidden",
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 10 }}>
        <div style={{
          fontSize: "clamp(13px,3.2vw,19px)", fontWeight: 700, letterSpacing: "0.02em",
          background: "linear-gradient(90deg,#7ee8fa 0%,#e879f9 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Token Emergence from Noise
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", justifyContent: "center", gap: 0, marginBottom: 12 }}>
        {SCHEDULES.map(({ key, label }) => (
          <button key={key} onClick={() => setSchedule(key)} style={{
            background: schedule === key ? "rgba(126,232,250,0.12)" : "transparent",
            color: schedule === key ? C.tabActive : C.tabInactive,
            border: `1px solid ${schedule === key ? "rgba(126,232,250,0.35)" : "#222"}`,
            borderRadius: tabRadius(key),
            padding: "8px 14px",
            fontSize: "clamp(10px,2.2vw,13px)",
            fontFamily: "inherit", fontWeight: schedule === key ? 700 : 400,
            cursor: "pointer", transition: "all 0.2s",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {label}
          </button>
        ))}
      </div>

      {/* Vocab size control */}
      <div style={{
        maxWidth: 1100, margin: "0 auto 14px",
        background: "rgba(126,232,250,0.04)",
        border: "1px solid rgba(126,232,250,0.1)",
        borderRadius: 8, padding: "10px 14px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <span style={{ fontSize: "clamp(9px,2vw,11px)", color: "#7ee8fa", letterSpacing: "0.06em", fontWeight: 600 }}>
            VOCAB SIZE
          </span>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {VOCAB_PRESETS.map(({ label, value }) => (
              <button key={value} onClick={() => setVocabSize(value)} style={{
                background: vocabSize === value ? "rgba(126,232,250,0.15)" : "transparent",
                color: vocabSize === value ? "#7ee8fa" : "#444466",
                border: `1px solid ${vocabSize === value ? "rgba(126,232,250,0.3)" : "#1a1a3a"}`,
                borderRadius: 4, padding: "2px 8px",
                fontSize: "clamp(8px,1.8vw,10px)", fontFamily: "inherit",
                cursor: "pointer", transition: "all 0.15s", letterSpacing: "0.04em",
              }}>
                {label}
              </button>
            ))}
            <span style={{ fontSize: "clamp(9px,2vw,11px)", color: "#888", minWidth: 90, textAlign: "right" }}>
              V={vocabSize.toLocaleString()} · n={nDisplay}
            </span>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <input type="range" min={0} max={1000} value={vocabToSlider(vocabSize)}
            onChange={handleVocabSlider}
            style={{ width: "100%", height: 32, appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: "pointer", outline: "none" }}
            className="vocab-slider"
          />
          <div style={{ position: "absolute", bottom: -2, left: 0, right: 0, height: 2, display: "flex", pointerEvents: "none" }}>
            {Array.from({ length: 8 }, (_, i) => {
              const nTarget = 5 + i;
              const logV = logMin + ((nTarget - 5) / 7) * (logMax - logMin);
              const xPct = ((logV - logMin) / (logMax - logMin)) * 100;
              return (
                <div key={i} style={{ position: "absolute", left: `${xPct}%`, transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 1, height: 4, background: "#333" }} />
                  <span style={{ fontSize: 6, color: "#444", marginTop: 1 }}>{nTarget}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "clamp(8px,1.6vw,9px)", color: "#444", marginTop: 10, letterSpacing: "0.03em" }}>
          <span>V=5 · n=5</span>
          <span style={{ color: "#7ee8fa", fontWeight: 600 }}>showing {nDisplay} competitors per token</span>
          <span>V=50,257 · n=12</span>
        </div>
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", gap: 8, maxWidth: 1100, margin: "0 auto" }}>
        {/* Token cards */}
        <div style={{ flex: 3, display: "flex", gap: 4 }}>
          {SENTENCE.map((word, idx) => {
            const comp = COMPETITORS_ALL[word].slice(0, nDisplay);

            // Determine clean state per mode
            let isClean;
            if (isMasked || isCandi) isClean = t <= maskThresholds[idx];
            else if (isUniformCTMC) isClean = UNIFORM_CTMC_STATES[ctmcFrameIdx][idx] === null;
            else isClean = t <= 0.05;

            // For uniform CTMC, what word is showing?
            const ctmcWord = isUniformCTMC && !isClean
              ? UNIFORM_CTMC_STATES[ctmcFrameIdx][idx]
              : null;

            const frame = tokenFrames ? tokenFrames[idx] : null;

            return (
              <div key={word} style={{
                flex: 1,
                background: isClean ? "rgba(126,232,250,0.06)" : C.card,
                borderRadius: 8,
                border: `1px solid ${isClean ? "rgba(126,232,250,0.2)" : "#1a1a3a"}`,
                position: "relative",
                height: "clamp(180px,45vw,300px)",
                overflow: "hidden",
                transition: "background 0.4s, border 0.4s",
              }}>
                {/* Target label */}
                <div style={{
                  position: "absolute", top: 4, width: "100%", textAlign: "center",
                  fontSize: "clamp(8px,1.8vw,11px)", color: C.label,
                  fontStyle: "italic", letterSpacing: "0.05em",
                }}>
                  {word}
                </div>

                {isClean ? (
                  // ── Clean: show correct token bright ──
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    fontSize: "clamp(16px,4vw,24px)", fontWeight: 700,
                    color: C.correct, textShadow: "0 0 18px rgba(126,232,250,0.5)",
                  }}>
                    {comp[0]}
                  </div>

                ) : isMasked ? (
                  // ── Masked: show [MASK] centered, dim ──
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    fontSize: "clamp(13px,3.2vw,18px)", fontWeight: 400,
                    color: C.mask, opacity: 0.7, letterSpacing: "0.05em",
                  }}>
                    [MASK]
                  </div>

                ) : isUniformCTMC ? (
                  // ── Uniform-D: show random flickering word centered ──
                  <div style={{
                    position: "absolute", top: "50%", left: "50%",
                    transform: "translate(-50%,-50%)",
                    fontSize: "clamp(13px,3.2vw,18px)", fontWeight: 400,
                    color: C.corrupt, opacity: 0.9,
                    transition: "color 0.05s",
                  }}>
                    {ctmcWord}
                  </div>

                ) : (
                  // ── Continuous flow: spreading word cloud ──
                  comp.map((w, slot) => {
                    const yTarget = ySpread[slot];
                    const y = yCenter + frame.spread * (yTarget - yCenter);
                    const pct = (1 - y) * 100;
                    const isCorrect = slot === 0;
                    const isArgmax = slot === frame.argmax;

                    let color, weight, size, alpha;
                    if (isArgmax && isCorrect)      { color = C.correct;   weight = 700; size = "clamp(13px,3.2vw,18px)"; alpha = 1; }
                    else if (isArgmax)               { color = C.white;     weight = 400; size = "clamp(13px,3.2vw,18px)"; alpha = 1; }
                    else if (isCorrect)              { color = C.correctDim;weight = 400; size = "clamp(11px,2.8vw,16px)"; alpha = 0.92; }
                    else                             { color = C.other[(slot-1) % C.other.length]; weight = 400; size = "clamp(11px,2.8vw,16px)"; alpha = 0.9; }

                    return (
                      <div key={slot} style={{
                        position: "absolute", top: `${pct}%`, left: "50%",
                        transform: "translate(-50%,-50%)",
                        color, fontWeight: weight, fontSize: size, opacity: alpha,
                        transition: "top 0.08s linear, opacity 0.15s, color 0.15s",
                        whiteSpace: "nowrap",
                      }}>
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
          <MetricPanel
            label={rhoLabel} color={C.rho} value={currentRho} maxY={1.05}
            curvePoints={curvePoints} metric="rho" tau={tau}
            snapThresholds={(isCandi || isMasked) ? maskThresholds : null}
            fillHeight={isDiscrete}
          />
          {!isDiscrete && (
            <MetricPanel
              label={rLabel} color={C.r} value={currentR} maxY={0.55}
              curvePoints={curvePoints} metric="r" tau={tau} dashAt={0.5}
              snapThresholds={isCandi ? maskThresholds : null}
            />
          )}
        </div>
      </div>

      {/* Denoising slider */}
      <div style={{ maxWidth: 1100, margin: "16px auto 0", padding: "0 4px" }}>
        <div style={{
          display: "flex", justifyContent: "space-between",
          fontSize: "clamp(9px,2vw,12px)", color: C.muted,
          marginBottom: 6, letterSpacing: "0.04em",
        }}>
          <span>noise (t = 1)</span>
          <span style={{ color: "#888", fontWeight: 600 }}>
            t = {t.toFixed(3)} &nbsp;·&nbsp; τ = {tau.toFixed(3)}
          </span>
          <span>clean (t = 0)</span>
        </div>
        <input type="range" min={0} max={1000} value={Math.round(tau * 1000)}
          onChange={handleTauChange}
          style={{ width: "100%", height: 40, appearance: "none", WebkitAppearance: "none", background: "transparent", cursor: "pointer", outline: "none" }}
          className="flow-slider"
        />
      </div>

      {/* Description */}
      <div style={{
        maxWidth: 1100, margin: "8px auto 0", textAlign: "center",
        fontSize: "clamp(9px,2vw,11px)", color: "#555",
        lineHeight: 1.5, letterSpacing: "0.02em",
      }}>
        {descMap[schedule]}
      </div>

      <style>{`
        .flow-slider::-webkit-slider-runnable-track { height:6px;border-radius:3px;background:linear-gradient(90deg,#1a1a3a 0%,rgba(126,232,250,0.25) 50%,#1a1a3a 100%); }
        .flow-slider::-webkit-slider-thumb { -webkit-appearance:none;width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#b0f0ff,#7ee8fa 60%,#3a8a9a);border:2px solid rgba(126,232,250,0.6);margin-top:-11px;box-shadow:0 0 12px rgba(126,232,250,0.4),0 2px 8px rgba(0,0,0,0.5);cursor:pointer; }
        .flow-slider::-moz-range-track { height:6px;border-radius:3px;background:linear-gradient(90deg,#1a1a3a 0%,rgba(126,232,250,0.25) 50%,#1a1a3a 100%);border:none; }
        .flow-slider::-moz-range-thumb { width:28px;height:28px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#b0f0ff,#7ee8fa 60%,#3a8a9a);border:2px solid rgba(126,232,250,0.6);box-shadow:0 0 12px rgba(126,232,250,0.4),0 2px 8px rgba(0,0,0,0.5);cursor:pointer; }
        .flow-slider:active::-webkit-slider-thumb { box-shadow:0 0 20px rgba(126,232,250,0.7),0 2px 8px rgba(0,0,0,0.5);transform:scale(1.1); }
        .vocab-slider::-webkit-slider-runnable-track { height:4px;border-radius:2px;background:linear-gradient(90deg,#1a1a3a 0%,rgba(126,232,250,0.15) 100%); }
        .vocab-slider::-webkit-slider-thumb { -webkit-appearance:none;width:20px;height:20px;border-radius:4px;background:linear-gradient(135deg,#7ee8fa,#3a8a9a);border:1px solid rgba(126,232,250,0.5);margin-top:-8px;box-shadow:0 0 8px rgba(126,232,250,0.3);cursor:pointer; }
        .vocab-slider::-moz-range-track { height:4px;border-radius:2px;background:linear-gradient(90deg,#1a1a3a 0%,rgba(126,232,250,0.15) 100%);border:none; }
        .vocab-slider::-moz-range-thumb { width:20px;height:20px;border-radius:4px;background:linear-gradient(135deg,#7ee8fa,#3a8a9a);border:1px solid rgba(126,232,250,0.5);box-shadow:0 0 8px rgba(126,232,250,0.3);cursor:pointer; }
      `}</style>
    </div>
  );
}

// ── Metric panel ──────────────────────────────────────────────────────────────

function MetricPanel({ label, color, value, maxY, curvePoints, metric, tau, dashAt, snapThresholds, fillHeight }) {
  const W = 200, H = 80;
  const pad = { t: 4, r: 4, b: 16, l: 4 };
  const cw = W - pad.l - pad.r;
  const ch = H - pad.t - pad.b;

  const toX = (tauVal) => pad.l + tauVal * cw;
  const toY = (val) => pad.t + ch - (val / maxY) * ch;

  const pathD = curvePoints.map((p, i) => {
    const x = toX(p.tau);
    const y = toY(metric === "rho" ? p.rho : p.r);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");

  const dotX = toX(tau);
  const dotY = toY(value);

  const fillPoints = curvePoints.filter((p) => p.tau <= tau + 0.005);
  let fillD = "";
  if (fillPoints.length > 1) {
    fillD = fillPoints.map((p, i) => {
      const x = toX(p.tau);
      const y = toY(metric === "rho" ? p.rho : p.r);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    const lastX = toX(fillPoints[fillPoints.length - 1].tau);
    fillD += ` L${lastX.toFixed(1)},${toY(0).toFixed(1)} L${pad.l},${toY(0).toFixed(1)} Z`;
  }

  return (
    <div style={{ background: "#0a0a18", borderRadius: 6, border: "1px solid #1a1a3a", padding: "6px 6px 2px", flex: 1, display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: "clamp(7px,1.6vw,9px)", color, fontWeight: 600, textAlign: "center", marginBottom: 2, letterSpacing: "0.04em" }}>
        {label}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", display: "block" }}>
        <line x1={pad.l} y1={toY(0)} x2={W - pad.r} y2={toY(0)} stroke="#222" strokeWidth="0.5" />
        {dashAt != null && (
          <line x1={pad.l} y1={toY(dashAt)} x2={W - pad.r} y2={toY(dashAt)} stroke="#444" strokeWidth="0.5" strokeDasharray="3,3" />
        )}
        {snapThresholds && snapThresholds.map((u, i) => (
          <line key={i} x1={toX(1 - u)} y1={pad.t} x2={toX(1 - u)} y2={H - pad.b}
            stroke="#333" strokeWidth="0.5" strokeDasharray="2,2" />
        ))}
        {fillD && <path d={fillD} fill={color} opacity={0.08} />}
        <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" opacity={0.5} />
        <circle cx={dotX} cy={dotY} r="4" fill={color} />
        <text x={W - pad.r - 2} y={pad.t + 12} textAnchor="end" fill={color} fontSize="9" fontFamily="inherit">
          {value.toFixed(3)}
        </text>
        <text x={pad.l} y={H - 2} fill="#555" fontSize="6" fontFamily="inherit">noise</text>
        <text x={W - pad.r} y={H - 2} textAnchor="end" fill="#555" fontSize="6" fontFamily="inherit">clean</text>
      </svg>
    </div>
  );
}