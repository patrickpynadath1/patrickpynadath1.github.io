import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  DATA SOURCE TOGGLE                                                        ║
// ║  Uncomment ONE of the two blocks below, and comment out the other.         ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

// ── Option A: Load from JSON files ────────────────────────────────────────────
// import candiData    from "../data/candi_metadata.json";
// import mdlmData     from "../data/mdlm_metadata.json";
// import duoData      from "../data/duo_ancestral.json";
import owtEntropies from "../data/owt_entropies.json";

// ── Option B: Hardcoded data (uncomment this block, comment out Option A) ─────
// import { CANDI_DATA as candiData, MDLM_DATA as mdlmData, DUO_DATA as duoData, OWT_ENTROPIES as owtEntropies } from "./hardcoded_data";
// ──────────────────────────────────────────────────────────────────────────────
const mdlmData = {
  8: { 1.0:{perplexity:886.005,entropy:5.8936}, 0.975:{perplexity:613.797,entropy:5.7557}, 0.95:{perplexity:432.278,entropy:5.6291}, 0.925:{perplexity:297.693,entropy:5.4855}, 0.9:{perplexity:226.065,entropy:5.3423}, 0.875:{perplexity:169.670,entropy:5.1971}, 0.85:{perplexity:128.816,entropy:5.0267}, 0.825:{perplexity:97.956,entropy:4.8156}, 0.8:{perplexity:73.795,entropy:4.5755}, 0.775:{perplexity:57.650,entropy:4.2969}, 0.75:{perplexity:43.828,entropy:4.0084}, 0.725:{perplexity:32.880,entropy:3.7040}, 0.7:{perplexity:25.907,entropy:3.4260}, 0.675:{perplexity:19.571,entropy:3.1478}, 0.65:{perplexity:16.026,entropy:2.8926}, 0.625:{perplexity:12.985,entropy:2.6824}, 0.6:{perplexity:11.313,entropy:2.4766} },
  16: { 1.0:{perplexity:332.830,entropy:5.7860}, 0.975:{perplexity:247.658,entropy:5.6902}, 0.95:{perplexity:188.441,entropy:5.5892}, 0.925:{perplexity:141.848,entropy:5.4944}, 0.9:{perplexity:109.391,entropy:5.3790}, 0.875:{perplexity:84.466,entropy:5.2543}, 0.85:{perplexity:65.627,entropy:5.1375}, 0.825:{perplexity:52.824,entropy:4.9681}, 0.8:{perplexity:42.259,entropy:4.8179}, 0.775:{perplexity:34.045,entropy:4.5723}, 0.75:{perplexity:27.330,entropy:4.3635}, 0.725:{perplexity:21.598,entropy:4.1030}, 0.7:{perplexity:16.999,entropy:3.7455}, 0.675:{perplexity:13.596,entropy:3.4699}, 0.65:{perplexity:10.712,entropy:3.1330}, 0.625:{perplexity:8.749,entropy:2.8654}, 0.6:{perplexity:7.251,entropy:2.5664} },
  32: { 1.0:{perplexity:193.377,entropy:5.7346}, 0.975:{perplexity:147.290,entropy:5.6467}, 0.95:{perplexity:114.460,entropy:5.5593}, 0.925:{perplexity:86.690,entropy:5.4571}, 0.9:{perplexity:69.847,entropy:5.3788}, 0.875:{perplexity:54.850,entropy:5.2670}, 0.85:{perplexity:43.253,entropy:5.1570}, 0.825:{perplexity:35.104,entropy:5.0259}, 0.8:{perplexity:28.792,entropy:4.8906}, 0.775:{perplexity:23.610,entropy:4.6847}, 0.75:{perplexity:19.715,entropy:4.5138}, 0.725:{perplexity:15.455,entropy:4.2259}, 0.7:{perplexity:12.882,entropy:3.9756}, 0.675:{perplexity:10.181,entropy:3.6480}, 0.65:{perplexity:8.061,entropy:3.2831}, 0.625:{perplexity:6.842,entropy:3.0213}, 0.6:{perplexity:5.546,entropy:2.7052} },
  64: { 1.0:{perplexity:140.169,entropy:5.6892}, 0.975:{perplexity:106.731,entropy:5.6012}, 0.95:{perplexity:82.088,entropy:5.5118}, 0.925:{perplexity:64.159,entropy:5.4232}, 0.9:{perplexity:49.980,entropy:5.3242}, 0.875:{perplexity:41.443,entropy:5.2323}, 0.85:{perplexity:32.845,entropy:5.1174}, 0.825:{perplexity:27.605,entropy:5.0126}, 0.8:{perplexity:22.618,entropy:4.8704}, 0.775:{perplexity:19.061,entropy:4.7108}, 0.75:{perplexity:15.974,entropy:4.5605}, 0.725:{perplexity:13.001,entropy:4.3366}, 0.7:{perplexity:10.416,entropy:4.0275}, 0.675:{perplexity:8.442,entropy:3.7450}, 0.65:{perplexity:7.048,entropy:3.4726}, 0.625:{perplexity:5.725,entropy:3.1579}, 0.6:{perplexity:4.740,entropy:2.7529} },
  128: { 1.0:{perplexity:123.691,entropy:5.6745}, 0.975:{perplexity:97.505,entropy:5.5923}, 0.95:{perplexity:73.754,entropy:5.4995}, 0.925:{perplexity:57.919,entropy:5.4183}, 0.9:{perplexity:46.111,entropy:5.3267}, 0.875:{perplexity:36.421,entropy:5.2179}, 0.85:{perplexity:29.913,entropy:5.1291}, 0.825:{perplexity:24.340,entropy:5.0045}, 0.8:{perplexity:19.790,entropy:4.8464} },
};

