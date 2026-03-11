import { useState, useCallback, useMemo } from "react";

const BG       = "#0d0d1a";
const PANEL_BG = "#13132b";
const CARD_BG  = "#0a0a18";
const GRID     = "#1a1a3a";
const TEXT     = "#ffffff";
const DIM      = "#444466";
const MUTED    = "#555";
const ACCENT   = "#7ee8fa";
const FONT     = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const H_MIN    = 4.0;
const H_MAX    = 6.5;
const KL_MIN   = 0.4;
const KL_MAX   = 1.6;
const N_ROUNDS = 5;

// Per-contour warp: phase and amplitude vary with KL level
// amplitude decreases slightly at higher KL (more coherent = more systematic bias)
// phase shifts so contours oscillate out of sync with each other
// Monotone per contour: |A(kl) * FREQ| < 1 for each contour
const W_FREQ = 6.5;

function warpForKL(h, kl) {
  // Amplitude varies with kl — enough to be dramatic but monotone
  const amp   = 0.10 + 0.04 * Math.sin(kl * 2.3);   // varies ~0.06–0.14
  // Phase shifts per kl so contours are out of sync
  const phase = kl * 1.7 + 0.8;
  // Secondary term at different frequency for extra chaos
  const amp2  = 0.03 + 0.02 * Math.cos(kl * 3.1);
  const phase2 = kl * 2.9;
  return h
    + amp  * Math.sin(W_FREQ * h + phase)
    + amp2 * Math.sin(W_FREQ * 1.7 * h + phase2);
}