const duoData = {
  8: { 1.0:{perplexity:191.157,entropy:5.5728}, 0.975:{perplexity:147.756,entropy:5.4599}, 0.95:{perplexity:118.450,entropy:5.3498}, 0.925:{perplexity:96.411,entropy:5.2344}, 0.9:{perplexity:80.606,entropy:5.0662}, 0.875:{perplexity:67.894,entropy:4.8764}, 0.85:{perplexity:58.652,entropy:4.6618}, 0.825:{perplexity:46.926,entropy:4.3483}, 0.8:{perplexity:34.499,entropy:3.9184}, 0.775:{perplexity:24.469,entropy:3.4915}, 0.75:{perplexity:16.921,entropy:3.0229}, 0.725:{perplexity:11.231,entropy:2.5751}, 0.7:{perplexity:8.742,entropy:2.3029} },
  16: { 1.0:{perplexity:119.309,entropy:5.5816}, 0.975:{perplexity:94.608,entropy:5.5026}, 0.95:{perplexity:75.760,entropy:5.4129}, 0.925:{perplexity:64.481,entropy:5.3182}, 0.9:{perplexity:55.805,entropy:5.2304}, 0.875:{perplexity:49.500,entropy:5.1067}, 0.85:{perplexity:41.736,entropy:4.9096}, 0.825:{perplexity:35.122,entropy:4.6791}, 0.8:{perplexity:28.583,entropy:4.3821}, 0.775:{perplexity:22.670,entropy:4.0327}, 0.75:{perplexity:16.763,entropy:3.5743}, 0.725:{perplexity:12.175,entropy:3.1413}, 0.7:{perplexity:8.739,entropy:2.6681} },
  32: { 1.0:{perplexity:95.439,entropy:5.5588}, 0.975:{perplexity:75.330,entropy:5.4845}, 0.95:{perplexity:60.711,entropy:5.4046}, 0.925:{perplexity:53.337,entropy:5.3490}, 0.9:{perplexity:46.036,entropy:5.2523}, 0.875:{perplexity:40.999,entropy:5.1536}, 0.85:{perplexity:35.866,entropy:4.9907}, 0.825:{perplexity:31.222,entropy:4.8089}, 0.8:{perplexity:26.303,entropy:4.5181}, 0.775:{perplexity:21.322,entropy:4.1534}, 0.75:{perplexity:16.086,entropy:3.7754}, 0.725:{perplexity:12.229,entropy:3.3527}, 0.7:{perplexity:9.611,entropy:2.9669} },
  64: { 1.0:{perplexity:87.020,entropy:5.5705}, 0.975:{perplexity:72.779,entropy:5.5045}, 0.95:{perplexity:59.532,entropy:5.4318}, 0.925:{perplexity:52.235,entropy:5.3634}, 0.9:{perplexity:44.846,entropy:5.2809}, 0.875:{perplexity:38.585,entropy:5.1534}, 0.85:{perplexity:33.652,entropy:4.9577}, 0.825:{perplexity:28.841,entropy:4.7592}, 0.8:{perplexity:24.047,entropy:4.4924}, 0.775:{perplexity:19.227,entropy:4.1695}, 0.75:{perplexity:14.499,entropy:3.7163}, 0.725:{perplexity:12.599,entropy:3.3122}, 0.7:{perplexity:9.240,entropy:2.9110} },
  128: { 1.0:{perplexity:78.489,entropy:5.5341}, 0.975:{perplexity:62.759,entropy:5.4583}, 0.95:{perplexity:53.505,entropy:5.4138}, 0.925:{perplexity:45.937,entropy:5.3384}, 0.9:{perplexity:40.667,entropy:5.2764}, 0.875:{perplexity:36.737,entropy:5.2009}, 0.85:{perplexity:32.491,entropy:5.0830}, 0.825:{perplexity:28.456,entropy:4.9131}, 0.8:{perplexity:25.250,entropy:4.6676} },
};