// Check monotonicity: deriv = 1 + amp*FREQ*cos(...) + amp2*FREQ*1.7*cos(...) > 0
// Worst case: 0.14*6.5 + 0.05*11.05 = 0.91 + 0.55 = 1.46 > 1 — too much
// Scale amps so max perturbation < 0.92:
// amp_max*6.5 + amp2_max*11.05 < 0.92
// 0.10*6.5=0.65, 0.04*6.5=0.26 => amp range 0.06–0.14 => max 0.14*6.5=0.91 — marginal
// Let's use amp max 0.09, amp2 max 0.03: 0.09*6.5 + 0.03*11.05 = 0.585+0.33=0.915 < 1 ✓
// Rescale:
function warpForKLSafe(h, kl) {
  const amp   = 0.07 + 0.02 * Math.sin(kl * 2.3);
  const phase = kl * 1.7 + 0.8;
  const amp2  = 0.02 + 0.01 * Math.cos(kl * 3.1);
  const phase2 = kl * 2.9;
  return h
    + amp  * Math.sin(W_FREQ * h + phase)
    + amp2 * Math.sin(W_FREQ * 1.7 * h + phase2);
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// Seeded pseudo-random (simple LCG) so rounds are reproducible per session
function makePRNG(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function generateRounds(seed) {
  const rng = makePRNG(seed);
  // Explicit layout per round: correctIsHigher
  // 2 rounds where correct is higher (top), 3 where correct is lower (bottom)
  const layouts = [true, true, false, false, false];
  // Shuffle layouts using rng
  for (let i = layouts.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [layouts[i], layouts[j]] = [layouts[j], layouts[i]];
  }

  const rounds = [];
  let attempts = 0;
  while (rounds.length < N_ROUNDS && attempts < 50000) {
    attempts++;
    const correctHigher = layouts[rounds.length];
    const delta = 0.08 + rng() * 0.10;

    const aIsBetter = rng() < 0.5;
    const klGood = KL_MIN + rng() * (KL_MAX - KL_MIN - delta);
    const klBad  = klGood + delta;
    const [klA, klB] = aIsBetter ? [klGood, klBad] : [klBad, klGood];

    const hGood   = H_MIN + 0.5 + rng() * (H_MAX - H_MIN - 1.0);
    const pplOffset = 0.15 + rng() * 0.35;
    const hxpGood = klGood + hGood;
    // correctHigher = correct has lower PPL = lower hxp
    const hxpBad  = correctHigher ? hxpGood + pplOffset : hxpGood - pplOffset;
    const hBad    = hxpBad - klBad;
    if (hBad < H_MIN || hBad > H_MAX) continue;
    if (klA < KL_MIN || klA > KL_MAX) continue;
    if (klB < KL_MIN || klB > KL_MAX) continue;

    const wxGood = warpForKLSafe(hGood, klGood);
    const wxBad  = warpForKLSafe(hBad, klBad);
    if (Math.abs(wxGood - wxBad) < 0.15) continue;

    const [hA, hB, hxpA, hxpB] = aIsBetter
      ? [hGood, hBad, hxpGood, hxpBad]
      : [hBad, hGood, hxpBad, hxpGood];

    rounds.push({ hA, klA, hxpA, hB, klB, hxpB });
  }
  return rounds;
}

// ─── Chart ────────────────────────────────────────────────────────────────────
const KL_CONTOUR_LEVELS = [0.5, 0.75, 1.0, 1.25, 1.5];
const KL_CONTOUR_COLORS = ["#3dd68c","#a8e063","#e8d44d","#f0a830","#e05060"];

function GameChart({ round, onPick, result, showContours = false }) {
  const W = 560, H = 340;
  const PL = 68, PR = 20, PT = 20, PB = 48;
  const pw = W - PL - PR, ph = H - PT - PB;

  // Each point warps according to its own KL level
  const warpedA = warpForKLSafe(round.hA, round.klA);
  const warpedB = warpForKLSafe(round.hB, round.klB);

  // X range: span of all possible warped values across both points
  const allWarped = [];
  for (let i = 0; i <= 100; i++) {
    const h = H_MIN + (i / 100) * (H_MAX - H_MIN);
    allWarped.push(warpForKLSafe(h, round.klA));
    allWarped.push(warpForKLSafe(h, round.klB));
  }
  const wMin = Math.min(...allWarped), wMax = Math.max(...allWarped);

  const toX = useCallback((warpedH) =>
    PL + ((warpedH - wMin) / (wMax - wMin)) * pw,
    [wMin, wMax, pw]
  );

  // PPL range: fit both points with padding
  const pplA   = Math.exp(round.hxpA);
  const pplB   = Math.exp(round.hxpB);
  const pplLo  = Math.min(pplA, pplB);
  const pplHi  = Math.max(pplA, pplB);
  const pad    = (pplHi - pplLo) * 0.6 + 20;
  const pplMin = Math.max(1, pplLo - pad);
  const pplMax = pplHi + pad;

  // Linear Y, low PPL at top (better)
  const toY = useCallback((hxp) => {
    const ppl = Math.exp(hxp);
    return PT + ((clamp(ppl, pplMin, pplMax) - pplMin) / (pplMax - pplMin)) * ph;
  }, [ph, pplMin, pplMax]);

  const sA = { x: toX(warpedA), y: toY(round.hxpA) };
  const sB = { x: toX(warpedB), y: toY(round.hxpB) };

  // Grid ticks
  const xTicks = [4.0, 4.5, 5.0, 5.5, 6.0, 6.5];
  const pplRange = pplMax - pplMin;
  const rawStep = pplRange / 4;
  const mag  = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const step = [1,2,2.5,5,10].map(s => s * mag).find(s => s >= rawStep) ?? mag * 10;
  const yTickStart = Math.ceil(pplMin / step) * step;
  const yTicks = [];
  for (let t = yTickStart; t <= pplMax + 1e-6; t += step) yTicks.push(Math.round(t));

  const COLORS = { A: "#7ee8fa", B: "#e879f9" };
  const correctAnswer = round.klA < round.klB ? "A" : "B";

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: "block", overflow: "visible" }}>
      {/* Grid */}
      {xTicks.map(t => (
        <line key={t} x1={toX(t)} y1={PT} x2={toX(t)} y2={PT + ph}
          stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
      ))}
      {yTicks.map(v => (
        <line key={v} x1={PL} y1={toY(Math.log(v))} x2={PL + pw} y2={toY(Math.log(v))}
          stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
      ))}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT + ph} stroke={GRID} strokeWidth={1.2} />
      <line x1={PL} y1={PT + ph} x2={PL + pw} y2={PT + ph} stroke={GRID} strokeWidth={1.2} />

      {/* Better annotation */}
      <text x={PL + 6} y={PT + 14} fill={DIM} fontSize={9} fontFamily={FONT} opacity={0.5}>↑ better</text>

      {/* Y ticks */}
      {yTicks.map(v => (
        <text key={v} x={PL - 8} y={toY(Math.log(v)) + 4} textAnchor="end"
          fill={DIM} fontSize={9} fontFamily={FONT}>{v}</text>
      ))}
      {/* X ticks */}
      {xTicks.map(t => (
        <text key={t} x={toX(t)} y={PT + ph + 16} textAnchor="middle"
          fill={DIM} fontSize={9.5} fontFamily={FONT}>{t.toFixed(1)}</text>
      ))}

      {/* Axis labels */}
      <text x={PL + pw / 2} y={H - 6} textAnchor="middle"
        fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}>
        Entropy H̃(q)  (warped)
      </text>
      <text x={14} y={PT + ph / 2} textAnchor="middle"
        fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}
        transform={`rotate(-90, 14, ${PT + ph / 2})`}>
        Gen Perplexity (linear)
      </text>

      {/* KL contours — only shown on results screen */}
      {showContours && KL_CONTOUR_LEVELS.map((kl, ci) => {
        const N = 200;
        const pts = [];
        for (let i = 0; i <= N; i++) {
          const h   = H_MIN + (i / N) * (H_MAX - H_MIN);
          const hxp = kl + h;
          const ppl = Math.exp(hxp);
          if (ppl < pplMin * 0.9 || ppl > pplMax * 1.1) continue;
          const wx  = toX(warpForKLSafe(h, kl));
          const wy  = toY(hxp);
          pts.push(`${pts.length === 0 ? "M" : "L"}${wx.toFixed(2)},${wy.toFixed(2)}`);
        }
        if (pts.length < 2) return null;
        const labelIdx = Math.floor(pts.length * 0.15);
        const lPt = (() => {
          const h   = H_MIN + (labelIdx / N) * (H_MAX - H_MIN);
          return { x: toX(warpForKLSafe(h, kl)), y: toY(kl + h) };
        })();
        return (
          <g key={kl}>
            <path d={pts.join(" ")} fill="none"
              stroke={KL_CONTOUR_COLORS[ci]} strokeWidth={1.4} opacity={0.55} />
            <rect x={lPt.x + 3} y={lPt.y - 9} width={38} height={13} rx={3}
              fill={BG} opacity={0.85} />
            <text x={lPt.x + 6} y={lPt.y + 1}
              fill={KL_CONTOUR_COLORS[ci]} fontSize={9} fontFamily={FONT} fontWeight={700}>
              KL={kl.toFixed(2)}
            </text>
          </g>
        );
      })}

      {/* Points */}
      {[{ key: "A", s: sA, col: COLORS.A }, { key: "B", s: sB, col: COLORS.B }].map(({ key, s, col }) => {
        const isCorrect = result && key === correctAnswer;
        const isWrong   = result && result === key && key !== correctAnswer;
        const isChosen  = result === key;
        return (
          <g key={key}>
            {/* Reveal ring after answer */}
            {result && (
              <circle cx={s.x} cy={s.y} r={22}
                fill="none"
                stroke={isCorrect ? "#3dd68c" : "#e05060"}
                strokeWidth={2} opacity={0.6} />
            )}
            <circle cx={s.x} cy={s.y} r={16} fill={col} opacity={0.12} />
            <circle cx={s.x} cy={s.y} r={10} fill={col} stroke={BG} strokeWidth={2}
              style={{ filter: isChosen ? `drop-shadow(0 0 6px ${col})` : "none" }} />
            <text x={s.x} y={s.y + 5} textAnchor="middle"
              fill="#fff" fontSize={11} fontFamily={FONT} fontWeight={700}>{key}</text>
            {/* Show true KL after answer */}
            {result && (
              <g>
                <rect x={s.x - 28} y={s.y + 14} width={56} height={15} rx={4}
                  fill={PANEL_BG} stroke={isCorrect ? "#3dd68c" : "#e05060"} strokeWidth={0.8} opacity={0.95} />
                <text x={s.x} y={s.y + 25} textAnchor="middle"
                  fill={isCorrect ? "#3dd68c" : "#e05060"} fontSize={9} fontFamily={FONT} fontWeight={700}>
                  KL={(key === "A" ? round.klA : round.klB).toFixed(3)}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function KLMinigame() {
  const [seed]    = useState(() => Math.floor(Math.random() * 1e9));
  const rounds    = useMemo(() => generateRounds(seed), [seed]);

  const [current,  setCurrent]  = useState(0);
  const [answers,  setAnswers]  = useState([]);  // "A" | "B" per round
  const [revealed, setRevealed] = useState(false);
  const [done,     setDone]     = useState(false);

  const round = rounds[current];
  const correctAnswer = round.klA < round.klB ? "A" : "B";

  const pick = useCallback((choice) => {
    if (revealed) return;
    setRevealed(true);
    setAnswers(prev => [...prev, choice]);
  }, [revealed]);

  const next = useCallback(() => {
    if (current + 1 >= N_ROUNDS) {
      setDone(true);
    } else {
      setCurrent(c => c + 1);
      setRevealed(false);
    }
  }, [current]);

  const restart = useCallback(() => {
    setCurrent(0);
    setAnswers([]);
    setRevealed(false);
    setDone(false);
  }, []);

  const score = answers.filter((a, i) => (rounds[i].klA < rounds[i].klB ? "A" : "B") === a).length;
  const pct = done ? Math.round((score / N_ROUNDS) * 100) : null;
  const resultColor = pct !== null ? (pct >= 70 ? "#3dd68c" : pct >= 50 ? "#e8d44d" : "#e05060") : ACCENT;

  const [expandedRound, setExpandedRound] = useState(0);

  if (done) {
    const r = rounds[expandedRound];
    const correct = (r.klA < r.klB ? "A" : "B") === answers[expandedRound];

    return (
      <div style={{ background: BG, color: TEXT, fontFamily: FONT, padding: "24px 20px 28px" }}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{
            fontSize: 20, fontWeight: 700, marginBottom: 8,
            background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>Results</div>
          <div style={{ fontSize: 56, fontWeight: 700, color: resultColor, fontFamily: FONT, marginBottom: 4, textShadow: `0 0 40px ${resultColor}44` }}>
            {score}/{N_ROUNDS}
          </div>
          <div style={{ fontSize: 13, color: resultColor, fontWeight: 700, marginBottom: 20 }}>
            {pct}% accuracy · random chance = 50%
          </div>
        </div>

        {/* Clickable round dots */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", marginBottom: 16 }}>
          {answers.map((a, i) => {
            const c = (rounds[i].klA < rounds[i].klB ? "A" : "B") === a;
            const active = expandedRound === i;
            return (
              <div key={i} onClick={() => setExpandedRound(i)} style={{
                width: 44, height: 44, borderRadius: 8,
                background: active
                  ? (c ? "#3dd68c44" : "#e0506044")
                  : (c ? "#3dd68c18" : "#e0506018"),
                border: `2px solid ${active
                  ? (c ? "#3dd68c" : "#e05060")
                  : (c ? "#3dd68c55" : "#e0506055")}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                color: c ? "#3dd68c" : "#e05060",
                cursor: "pointer",
                transition: "all 150ms ease",
                boxShadow: active ? `0 0 12px ${c ? "#3dd68c44" : "#e0506044"}` : "none",
              }}>{i + 1}</div>
            );
          })}
        </div>

        {/* Single chart swapping in place */}
        <div style={{
          background: CARD_BG, borderRadius: 8,
          border: `1px solid ${correct ? "#3dd68c33" : "#e0506033"}`,
          borderLeft: `3px solid ${correct ? "#3dd68c" : "#e05060"}`,
          padding: "10px 12px 6px", marginBottom: 16,
        }}>
          <div style={{ fontSize: 9, color: DIM, fontFamily: FONT, letterSpacing: "0.08em", marginBottom: 4 }}>
            ROUND {expandedRound + 1} · picked <span style={{ color: TEXT, fontWeight: 700 }}>{answers[expandedRound]}</span>
            {" · "}correct: <span style={{ color: correct ? "#3dd68c" : "#e05060", fontWeight: 700 }}>{r.klA < r.klB ? "A" : "B"}</span>
            {" · "}KL(A)=<span style={{ color: "#7ee8fa", fontWeight: 700 }}>{r.klA.toFixed(3)}</span>
            {" "}KL(B)=<span style={{ color: "#e879f9", fontWeight: 700 }}>{r.klB.toFixed(3)}</span>
          </div>
          <GameChart round={r} onPick={() => {}} result={answers[expandedRound]} showContours={true} />
        </div>

        <div style={{ textAlign: "center" }}>
          <button onClick={restart} style={{
            background: ACCENT + "18", border: `1px solid ${ACCENT}66`,
            borderRadius: 8, color: ACCENT, fontFamily: FONT,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.08em",
            textTransform: "uppercase", padding: "10px 28px", cursor: "pointer",
          }}>Play Again</button>
        </div>
      </div>
    );
  }

  const isCorrect = revealed && answers[answers.length - 1] === correctAnswer;

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: FONT, padding: "20px 20px 24px", userSelect: "none" }}>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 16 }}>
        <div style={{
          fontSize: 18, fontWeight: 700, letterSpacing: "0.02em", marginBottom: 4,
          background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
        }}>
          Which point has lower KL divergence?
        </div>
        <div style={{ fontSize: 11, color: TEXT }}>
        Each round shows two models — one achieves better perplexity, the other achieves better entropy. Which is actually closer to the target distribution?        </div>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5, fontSize: 9, color: DIM, fontFamily: FONT, letterSpacing: "0.08em" }}>
          <span>ROUND {current + 1} / {N_ROUNDS}</span>
          <span>{score} CORRECT SO FAR</span>
        </div>
        <div style={{ height: 4, background: GRID, borderRadius: 2, overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 2,
            width: `${((current) / N_ROUNDS) * 100}%`,
            background: `linear-gradient(90deg, ${ACCENT}, #e879f9)`,
            transition: "width 300ms ease",
          }} />
        </div>
        {/* Mini score dots */}
        <div style={{ display: "flex", gap: 3, marginTop: 6, flexWrap: "wrap" }}>
          {Array.from({ length: N_ROUNDS }).map((_, i) => {
            const answered = i < answers.length;
            const correct  = answered && (rounds[i].klA < rounds[i].klB ? "A" : "B") === answers[i];
            return (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: 2,
                background: answered
                  ? (correct ? "#3dd68c" : "#e05060")
                  : (i === current ? ACCENT + "66" : GRID),
                transition: "background 200ms ease",
              }} />
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div style={{ background: CARD_BG, borderRadius: 8, border: `1px solid ${GRID}`, padding: "12px 10px 6px", marginBottom: 12 }}>
        <GameChart round={round} onPick={pick} result={revealed ? answers[answers.length - 1] : null} />
      </div>

      {/* Pick buttons or result + next */}
      {!revealed ? (
        <div style={{ display: "flex", gap: 10 }}>
          {["A", "B"].map(key => (
            <button key={key} onClick={() => pick(key)} style={{
              flex: 1, padding: "14px 0",
              background: (key === "A" ? "#7ee8fa" : "#e879f9") + "18",
              border: `1px solid ${(key === "A" ? "#7ee8fa" : "#e879f9")}55`,
              borderRadius: 8,
              color: key === "A" ? "#7ee8fa" : "#e879f9",
              fontFamily: FONT, fontSize: 16, fontWeight: 700,
              cursor: "pointer", transition: "all 150ms ease",
              letterSpacing: "0.1em",
            }}>
              {key}
            </button>
          ))}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{
            background: CARD_BG,
            border: `1px solid ${isCorrect ? "#3dd68c44" : "#e0506044"}`,
            borderLeft: `3px solid ${isCorrect ? "#3dd68c" : "#e05060"}`,
            borderRadius: 6, padding: "10px 14px",
            fontSize: 11, color: MUTED, lineHeight: 1.7,
          }}>
            <span style={{ color: isCorrect ? "#3dd68c" : "#e05060", fontWeight: 700 }}>
              {isCorrect ? "✓ Correct" : "✗ Wrong"}
            </span>
            {"  —  "}
            KL(A) = <span style={{ color: "#7ee8fa", fontWeight: 700 }}>{round.klA.toFixed(3)}</span>
            {"  "}
            KL(B) = <span style={{ color: "#e879f9", fontWeight: 700 }}>{round.klB.toFixed(3)}</span>
            {"  ·  lower KL = "}
            <span style={{ color: correctAnswer === "A" ? "#7ee8fa" : "#e879f9", fontWeight: 700 }}>
              {correctAnswer}
            </span>
          </div>
          <button onClick={next} style={{
            padding: "12px 0",
            background: ACCENT + "18",
            border: `1px solid ${ACCENT}55`,
            borderRadius: 8, color: ACCENT,
            fontFamily: FONT, fontSize: 11, fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            cursor: "pointer",
          }}>
            {current + 1 < N_ROUNDS ? "Next →" : "See Results"}
          </button>
        </div>
      )}
    </div>
  );
}