const candiData = {
  8: { 1.0:{perplexity:752.164,entropy:5.9813}, 0.975:{perplexity:535.763,entropy:5.8697}, 0.95:{perplexity:395.563,entropy:5.7528}, 0.925:{perplexity:290.354,entropy:5.6285}, 0.9:{perplexity:213.906,entropy:5.5001}, 0.875:{perplexity:161.410,entropy:5.3809}, 0.85:{perplexity:122.869,entropy:5.2455}, 0.825:{perplexity:95.438,entropy:5.1063}, 0.8:{perplexity:76.353,entropy:4.9560}, 0.775:{perplexity:60.131,entropy:4.8136}, 0.75:{perplexity:49.362,entropy:4.6607}, 0.725:{perplexity:41.830,entropy:4.5037}, 0.7:{perplexity:34.913,entropy:4.3512} },
  16: { 1.0:{perplexity:392.146,entropy:5.9193}, 0.975:{perplexity:283.037,entropy:5.8223}, 0.95:{perplexity:210.890,entropy:5.7201}, 0.925:{perplexity:158.797,entropy:5.6158}, 0.9:{perplexity:124.796,entropy:5.5182}, 0.875:{perplexity:97.111,entropy:5.4235}, 0.85:{perplexity:75.930,entropy:5.3139}, 0.825:{perplexity:61.345,entropy:5.2002}, 0.8:{perplexity:49.047,entropy:5.0868}, 0.775:{perplexity:40.709,entropy:4.9656}, 0.75:{perplexity:33.670,entropy:4.8295}, 0.725:{perplexity:28.475,entropy:4.6760}, 0.7:{perplexity:24.317,entropy:4.5383} },
  32: { 1.0:{perplexity:241.899,entropy:5.8481}, 0.975:{perplexity:177.855,entropy:5.7479}, 0.95:{perplexity:134.748,entropy:5.6475}, 0.925:{perplexity:101.851,entropy:5.5511}, 0.9:{perplexity:80.178,entropy:5.4561}, 0.875:{perplexity:64.893,entropy:5.3669}, 0.85:{perplexity:51.228,entropy:5.2642}, 0.825:{perplexity:40.782,entropy:5.1573}, 0.8:{perplexity:34.220,entropy:5.0533}, 0.775:{perplexity:29.028,entropy:4.9576}, 0.75:{perplexity:24.708,entropy:4.8403}, 0.725:{perplexity:21.193,entropy:4.7136}, 0.7:{perplexity:18.686,entropy:4.6094} },
  64: { 1.0:{perplexity:188.653,entropy:5.7946}, 0.975:{perplexity:136.978,entropy:5.6993}, 0.95:{perplexity:106.965,entropy:5.6085}, 0.925:{perplexity:82.217,entropy:5.5175}, 0.9:{perplexity:65.611,entropy:5.4215}, 0.875:{perplexity:52.276,entropy:5.3183}, 0.85:{perplexity:42.690,entropy:5.2073}, 0.825:{perplexity:34.927,entropy:5.1311}, 0.8:{perplexity:28.767,entropy:5.0244}, 0.775:{perplexity:24.529,entropy:4.9202}, 0.75:{perplexity:21.057,entropy:4.8167}, 0.725:{perplexity:18.738,entropy:4.7430}, 0.7:{perplexity:16.586,entropy:4.6541} },
  128: { 1.0:{perplexity:165.208,entropy:5.7795}, 0.975:{perplexity:123.955,entropy:5.6874}, 0.95:{perplexity:95.637,entropy:5.5865}, 0.925:{perplexity:74.565,entropy:5.4863}, 0.9:{perplexity:58.445,entropy:5.3715}, 0.875:{perplexity:45.313,entropy:5.2545}, 0.85:{perplexity:37.702,entropy:5.1474}, 0.825:{perplexity:29.864,entropy:5.0574}, 0.8:{perplexity:25.669,entropy:4.9729}, 0.775:{perplexity:21.830,entropy:4.8778}, 0.75:{perplexity:18.762,entropy:4.7731}, 0.725:{perplexity:16.371,entropy:4.6637}, 0.7:{perplexity:14.322,entropy:4.5361} },
};

// ─── Theme (Flow Matching dark space) ─────────────────────────────────────────
const BG       = "#0d0d1a";
const PANEL_BG = "#13132b";
const CARD_BG  = "#0a0a18";
const GRID     = "#1a1a3a";
const TEXT     = "#ffffff";
const DIM      = "#444466";
const MUTED    = "#555";
const ACCENT   = "#7ee8fa";   // signature cyan — cursor / highlight
const FONT     = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const METHODS = [
  { key: "candi", label: "CANDI", color: "#57c27c", data: candiData },
  { key: "mdlm",  label: "MDLM",  color: "#5b9bd5", data: mdlmData },
  { key: "duo",   label: "DUO",   color: "#e05c5c", data: duoData  },
];

const MAX_NFE = 128;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function gaussianKDE(values, bw, xs) {
  return xs.map(x =>
    values.reduce((s, v) => s + Math.exp(-0.5 * ((x - v) / bw) ** 2), 0) /
    (values.length * bw * Math.sqrt(2 * Math.PI))
  );
}

function niceTicks(min, max, n = 5) {
  const range = max - min;
  const raw = range / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * mag).find(s => s >= raw) ?? mag * 10;
  const start = Math.ceil(min / step) * step;
  const ticks = [];
  for (let t = start; t <= max + 1e-9; t += step) ticks.push(parseFloat(t.toFixed(10)));
  return ticks;
}

function quantile(vals, q) {
  const s = [...vals].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const base = Math.floor(pos);
  return s[base + 1] !== undefined ? s[base] + (pos - base) * (s[base + 1] - s[base]) : s[base];
}

function interpAtEntropy(nfeData, targetEntropy) {
  if (!nfeData) return null;
  const pts = Object.values(nfeData)
    .map(e => ({ entropy: e.entropy, perplexity: e.perplexity }))
    .sort((a, b) => a.entropy - b.entropy);
  if (pts.length < 2) return null;
  if (targetEntropy < pts[0].entropy || targetEntropy > pts[pts.length - 1].entropy) return null;
  for (let i = 1; i < pts.length; i++) {
    if (pts[i].entropy >= targetEntropy) {
      const lo = pts[i - 1], hi = pts[i];
      const span = hi.entropy - lo.entropy;
      const t = span === 0 ? 0 : (targetEntropy - lo.entropy) / span;
      return lo.perplexity + t * (hi.perplexity - lo.perplexity);
    }
  }
  return null;
}

// Precompute KDE from real OWT data (same as original)
const owtVals = owtEntropies.eval_entropy_values ?? owtEntropies;
const KDE_N = 400;
const q01 = quantile(owtVals, 0.01), q99 = quantile(owtVals, 0.99);
const spread = Math.max(1e-6, q99 - q01);
const KDE_LO = q01 - spread * 0.08, KDE_HI = q99 + spread * 0.08;
const kdeXs = Array.from({ length: KDE_N }, (_, i) => KDE_LO + (i / (KDE_N - 1)) * (KDE_HI - KDE_LO));
const kdeYs = gaussianKDE(owtVals, spread * 0.03, kdeXs);
const kdeYMax = Math.max(...kdeYs);

const defaultEntropy = owtVals.reduce((a, b) => a + b, 0) / owtVals.length;

// ─── Valid range: where at least ONE method has all its NFEs interpolable ─────
function computeValidRange() {
  let unionLo = Infinity, unionHi = -Infinity;
  for (const m of METHODS) {
    let mLo = -Infinity, mHi = Infinity;
    const nfes = Object.keys(m.data).map(Number).filter(n => n <= MAX_NFE);
    for (const nfe of nfes) {
      const pts = Object.values(m.data[nfe] ?? {})
        .map(e => e.entropy)
        .sort((a, b) => a - b);
      if (pts.length < 2) { mLo = Infinity; mHi = -Infinity; break; }
      mLo = Math.max(mLo, pts[0]);
      mHi = Math.min(mHi, pts[pts.length - 1]);
    }
    if (mLo < mHi) {
      unionLo = Math.min(unionLo, mLo);
      unionHi = Math.max(unionHi, mHi);
    }
  }
  return unionLo < unionHi ? [unionLo, unionHi] : [0, 0];
}
const [VALID_LO, VALID_HI] = computeValidRange();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Slider Rail (above KDE) ──────────────────────────────────────────────────
function SliderRail({ entropy, onChange }) {
  const railRef = useRef(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const fraction = (entropy - VALID_LO) / (VALID_HI - VALID_LO);

  const getEntropyFromPointer = useCallback((clientX) => {
    const rect = railRef.current.getBoundingClientRect();
    const t = clamp((clientX - rect.left) / rect.width, 0, 1);
    return VALID_LO + t * (VALID_HI - VALID_LO);
  }, []);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      onChange(getEntropyFromPointer(cx));
    };
    const onUp = () => {
      dragging.current = false;
      setIsDragging(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [onChange, getEntropyFromPointer]);

  const handleDown = useCallback((e) => {
    e.preventDefault();
    dragging.current = true;
    setIsDragging(true);
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    onChange(getEntropyFromPointer(cx));
  }, [onChange, getEntropyFromPointer]);

  return (
    <div
      style={{
        width: "100%",
        paddingTop: 6,
        paddingBottom: 8,
        cursor: "pointer",
        touchAction: "none",
      }}
    >
      {/* Value readout centered above thumb */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 8,
        padding: "0 2px",
      }}>
        <div style={{
          fontSize: "clamp(8px, 1.8vw, 10px)",
          color: DIM,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          Target Sample Entropy
        </div>
        <div style={{
          fontSize: "clamp(12px, 2.8vw, 15px)",
          fontWeight: 700,
          color: ACCENT,
          fontFamily: FONT,
          letterSpacing: "0.04em",
          transition: "transform 120ms ease",
          transform: isDragging ? "scale(1.08)" : "scale(1)",
        }}>
          H = {entropy.toFixed(3)}
        </div>
      </div>

      {/* Rail container — enlarged touch target */}
      <div
        ref={railRef}
        onMouseDown={handleDown}
        onTouchStart={handleDown}
        style={{
          position: "relative",
          width: "100%",
          height: 36,
          display: "flex",
          alignItems: "center",
          cursor: "ew-resize",
        }}
      >
        {/* Track background */}
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          top: "50%",
          transform: "translateY(-50%)",
          height: 4,
          borderRadius: 2,
          background: GRID,
        }} />

        {/* Filled portion */}
        <div style={{
          position: "absolute",
          left: 0,
          top: "50%",
          transform: "translateY(-50%)",
          width: `${fraction * 100}%`,
          height: 4,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${ACCENT}88, ${ACCENT})`,
          transition: isDragging ? "none" : "width 60ms ease",
        }} />

        {/* Tick marks at valid range extremes */}
        <div style={{
          position: "absolute",
          left: 0, top: "50%", transform: "translate(-1px, -50%)",
          width: 2, height: 12, borderRadius: 1,
          background: DIM, opacity: 0.5,
        }} />
        <div style={{
          position: "absolute",
          right: 0, top: "50%", transform: "translate(1px, -50%)",
          width: 2, height: 12, borderRadius: 1,
          background: DIM, opacity: 0.5,
        }} />

        {/* Thumb */}
        <div style={{
          position: "absolute",
          left: `${fraction * 100}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: isDragging ? 22 : 18,
          height: isDragging ? 22 : 18,
          borderRadius: "50%",
          background: ACCENT,
          border: `2px solid ${BG}`,
          boxShadow: isDragging
            ? `0 0 0 6px ${ACCENT}22, 0 0 16px ${ACCENT}44, 0 2px 8px rgba(0,0,0,0.4)`
            : `0 0 0 3px ${ACCENT}15, 0 2px 6px rgba(0,0,0,0.3)`,
          transition: isDragging ? "width 100ms ease, height 100ms ease, box-shadow 100ms ease" : "all 100ms ease",
          zIndex: 2,
        }}>
          {/* Inner dot */}
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 5, height: 5,
            borderRadius: "50%",
            background: BG,
            opacity: 0.7,
          }} />
        </div>
      </div>

      {/* Min / max labels */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        marginTop: 2,
        fontSize: "clamp(7px, 1.5vw, 9px)",
        color: DIM,
        fontFamily: FONT,
        padding: "0 2px",
      }}>
        <span>{VALID_LO.toFixed(2)}</span>
        <span>{VALID_HI.toFixed(2)}</span>
      </div>
    </div>
  );
}

// ─── KDE Display (read-only, shows cursor position) ───────────────────────────
function KDEDisplay({ entropy }) {
  const W = 600, H = 80;
  const PL = 48, PR = 16, PT = 6, PB = 22;
  const pw = W - PL - PR, ph = H - PT - PB;

  const toX = useCallback((e) => PL + ((e - KDE_LO) / (KDE_HI - KDE_LO)) * pw, [pw]);
  const toY = useCallback((d) => PT + ph - (d / kdeYMax) * ph, [ph]);

  const curvePath = useMemo(() => {
    return kdeXs.map((x, i) => `${i === 0 ? "M" : "L"}${toX(x).toFixed(1)},${toY(kdeYs[i]).toFixed(1)}`).join(" ");
  }, [toX, toY]);

  const areaPath = useMemo(() => {
    const base = PT + ph;
    return `${curvePath} L${toX(kdeXs[kdeXs.length - 1]).toFixed(1)},${base} L${PL},${base} Z`;
  }, [curvePath, toX, ph]);

  const cursorX = toX(entropy);
  const xTicks = niceTicks(KDE_LO, KDE_HI, 6);
  const validLeftX = toX(VALID_LO);
  const validRightX = toX(VALID_HI);

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`}
      style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id="kde-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.12" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="kde-shaded" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ACCENT} stopOpacity="0.30" />
          <stop offset="100%" stopColor={ACCENT} stopOpacity="0.06" />
        </linearGradient>
        <clipPath id="left-clip">
          <rect x={PL} y={PT} width={cursorX - PL} height={ph} />
        </clipPath>
      </defs>

      {/* Grid lines */}
      {xTicks.map(t => (
        <line key={t} x1={toX(t)} y1={PT} x2={toX(t)} y2={PT + ph}
          stroke={GRID} strokeWidth={0.6} strokeDasharray="3,3" />
      ))}

      {/* Out-of-range shading */}
      {validLeftX > PL && (
        <rect x={PL} y={PT} width={validLeftX - PL} height={ph}
          fill={BG} opacity={0.7} />
      )}
      {validRightX < PL + pw && (
        <rect x={validRightX} y={PT} width={PL + pw - validRightX} height={ph}
          fill={BG} opacity={0.7} />
      )}

      {/* Full area fill */}
      <path d={areaPath} fill="url(#kde-fill)" />
      {/* Shaded left region */}
      <path d={areaPath} fill="url(#kde-shaded)" clipPath="url(#left-clip)" />
      {/* KDE outline */}
      <path d={curvePath} fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0.8} />

      {/* Valid range boundary lines */}
      <line x1={validLeftX} y1={PT} x2={validLeftX} y2={PT + ph}
        stroke={DIM} strokeWidth={1} strokeDasharray="2,2" opacity={0.5} />
      <line x1={validRightX} y1={PT} x2={validRightX} y2={PT + ph}
        stroke={DIM} strokeWidth={1} strokeDasharray="2,2" opacity={0.5} />

      {/* Baseline */}
      <line x1={PL} y1={PT + ph} x2={PL + pw} y2={PT + ph} stroke={GRID} strokeWidth={1} />

      {/* Cursor line */}
      <line x1={cursorX} y1={PT} x2={cursorX} y2={PT + ph}
        stroke={ACCENT} strokeWidth={1.5} strokeDasharray="4,3" opacity={0.85} />
      <circle cx={cursorX} cy={PT + ph} r={4} fill={ACCENT} />

      {/* X axis ticks */}
      {xTicks.map(t => (
        <text key={t} x={toX(t)} y={H - 2} textAnchor="middle" fill={DIM} fontSize={8} fontFamily={FONT}>
          {t.toFixed(1)}
        </text>
      ))}

      {/* Y axis label */}
      <text
        x={PL - 6} y={PT + ph / 2}
        fill={DIM} fontSize={8} fontFamily={FONT} textAnchor="middle"
        transform={`rotate(-90, ${PL - 20}, ${PT + ph / 2})`}
      >
        density
      </text>
    </svg>
  );
}

// ─── NFE vs PPL chart ─────────────────────────────────────────────────────────
function NfeChart({ entropy, enabled }) {
  const svgRef = useRef(null);
  const [tooltip, setTooltip] = useState(null);

  const W = 700, H = 300;
  const PL = 58, PR = 155, PT = 18, PB = 46;
  const pw = W - PL - PR, ph = H - PT - PB;

  const series = useMemo(() => {
    return METHODS
      .filter(m => enabled[m.key])
      .map(m => {
        const nfes = Object.keys(m.data).map(Number).filter(n => n <= MAX_NFE).sort((a, b) => a - b);
        const points = nfes.flatMap(nfe => {
          const ppl = interpAtEntropy(m.data[nfe], entropy);
          return ppl !== null ? [{ nfe, ppl }] : [];
        });
        return { ...m, points };
      })
      .filter(s => s.points.length > 0);
  }, [entropy, enabled]);

  const allNfes = useMemo(() =>
    [...new Set(series.flatMap(s => s.points.map(p => p.nfe)))].sort((a, b) => a - b),
    [series]
  );

  const { pMin, pMax } = useMemo(() => {
    const allP = series.flatMap(s => s.points.map(p => p.ppl));
    if (!allP.length) return { pMin: 0, pMax: 100 };
    return { pMin: Math.max(0, Math.min(...allP) * 0.92), pMax: Math.max(...allP) * 1.12 };
  }, [series]);

  const nfeMin = allNfes[0] ?? 8, nfeMax = allNfes[allNfes.length - 1] ?? 128;

  const toX = useCallback((nfe) => PL + ((nfe - nfeMin) / (nfeMax - nfeMin)) * pw, [nfeMin, nfeMax, pw]);
  const toY = useCallback((p) => PT + (1 - (p - pMin) / (pMax - pMin)) * ph, [pMin, pMax, ph]);

  const yTicks = useMemo(() => niceTicks(pMin, pMax, 6), [pMin, pMax]);

  const ranking = useMemo(() => {
    const lastNfe = nfeMax;
    return series
      .map(s => {
        const pt = s.points.find(p => p.nfe === lastNfe) ?? s.points[s.points.length - 1];
        return pt ? { key: s.key, label: s.label, color: s.color, ppl: pt.ppl } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.ppl - b.ppl);
  }, [series, nfeMax]);

  const hitPoints = useRef([]);
  useEffect(() => {
    hitPoints.current = series.flatMap(s =>
      s.points.map(pt => ({ ...s, nfe: pt.nfe, ppl: pt.ppl, x: toX(pt.nfe), y: toY(pt.ppl) }))
    );
  }, [series, toX, toY]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onMove = (e) => {
      const rect = el.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (W / rect.width);
      const my = (e.clientY - rect.top) * (H / rect.height);
      let best = null, bestD = 18;
      for (const pt of hitPoints.current) {
        const d = Math.hypot(pt.x - mx, pt.y - my);
        if (d < bestD) { bestD = d; best = pt; }
      }
      setTooltip(best ? { x: e.clientX, y: e.clientY, label: `${best.label}`, nfe: best.nfe, ppl: best.ppl, color: best.color } : null);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("mouseleave", () => setTooltip(null));
    return () => el.removeEventListener("mousemove", onMove);
  }, []);

  if (!series.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: DIM, fontSize: 12, fontFamily: FONT }}>
        No data at this entropy value
      </div>
    );
  }

  return (
    <div style={{ position: "relative" }}>
      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", overflow: "visible" }}>

        {/* Y grid */}
        {yTicks.map(v => (
          <g key={v}>
            <line x1={PL} y1={toY(v)} x2={PL + pw} y2={toY(v)}
              stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
            <text x={PL - 7} y={toY(v) + 4} textAnchor="end" fill={DIM} fontSize={10} fontFamily={FONT}>{v.toFixed(0)}</text>
          </g>
        ))}

        {/* X grid + ticks */}
        {allNfes.map(nfe => (
          <g key={nfe}>
            <line x1={toX(nfe)} y1={PT} x2={toX(nfe)} y2={PT + ph}
              stroke={GRID} strokeWidth={0.6} strokeDasharray="3,3" />
            <text x={toX(nfe)} y={PT + ph + 16} textAnchor="middle" fill={DIM} fontSize={10} fontFamily={FONT}>{nfe}</text>
          </g>
        ))}

        {/* Axis borders */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + ph} stroke={GRID} strokeWidth={1} />
        <line x1={PL} y1={PT + ph} x2={PL + pw} y2={PT + ph} stroke={GRID} strokeWidth={1} />

        {/* Axis labels */}
        <text x={PL + pw / 2} y={H - 4} textAnchor="middle" fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}>
          Number of Function Evaluations (NFE)
        </text>
        <text x={13} y={PT + ph / 2} textAnchor="middle" fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}
          transform={`rotate(-90, 13, ${PT + ph / 2})`}>
          Generative Perplexity ↓
        </text>

        {/* Series lines + dots */}
        {series.map(s => {
          const d = s.points.map((p, i) =>
            `${i === 0 ? "M" : "L"}${toX(p.nfe).toFixed(2)},${toY(p.ppl).toFixed(2)}`
          ).join(" ");
          const isWinner = ranking[0]?.key === s.key;
          return (
            <g key={s.key}>
              {isWinner && (
                <path d={d} fill="none" stroke={s.color} strokeWidth={6} opacity={0.12}
                  strokeLinecap="round" strokeLinejoin="round" />
              )}
              <path d={d} fill="none" stroke={s.color}
                strokeWidth={isWinner ? 2.8 : 2.2}
                strokeLinecap="round" strokeLinejoin="round" />
              {s.points.map((pt, i) => (
                <circle key={i} cx={toX(pt.nfe)} cy={toY(pt.ppl)}
                  r={isWinner ? 6 : 5} fill={s.color} stroke={BG} strokeWidth={1.5} />
              ))}
            </g>
          );
        })}

        {/* Ranking box */}
        {ranking.length > 0 && (() => {
          const bx = PL + pw + 10;
          const bw = PR - 14;
          const rowH = 28;
          const boxH = rowH * ranking.length + 26;
          const by = PT + (ph - boxH) / 2;
          return (
            <g>
              <rect x={bx} y={by} width={bw} height={boxH}
                rx={7} fill={PANEL_BG} stroke={GRID} strokeWidth={1.2} />
              <text x={bx + bw / 2} y={by + 13}
                textAnchor="middle" fill={DIM} fontSize={8} fontFamily={FONT} fontWeight={600}
                letterSpacing="0.08em">
                RANK @ NFE {nfeMax}
              </text>
              {ranking.map(({ key, label, color, ppl }, r) => {
                const cy = by + 22 + r * rowH + rowH / 2;
                return (
                  <g key={key}>
                    <circle cx={bx + 14} cy={cy} r={9} fill={color} opacity={0.85} />
                    <text x={bx + 14} y={cy + 4} textAnchor="middle" fill="white"
                      fontSize={9} fontFamily={FONT} fontWeight={700}>{r + 1}</text>
                    <text x={bx + 28} y={cy - 2} fill={color}
                      fontSize={10} fontFamily={FONT} fontWeight={700}>{label}</text>
                    <text x={bx + 28} y={cy + 10} fill={MUTED}
                      fontSize={8} fontFamily={FONT}>{ppl.toFixed(1)}</text>
                  </g>
                );
              })}
            </g>
          );
        })()}
      </svg>

      {/* Floating tooltip */}
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 14, top: tooltip.y - 36,
          background: PANEL_BG, border: `1px solid ${tooltip.color}44`,
          borderLeft: `3px solid ${tooltip.color}`,
          color: TEXT, padding: "6px 10px", borderRadius: 6,
          fontSize: 11, fontFamily: FONT, pointerEvents: "none",
          boxShadow: "0 8px 24px rgba(0,0,0,0.5)", zIndex: 9999,
        }}>
          <span style={{ color: tooltip.color, fontWeight: 700 }}>{tooltip.label}</span>
          <span style={{ color: DIM }}> · NFE {tooltip.nfe}</span>
          <br />
          <span style={{ color: TEXT }}>PPL </span>
          <span style={{ fontWeight: 700 }}>{tooltip.ppl.toFixed(2)}</span>
        </div>
      )}
    </div>
  );
}

// ─── Method toggle pill ───────────────────────────────────────────────────────
function MethodPill({ method, enabled, onToggle }) {
  return (
    <button
      onClick={() => onToggle(method.key)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        padding: "5px 14px", borderRadius: 20,
        border: `1px solid ${enabled ? method.color + "44" : GRID}`,
        background: enabled ? method.color + "14" : "transparent",
        color: enabled ? method.color : DIM,
        fontFamily: FONT,
        fontSize: "clamp(10px, 2.2vw, 11px)",
        fontWeight: 700,
        cursor: "pointer", transition: "all 150ms ease",
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      <span style={{
        width: 8, height: 8, borderRadius: "50%",
        background: enabled ? method.color : GRID,
        flexShrink: 0, transition: "background 150ms ease",
      }} />
      {method.label}
    </button>
  );
}

// ─── Root component ───────────────────────────────────────────────────────────
export default function EntropyFrontier() {
  const clampedDefault = clamp(defaultEntropy, VALID_LO, VALID_HI);
  const [entropy, setEntropy]   = useState(clampedDefault);
  const [enabled, setEnabled]   = useState(
    Object.fromEntries(METHODS.map(m => [m.key, true]))
  );

  const handleChange = useCallback((e) => setEntropy(clamp(e, VALID_LO, VALID_HI)), []);
  const toggle = useCallback((key) => setEnabled(prev => ({ ...prev, [key]: !prev[key] })), []);

  // Live per-method PPL at current entropy
  const liveStats = useMemo(() => {
    return METHODS
      .filter(m => enabled[m.key])
      .map(m => {
        const nfes = Object.keys(m.data).map(Number).filter(n => n <= MAX_NFE);
        let bestPpl = null, bestNfe = null;
        for (const nfe of nfes) {
          const ppl = interpAtEntropy(m.data[nfe], entropy);
          if (ppl !== null && (bestPpl === null || ppl < bestPpl)) {
            bestPpl = ppl; bestNfe = nfe;
          }
        }
        return bestPpl !== null ? { key: m.key, label: m.label, color: m.color, ppl: bestPpl, nfe: bestNfe } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.ppl - b.ppl);
  }, [entropy, enabled]);

  return (
    <div style={{
      background: BG, color: TEXT, fontFamily: FONT,
      padding: "24px 20px 28px", userSelect: "none",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{
          fontSize: "clamp(15px, 3.2vw, 20px)",
          fontWeight: 700,
          letterSpacing: "0.02em",
          marginBottom: 4,
          background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Entropy-Controlled Perplexity Frontiers
        </div>
        <div style={{ fontSize: "clamp(9px, 2vw, 11px)", color: MUTED, letterSpacing: "0.02em" }}>
          Use the slider to compare methods at a fair operating point
        </div>
      </div>

      {/* Method toggles */}
      <div style={{ display: "flex", justifyContent: "center", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
        {METHODS.map(m => (
          <MethodPill key={m.key} method={m} enabled={enabled[m.key]} onToggle={toggle} />
        ))}
      </div>

      {/* Entropy control panel */}
      <div style={{
        background: PANEL_BG, borderRadius: 8, border: `1px solid ${GRID}`,
        padding: "12px 16px 8px", marginBottom: 10,
      }}>
        {/* Slider rail — primary interaction, big touch target */}
        <SliderRail entropy={entropy} onChange={handleChange} />

        {/* KDE display — read-only context visualization */}
        <div style={{
          marginTop: 4,
          borderTop: `1px solid ${GRID}`,
          paddingTop: 6,
        }}>
          <div style={{
            fontSize: "clamp(7px, 1.5vw, 9px)", color: DIM,
            letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 2,
          }}>
            OWT Entropy Distribution
          </div>
          <KDEDisplay entropy={entropy} />
        </div>
      </div>

      {/* Live stat pills */}
      {liveStats.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {liveStats.map((s, i) => (
            <div key={s.key} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: PANEL_BG, border: `1px solid ${i === 0 ? s.color + "55" : GRID}`,
              borderRadius: 8, padding: "7px 12px",
              boxShadow: i === 0 ? `0 0 12px ${s.color}18` : "none",
              transition: "all 200ms ease",
            }}>
              <span style={{
                background: s.color, color: "#fff", borderRadius: "50%",
                width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 10, fontWeight: 700, flexShrink: 0,
              }}>{i + 1}</span>
              <span style={{ color: s.color, fontWeight: 700, fontSize: "clamp(10px, 2.2vw, 12px)" }}>{s.label}</span>
              <span style={{ color: DIM, fontSize: "clamp(8px, 1.8vw, 10px)" }}>best PPL</span>
              <span style={{ color: TEXT, fontWeight: 700, fontSize: "clamp(10px, 2.2vw, 12px)" }}>{s.ppl.toFixed(2)}</span>
              <span style={{ color: DIM, fontSize: "clamp(8px, 1.8vw, 10px)" }}>@ NFE {s.nfe}</span>
            </div>
          ))}
        </div>
      )}

      {/* NFE chart panel */}
      <div style={{
        background: CARD_BG, borderRadius: 8, border: `1px solid ${GRID}`,
        padding: "14px 12px 8px",
      }}>
        <div style={{
          fontSize: "clamp(8px, 1.8vw, 11px)", color: DIM,
          letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10,
        }}>
          NFE vs Perplexity — at H = {entropy.toFixed(3)}
        </div>
        <NfeChart entropy={entropy} enabled={enabled} />
      </div>
    </div>
  );
}