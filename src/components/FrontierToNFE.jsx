import { useState, useRef, useCallback, useEffect, useMemo } from "react";

// ─── Real data ────────────────────────────────────────────────────────────────
const MDLM_DATA = {
  8: { 1.0:{perplexity:886.005,entropy:5.8936}, 0.975:{perplexity:613.797,entropy:5.7557}, 0.95:{perplexity:432.278,entropy:5.6291}, 0.925:{perplexity:297.693,entropy:5.4855}, 0.9:{perplexity:226.065,entropy:5.3423}, 0.875:{perplexity:169.670,entropy:5.1971}, 0.85:{perplexity:128.816,entropy:5.0267}, 0.825:{perplexity:97.956,entropy:4.8156}, 0.8:{perplexity:73.795,entropy:4.5755}, 0.775:{perplexity:57.650,entropy:4.2969}, 0.75:{perplexity:43.828,entropy:4.0084}, 0.725:{perplexity:32.880,entropy:3.7040}, 0.7:{perplexity:25.907,entropy:3.4260}, 0.675:{perplexity:19.571,entropy:3.1478}, 0.65:{perplexity:16.026,entropy:2.8926}, 0.625:{perplexity:12.985,entropy:2.6824}, 0.6:{perplexity:11.313,entropy:2.4766} },
  16: { 1.0:{perplexity:332.830,entropy:5.7860}, 0.975:{perplexity:247.658,entropy:5.6902}, 0.95:{perplexity:188.441,entropy:5.5892}, 0.925:{perplexity:141.848,entropy:5.4944}, 0.9:{perplexity:109.391,entropy:5.3790}, 0.875:{perplexity:84.466,entropy:5.2543}, 0.85:{perplexity:65.627,entropy:5.1375}, 0.825:{perplexity:52.824,entropy:4.9681}, 0.8:{perplexity:42.259,entropy:4.8179}, 0.775:{perplexity:34.045,entropy:4.5723}, 0.75:{perplexity:27.330,entropy:4.3635}, 0.725:{perplexity:21.598,entropy:4.1030}, 0.7:{perplexity:16.999,entropy:3.7455}, 0.675:{perplexity:13.596,entropy:3.4699}, 0.65:{perplexity:10.712,entropy:3.1330}, 0.625:{perplexity:8.749,entropy:2.8654}, 0.6:{perplexity:7.251,entropy:2.5664} },
  32: { 1.0:{perplexity:193.377,entropy:5.7346}, 0.975:{perplexity:147.290,entropy:5.6467}, 0.95:{perplexity:114.460,entropy:5.5593}, 0.925:{perplexity:86.690,entropy:5.4571}, 0.9:{perplexity:69.847,entropy:5.3788}, 0.875:{perplexity:54.850,entropy:5.2670}, 0.85:{perplexity:43.253,entropy:5.1570}, 0.825:{perplexity:35.104,entropy:5.0259}, 0.8:{perplexity:28.792,entropy:4.8906}, 0.775:{perplexity:23.610,entropy:4.6847}, 0.75:{perplexity:19.715,entropy:4.5138}, 0.725:{perplexity:15.455,entropy:4.2259}, 0.7:{perplexity:12.882,entropy:3.9756}, 0.675:{perplexity:10.181,entropy:3.6480}, 0.65:{perplexity:8.061,entropy:3.2831}, 0.625:{perplexity:6.842,entropy:3.0213}, 0.6:{perplexity:5.546,entropy:2.7052} },
  64: { 1.0:{perplexity:140.169,entropy:5.6892}, 0.975:{perplexity:106.731,entropy:5.6012}, 0.95:{perplexity:82.088,entropy:5.5118}, 0.925:{perplexity:64.159,entropy:5.4232}, 0.9:{perplexity:49.980,entropy:5.3242}, 0.875:{perplexity:41.443,entropy:5.2323}, 0.85:{perplexity:32.845,entropy:5.1174}, 0.825:{perplexity:27.605,entropy:5.0126}, 0.8:{perplexity:22.618,entropy:4.8704}, 0.775:{perplexity:19.061,entropy:4.7108}, 0.75:{perplexity:15.974,entropy:4.5605}, 0.725:{perplexity:13.001,entropy:4.3366}, 0.7:{perplexity:10.416,entropy:4.0275}, 0.675:{perplexity:8.442,entropy:3.7450}, 0.65:{perplexity:7.048,entropy:3.4726}, 0.625:{perplexity:5.725,entropy:3.1579}, 0.6:{perplexity:4.740,entropy:2.7529} },
  128: { 1.0:{perplexity:123.691,entropy:5.6745}, 0.975:{perplexity:97.505,entropy:5.5923}, 0.95:{perplexity:73.754,entropy:5.4995}, 0.925:{perplexity:57.919,entropy:5.4183}, 0.9:{perplexity:46.111,entropy:5.3267}, 0.875:{perplexity:36.421,entropy:5.2179}, 0.85:{perplexity:29.913,entropy:5.1291}, 0.825:{perplexity:24.340,entropy:5.0045}, 0.8:{perplexity:19.790,entropy:4.8464} },
};

const DUO_DATA = {
  8: { 1.0:{perplexity:191.157,entropy:5.5728}, 0.975:{perplexity:147.756,entropy:5.4599}, 0.95:{perplexity:118.450,entropy:5.3498}, 0.925:{perplexity:96.411,entropy:5.2344}, 0.9:{perplexity:80.606,entropy:5.0662}, 0.875:{perplexity:67.894,entropy:4.8764}, 0.85:{perplexity:58.652,entropy:4.6618}, 0.825:{perplexity:46.926,entropy:4.3483}, 0.8:{perplexity:34.499,entropy:3.9184}, 0.775:{perplexity:24.469,entropy:3.4915}, 0.75:{perplexity:16.921,entropy:3.0229}, 0.725:{perplexity:11.231,entropy:2.5751}, 0.7:{perplexity:8.742,entropy:2.3029} },
  16: { 1.0:{perplexity:119.309,entropy:5.5816}, 0.975:{perplexity:94.608,entropy:5.5026}, 0.95:{perplexity:75.760,entropy:5.4129}, 0.925:{perplexity:64.481,entropy:5.3182}, 0.9:{perplexity:55.805,entropy:5.2304}, 0.875:{perplexity:49.500,entropy:5.1067}, 0.85:{perplexity:41.736,entropy:4.9096}, 0.825:{perplexity:35.122,entropy:4.6791}, 0.8:{perplexity:28.583,entropy:4.3821}, 0.775:{perplexity:22.670,entropy:4.0327}, 0.75:{perplexity:16.763,entropy:3.5743}, 0.725:{perplexity:12.175,entropy:3.1413}, 0.7:{perplexity:8.739,entropy:2.6681} },
  32: { 1.0:{perplexity:95.439,entropy:5.5588}, 0.975:{perplexity:75.330,entropy:5.4845}, 0.95:{perplexity:60.711,entropy:5.4046}, 0.925:{perplexity:53.337,entropy:5.3490}, 0.9:{perplexity:46.036,entropy:5.2523}, 0.875:{perplexity:40.999,entropy:5.1536}, 0.85:{perplexity:35.866,entropy:4.9907}, 0.825:{perplexity:31.222,entropy:4.8089}, 0.8:{perplexity:26.303,entropy:4.5181}, 0.775:{perplexity:21.322,entropy:4.1534}, 0.75:{perplexity:16.086,entropy:3.7754}, 0.725:{perplexity:12.229,entropy:3.3527}, 0.7:{perplexity:9.611,entropy:2.9669} },
  64: { 1.0:{perplexity:87.020,entropy:5.5705}, 0.975:{perplexity:72.779,entropy:5.5045}, 0.95:{perplexity:59.532,entropy:5.4318}, 0.925:{perplexity:52.235,entropy:5.3634}, 0.9:{perplexity:44.846,entropy:5.2809}, 0.875:{perplexity:38.585,entropy:5.1534}, 0.85:{perplexity:33.652,entropy:4.9577}, 0.825:{perplexity:28.841,entropy:4.7592}, 0.8:{perplexity:24.047,entropy:4.4924}, 0.775:{perplexity:19.227,entropy:4.1695}, 0.75:{perplexity:14.499,entropy:3.7163}, 0.725:{perplexity:12.599,entropy:3.3122}, 0.7:{perplexity:9.240,entropy:2.9110} },
  128: { 1.0:{perplexity:78.489,entropy:5.5341}, 0.975:{perplexity:62.759,entropy:5.4583}, 0.95:{perplexity:53.505,entropy:5.4138}, 0.925:{perplexity:45.937,entropy:5.3384}, 0.9:{perplexity:40.667,entropy:5.2764}, 0.875:{perplexity:36.737,entropy:5.2009}, 0.85:{perplexity:32.491,entropy:5.0830}, 0.825:{perplexity:28.456,entropy:4.9131}, 0.8:{perplexity:25.250,entropy:4.6676} },
};

const CANDI_DATA = {
  8: { 1.0:{perplexity:752.164,entropy:5.9813}, 0.975:{perplexity:535.763,entropy:5.8697}, 0.95:{perplexity:395.563,entropy:5.7528}, 0.925:{perplexity:290.354,entropy:5.6285}, 0.9:{perplexity:213.906,entropy:5.5001}, 0.875:{perplexity:161.410,entropy:5.3809}, 0.85:{perplexity:122.869,entropy:5.2455}, 0.825:{perplexity:95.438,entropy:5.1063}, 0.8:{perplexity:76.353,entropy:4.9560}, 0.775:{perplexity:60.131,entropy:4.8136}, 0.75:{perplexity:49.362,entropy:4.6607}, 0.725:{perplexity:41.830,entropy:4.5037}, 0.7:{perplexity:34.913,entropy:4.3512} },
  16: { 1.0:{perplexity:392.146,entropy:5.9193}, 0.975:{perplexity:283.037,entropy:5.8223}, 0.95:{perplexity:210.890,entropy:5.7201}, 0.925:{perplexity:158.797,entropy:5.6158}, 0.9:{perplexity:124.796,entropy:5.5182}, 0.875:{perplexity:97.111,entropy:5.4235}, 0.85:{perplexity:75.930,entropy:5.3139}, 0.825:{perplexity:61.345,entropy:5.2002}, 0.8:{perplexity:49.047,entropy:5.0868}, 0.775:{perplexity:40.709,entropy:4.9656}, 0.75:{perplexity:33.670,entropy:4.8295}, 0.725:{perplexity:28.475,entropy:4.6760}, 0.7:{perplexity:24.317,entropy:4.5383} },
  32: { 1.0:{perplexity:241.899,entropy:5.8481}, 0.975:{perplexity:177.855,entropy:5.7479}, 0.95:{perplexity:134.748,entropy:5.6475}, 0.925:{perplexity:101.851,entropy:5.5511}, 0.9:{perplexity:80.178,entropy:5.4561}, 0.875:{perplexity:64.893,entropy:5.3669}, 0.85:{perplexity:51.228,entropy:5.2642}, 0.825:{perplexity:40.782,entropy:5.1573}, 0.8:{perplexity:34.220,entropy:5.0533}, 0.775:{perplexity:29.028,entropy:4.9576}, 0.75:{perplexity:24.708,entropy:4.8403}, 0.725:{perplexity:21.193,entropy:4.7136}, 0.7:{perplexity:18.686,entropy:4.6094} },
  64: { 1.0:{perplexity:188.653,entropy:5.7946}, 0.975:{perplexity:136.978,entropy:5.6993}, 0.95:{perplexity:106.965,entropy:5.6085}, 0.925:{perplexity:82.217,entropy:5.5175}, 0.9:{perplexity:65.611,entropy:5.4215}, 0.875:{perplexity:52.276,entropy:5.3183}, 0.85:{perplexity:42.690,entropy:5.2073}, 0.825:{perplexity:34.927,entropy:5.1311}, 0.8:{perplexity:28.767,entropy:5.0244}, 0.775:{perplexity:24.529,entropy:4.9202}, 0.75:{perplexity:21.057,entropy:4.8167}, 0.725:{perplexity:18.738,entropy:4.7430}, 0.7:{perplexity:16.586,entropy:4.6541} },
  128: { 1.0:{perplexity:165.208,entropy:5.7795}, 0.975:{perplexity:123.955,entropy:5.6874}, 0.95:{perplexity:95.637,entropy:5.5865}, 0.925:{perplexity:74.565,entropy:5.4863}, 0.9:{perplexity:58.445,entropy:5.3715}, 0.875:{perplexity:45.313,entropy:5.2545}, 0.85:{perplexity:37.702,entropy:5.1474}, 0.825:{perplexity:29.864,entropy:5.0574}, 0.8:{perplexity:25.669,entropy:4.9729}, 0.775:{perplexity:21.830,entropy:4.8778}, 0.75:{perplexity:18.762,entropy:4.7731}, 0.725:{perplexity:16.371,entropy:4.6637}, 0.7:{perplexity:14.322,entropy:4.5361} },
};

function filterToCommonTemps(data) {
  const nfes = Object.keys(data).map(Number);
  const tempSets = nfes.map((nfe) => new Set(Object.keys(data[nfe]).map(Number)));
  const common = [...tempSets[0]].filter((t) => tempSets.every((s) => s.has(t)));
  const filtered = {};
  for (const nfe of nfes) {
    filtered[nfe] = {};
    for (const t of common) filtered[nfe][t] = data[nfe][t];
  }
  return filtered;
}

const ALL_DATA = {
  MDLM:  filterToCommonTemps(MDLM_DATA),
  DUO:   filterToCommonTemps(DUO_DATA),
  CANDI: filterToCommonTemps(CANDI_DATA),
};
const NFES = [8, 16, 32, 64, 128];
const METHODS = ["MDLM", "DUO", "CANDI"];
const ENTROPY_SPREAD_WARN = 0.08;

// ─── Theme ────────────────────────────────────────────────────────────────────
const BG = "#0d0d1a";
const PANEL_BG = "#13132b";
const CARD_BG = "#0a0a18";
const GRID = "#1a1a3a";
const TEXT = "#ffffff";
const DIM = "#444466";
const MUTED = "#555";
const ACCENT_CYAN = "#7ee8fa";
const FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

const METHOD_COLORS = {
  MDLM: "#e05c5c",
  DUO: "#5b9bd5",
  CANDI: "#57c27c",
};

// ─── Data helpers ─────────────────────────────────────────────────────────────
function getFrontier(method, nfe) {
  const raw = ALL_DATA[method][nfe];
  return Object.entries(raw)
    .map(([, v]) => ({ entropy: v.entropy, perplexity: v.perplexity }))
    .sort((a, b) => a.entropy - b.entropy);
}

function interpFrontier(frontier, targetEntropy) {
  const lo = frontier[0].entropy;
  const hi = frontier[frontier.length - 1].entropy;
  const inRange = targetEntropy >= lo && targetEntropy <= hi;
  const te = Math.max(lo, Math.min(hi, targetEntropy));
  for (let i = 0; i < frontier.length - 1; i++) {
    const a = frontier[i], b = frontier[i + 1];
    if (te >= a.entropy && te <= b.entropy) {
      const t = (te - a.entropy) / (b.entropy - a.entropy);
      return { entropy: te, perplexity: a.perplexity + t * (b.perplexity - a.perplexity), inRange };
    }
  }
  return { ...frontier[frontier.length - 1], inRange };
}

function getMethodEntropyRanges() {
  const ranges = {};
  for (const m of METHODS) {
    let lo = Infinity, hi = -Infinity;
    for (const nfe of NFES) {
      for (const v of Object.values(ALL_DATA[m][nfe])) {
        if (v.entropy < lo) lo = v.entropy;
        if (v.entropy > hi) hi = v.entropy;
      }
    }
    ranges[m] = [lo, hi];
  }
  return ranges;
}
const METHOD_ENTROPY_RANGES = getMethodEntropyRanges();

function getDisplayEntropyRange() {
  let lo = Infinity, hi = -Infinity;
  for (const m of METHODS)
    for (const nfe of NFES)
      for (const v of Object.values(ALL_DATA[m][nfe])) {
        if (v.entropy < lo) lo = v.entropy;
        if (v.entropy > hi) hi = v.entropy;
      }
  return [lo - 0.05, hi + 0.05];
}

const [E_DISPLAY_LO, E_DISPLAY_HI] = getDisplayEntropyRange();

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ─── Method Slider Rail ───────────────────────────────────────────────────────
function MethodSlider({ method, value, onChange }) {
  const railRef = useRef(null);
  const dragging = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const color = METHOD_COLORS[method];
  const [mLo, mHi] = METHOD_ENTROPY_RANGES[method];
  const fraction = (value - mLo) / (mHi - mLo);

  const getEntropyFromPointer = useCallback((clientX) => {
    const rect = railRef.current.getBoundingClientRect();
    const t = clamp((clientX - rect.left) / rect.width, 0, 1);
    return mLo + t * (mHi - mLo);
  }, [mLo, mHi]);

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      const cx = e.touches ? e.touches[0].clientX : e.clientX;
      onChange(method, getEntropyFromPointer(cx));
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
  }, [onChange, getEntropyFromPointer, method]);

  const handleDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    setIsDragging(true);
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    onChange(method, getEntropyFromPointer(cx));
  }, [onChange, getEntropyFromPointer, method]);

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "3px 0",
    }}>
      {/* Method label */}
      <span style={{
        fontSize: "clamp(8px, 1.8vw, 10px)",
        fontWeight: 700,
        color,
        width: 42,
        textAlign: "right",
        flexShrink: 0,
        letterSpacing: "0.04em",
      }}>{method}</span>

      {/* Rail */}
      <div
        ref={railRef}
        onMouseDown={handleDown}
        onTouchStart={handleDown}
        style={{
          position: "relative",
          flex: 1,
          height: 28,
          display: "flex",
          alignItems: "center",
          cursor: "ew-resize",
          touchAction: "pan-y",
        }}
      >
        {/* Track bg */}
        <div style={{
          position: "absolute",
          left: 0, right: 0,
          top: "50%", transform: "translateY(-50%)",
          height: 3,
          borderRadius: 2,
          background: GRID,
        }} />
        {/* Filled */}
        <div style={{
          position: "absolute",
          left: 0,
          top: "50%", transform: "translateY(-50%)",
          width: `${fraction * 100}%`,
          height: 3,
          borderRadius: 2,
          background: `linear-gradient(90deg, ${color}66, ${color})`,
          transition: isDragging ? "none" : "width 60ms ease",
        }} />
        {/* Thumb */}
        <div style={{
          position: "absolute",
          left: `${fraction * 100}%`,
          top: "50%",
          transform: "translate(-50%, -50%)",
          width: isDragging ? 18 : 14,
          height: isDragging ? 18 : 14,
          borderRadius: "50%",
          background: color,
          border: `2px solid ${BG}`,
          boxShadow: isDragging
            ? `0 0 0 4px ${color}22, 0 0 12px ${color}44`
            : `0 0 0 2px ${color}15, 0 2px 4px rgba(0,0,0,0.3)`,
          transition: isDragging ? "width 80ms, height 80ms, box-shadow 80ms" : "all 80ms ease",
          zIndex: 2,
        }}>
          <div style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            width: 4, height: 4,
            borderRadius: "50%",
            background: BG,
            opacity: 0.6,
          }} />
        </div>
      </div>

      {/* Value */}
      <span style={{
        fontSize: "clamp(8px, 1.6vw, 10px)",
        color,
        fontFamily: FONT,
        fontWeight: 600,
        width: 50,
        textAlign: "left",
        flexShrink: 0,
        opacity: isDragging ? 1 : 0.75,
        transition: "opacity 100ms",
      }}>
        {value.toFixed(3)}
      </span>
    </div>
  );
}

// ─── Main widget ──────────────────────────────────────────────────────────────
export default function EntropyRankingWidget() {
  const [positions, setPositions] = useState(() => {
    const init = {};
    for (const m of METHODS) {
      const [lo, hi] = METHOD_ENTROPY_RANGES[m];
      init[m] = lo + (hi - lo) * 0.55;
    }
    return init;
  });
  const dragging = useRef(null);

  const handleSliderChange = useCallback((method, entropy) => {
    setPositions((p) => ({ ...p, [method]: entropy }));
  }, []);

  const onPointerMove = useCallback((clientX) => {
    if (!dragging.current) return;
    const { method, svgEl, W, PAD_L, PAD_R } = dragging.current;
    const rect = svgEl.getBoundingClientRect();
    const rawX = (clientX - rect.left) * (W / rect.width);
    const frac = (rawX - PAD_L) / (W - PAD_L - PAD_R);
    const entropy = E_DISPLAY_LO + frac * (E_DISPLAY_HI - E_DISPLAY_LO);
    const [mLo, mHi] = METHOD_ENTROPY_RANGES[method];
    const clamped = Math.max(mLo, Math.min(mHi, entropy));
    setPositions((p) => ({ ...p, [method]: clamped }));
  }, []);

  useEffect(() => {
    const mm = (e) => onPointerMove(e.clientX);
    const tm = (e) => {
      if (!dragging.current) return;
      if (e.cancelable) e.preventDefault();
      onPointerMove(e.touches[0].clientX);
    };
    const up = () => { dragging.current = null; };
    window.addEventListener("mousemove", mm);
    window.addEventListener("mouseup", up);
    window.addEventListener("touchmove", tm, { passive: false });
    window.addEventListener("touchend", up);
    return () => {
      window.removeEventListener("mousemove", mm);
      window.removeEventListener("mouseup", up);
      window.removeEventListener("touchmove", tm);
      window.removeEventListener("touchend", up);
    };
  }, [onPointerMove]);

  const selectedPoints = useMemo(() => {
    const r = {};
    for (const m of METHODS) {
      r[m] = {};
      for (const nfe of NFES)
        r[m][nfe] = interpFrontier(getFrontier(m, nfe), positions[m]);
    }
    return r;
  }, [positions]);

  const ranking = useMemo(() =>
    [...METHODS]
      .map((m) => ({ method: m, ppl: selectedPoints[m][128].perplexity }))
      .sort((a, b) => a.ppl - b.ppl),
    [selectedPoints]
  );

  const entropySpread = useMemo(() => {
    const vals = METHODS.map((m) => positions[m]);
    return Math.max(...vals) - Math.min(...vals);
  }, [positions]);

  return (
    <div style={{
      background: BG, color: TEXT, padding: "20px 16px 24px",
      fontFamily: FONT,
      userSelect: "none",
      overflow: "hidden",
    }}>
      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <div style={{
          fontSize: "clamp(15px, 3.2vw, 20px)",
          fontWeight: 700,
          letterSpacing: "0.02em",
          background: "linear-gradient(90deg, #7ee8fa 0%, #e879f9 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}>
          Same Frontiers. Different Rankings.
        </div>
        <div style={{ fontSize: "clamp(9px, 2vw, 11px)", color: MUTED, marginTop: 4, letterSpacing: "0.02em" }}>
          Use the sliders or drag any ● to move that method's operating point
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", justifyContent: "center", gap: 28, marginBottom: 10 }}>
        {METHODS.map((m) => (
          <div key={m} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <svg width={24} height={4} style={{ overflow: "visible" }}>
              <line x1={0} y1={2} x2={24} y2={2} stroke={METHOD_COLORS[m]} strokeWidth={2.5} />
            </svg>
            <span style={{
              fontSize: "clamp(11px, 2.5vw, 13px)",
              fontWeight: 700,
              color: METHOD_COLORS[m],
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}>{m}</span>
          </div>
        ))}
      </div>

      {/* Slider rails — one per method */}
      <div style={{
        background: PANEL_BG, borderRadius: 8, border: `1px solid ${GRID}`,
        padding: "8px 14px 6px", marginBottom: 10,
      }}>
        <div style={{
          fontSize: "clamp(7px, 1.5vw, 9px)", color: DIM,
          letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4,
        }}>
          Entropy Operating Points
        </div>
        {METHODS.map((m) => (
          <MethodSlider
            key={m}
            method={m}
            value={positions[m]}
            onChange={handleSliderChange}
          />
        ))}
      </div>

      {/* Top row: 5 frontier panels */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 4 }}>
        {NFES.map((nfe, col) => (
          <FrontierPanel
            key={nfe}
            nfe={nfe}
            positions={positions}
            selectedPoints={selectedPoints}
            setPositions={setPositions}
            dragging={dragging}
            showYAxis={col === 0}
          />
        ))}
      </div>

      {/* Shared axis labels for top row — corrected placement */}
      <div style={{
        display: "flex",
        justifyContent: "center",
        padding: "2px 0 8px 0",
      }}>
        <span style={{ fontSize: "clamp(9px, 2vw, 11px)", color: MUTED }}>
          Sample Entropy →
        </span>
      </div>

      {/* Bottom: NFE vs PPL */}
      <NfePplPanel
        selectedPoints={selectedPoints}
        ranking={ranking}
        entropySpread={entropySpread}
        positions={positions}
      />
    </div>
  );
}

// ─── Frontier mini-panel ──────────────────────────────────────────────────────
function FrontierPanel({ nfe, positions, selectedPoints, setPositions, dragging, showYAxis }) {
  const svgRef = useRef(null);
  const W = 220, H = 180;
  const PAD_L = showYAxis ? 34 : 8;
  const PAD_R = 8, PAD_T = 8, PAD_B = 8;

  const pplMax = useMemo(() => {
    let hi = 0;
    for (const m of METHODS)
      for (const v of Object.values(ALL_DATA[m][nfe]))
        if (v.perplexity > hi) hi = v.perplexity;
    return hi * 1.08;
  }, [nfe]);

  function toX(e) {
    return PAD_L + ((e - E_DISPLAY_LO) / (E_DISPLAY_HI - E_DISPLAY_LO)) * (W - PAD_L - PAD_R);
  }
  function toY(p) {
    return PAD_T + (p / pplMax) * (H - PAD_T - PAD_B);
  }

  function startDrag(method, e) {
    e.stopPropagation();
    dragging.current = { method, svgEl: svgRef.current, W, PAD_L, PAD_R };
  }
  function handleLineClick(method, e) {
    const rect = svgRef.current.getBoundingClientRect();
    const rawX = (e.clientX - rect.left) * (W / rect.width);
    const raw = E_DISPLAY_LO + ((rawX - PAD_L) / (W - PAD_L - PAD_R)) * (E_DISPLAY_HI - E_DISPLAY_LO);
    const [mLo, mHi] = METHOD_ENTROPY_RANGES[method];
    const entropy = Math.max(mLo, Math.min(mHi, raw));
    setPositions((p) => ({ ...p, [method]: entropy }));
  }

  const eGrids = [3.5, 4.0, 4.5, 5.0, 5.5];

  return (
    <div>
      <div style={{
        fontSize: "clamp(9px, 2vw, 12px)",
        fontWeight: 700,
        color: ACCENT_CYAN,
        textAlign: "center",
        marginBottom: 3,
        letterSpacing: "0.04em",
      }}>
        NFE = {nfe}
      </div>
      <svg
        ref={svgRef}
        width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", background: PANEL_BG, borderRadius: 8, border: `1px solid ${GRID}` }}
      >
        {/* Grid lines */}
        {eGrids.map((eg) => (
          <line key={eg}
            x1={toX(eg)} y1={PAD_T} x2={toX(eg)} y2={H - PAD_B}
            stroke={GRID} strokeWidth={0.7} strokeDasharray="3,3" />
        ))}

        {/* Frontier curves */}
        {METHODS.map((method) => {
          const frontier = getFrontier(method, nfe);
          const d = frontier.map((pt, i) =>
            `${i === 0 ? "M" : "L"}${toX(pt.entropy).toFixed(2)},${toY(pt.perplexity).toFixed(2)}`
          ).join(" ");
          return (
            <path key={method} d={d}
              fill="none" stroke={METHOD_COLORS[method]} strokeWidth={2.2} opacity={0.88}
              style={{ cursor: "crosshair" }}
              onClick={(e) => handleLineClick(method, e)}
            />
          );
        })}

        {/* Vertical entropy indicator lines */}
        {METHODS.map((method) => {
          const x = toX(positions[method]);
          const col = METHOD_COLORS[method];
          return (
            <line key={`vline-${method}`}
              x1={x} y1={PAD_T} x2={x} y2={H - PAD_B}
              stroke={col} strokeWidth={0.8} strokeDasharray="4,3" opacity={0.35}
            />
          );
        })}

        {/* Draggable dots */}
        {METHODS.map((method) => {
          const pt = selectedPoints[method][nfe];
          const cx = toX(pt.entropy);
          const cy = toY(pt.perplexity);
          const col = METHOD_COLORS[method];
          return (
            <g key={method} style={{ cursor: "grab" }}
              onMouseDown={(e) => startDrag(method, e)}
              onTouchStart={(e) => { e.preventDefault(); startDrag(method, e); }}
            >
              <circle cx={cx} cy={cy} r={14} fill="transparent" />
              <circle cx={cx} cy={cy} r={9} fill={col} opacity={0.15} />
              <circle cx={cx} cy={cy} r={5.5} fill={col} stroke="rgba(255,255,255,0.6)" strokeWidth={1.5} />
            </g>
          );
        })}

        {/* Y-axis label — rotated along the left edge */}
        {showYAxis && (
          <text x={12} y={H / 2} fill={DIM} fontSize={9} fontFamily={FONT}
            textAnchor="middle"
            transform={`rotate(-90, 12, ${H / 2})`}>
            Gen. Perplexity ↑
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── NFE vs PPL panel ─────────────────────────────────────────────────────────
function NfePplPanel({ selectedPoints, ranking, entropySpread, positions }) {
  const W = 820, H = 310;
  const PAD_L = 60, PAD_R = 165, PAD_T = 20, PAD_B = 52;

  const maxPPL = useMemo(() => {
    let m = 0;
    for (const method of METHODS)
      for (const nfe of NFES) {
        const v = selectedPoints[method][nfe].perplexity;
        if (v > m) m = v;
      }
    return m * 1.2;
  }, [selectedPoints]);

  function toX(nfe) {
    return PAD_L + ((nfe - NFES[0]) / (NFES[NFES.length - 1] - NFES[0])) * (W - PAD_L - PAD_R);
  }
  function toY(p) {
    return PAD_T + (1 - p / maxPPL) * (H - PAD_T - PAD_B);
  }

  const yTicks = useMemo(() => {
    const nice = [5, 10, 20, 25, 50, 100, 150, 200, 250, 300, 400, 500, 750, 1000];
    const step = nice.find((s) => maxPPL / s <= 8) || 200;
    const ticks = [];
    for (let v = 0; v <= maxPPL; v += step) ticks.push(v);
    return ticks;
  }, [maxPPL]);

  return (
    <div>
      <div style={{
        fontSize: "clamp(10px, 2.2vw, 13px)",
        fontWeight: 600,
        color: TEXT,
        textAlign: "center",
        marginBottom: 8,
        letterSpacing: "0.02em",
      }}>
        NFE vs Perplexity — at selected temperatures
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`}
        style={{ display: "block", background: CARD_BG, borderRadius: 8, border: `1px solid ${GRID}` }}>

        {/* Y grid */}
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={toY(v)} x2={W - PAD_R} y2={toY(v)}
              stroke={GRID} strokeWidth={0.7} strokeDasharray="4,4" />
            <text x={PAD_L - 7} y={toY(v) + 4} textAnchor="end" fill={DIM} fontSize={10} fontFamily={FONT}>{v}</text>
          </g>
        ))}

        {/* X ticks */}
        {NFES.map((nfe) => (
          <g key={nfe}>
            <line x1={toX(nfe)} y1={PAD_T} x2={toX(nfe)} y2={H - PAD_B}
              stroke={GRID} strokeWidth={0.6} strokeDasharray="3,3" />
            <text x={toX(nfe)} y={H - PAD_B + 15} textAnchor="middle" fill={DIM} fontSize={10} fontFamily={FONT}>{nfe}</text>
          </g>
        ))}

        {/* Axes */}
        <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={H - PAD_B} stroke={GRID} strokeWidth={1} />
        <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke={GRID} strokeWidth={1} />

        {/* Axis labels */}
        <text x={(PAD_L + W - PAD_R) / 2} y={H - 6}
          textAnchor="middle" fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}>
          Number of Function Evaluations (NFE)
        </text>
        <text x={13} y={(PAD_T + H - PAD_B) / 2}
          textAnchor="middle" fill={MUTED} fontSize={11} fontFamily={FONT} fontWeight={600}
          transform={`rotate(-90, 13, ${(PAD_T + H - PAD_B) / 2})`}>
          Generative Perplexity ↓
        </text>

        {/* Lines + dots per method */}
        {METHODS.map((method) => {
          const col = METHOD_COLORS[method];
          const pts = NFES.map((nfe) => selectedPoints[method][nfe]);
          const d = pts.map((p, i) =>
            `${i === 0 ? "M" : "L"}${toX(NFES[i]).toFixed(2)},${toY(p.perplexity).toFixed(2)}`
          ).join(" ");
          return (
            <g key={method}>
              <path d={d} fill="none" stroke={col} strokeWidth={2.6}
                strokeLinecap="round" strokeLinejoin="round" />
              {pts.map((pt, i) => (
                <circle key={i} cx={toX(NFES[i])} cy={toY(pt.perplexity)}
                  r={5} fill={col} stroke={BG} strokeWidth={1.5} />
              ))}
            </g>
          );
        })}

        {/* Ranking box */}
        <RankingBox ranking={ranking} W={W} H={H} PAD_R={PAD_R} PAD_T={PAD_T} PAD_B={PAD_B} />

        {/* Entropy spread warning */}
        {entropySpread > ENTROPY_SPREAD_WARN && (
          <g>
            <rect x={PAD_L + 12} y={PAD_T + 10} width={400} height={34} rx={7}
              fill="rgba(249,115,22,0.08)" stroke="#f97316" strokeWidth={1.4} opacity={0.95} />
            <text x={PAD_L + 27} y={PAD_T + 32} fill="#f97316" fontSize={11} fontWeight={700} fontFamily={FONT}>
              {`⚠  Methods at different entropies  (spread = ${entropySpread.toFixed(2)} nats)`}
            </text>
          </g>
        )}

        {/* Entropy readout per method */}
        {METHODS.map((method, i) => (
          <text key={method}
            x={PAD_L + 12 + i * 185} y={H - PAD_B - 6}
            fill={METHOD_COLORS[method]} fontSize={9} fontFamily={FONT} opacity={0.75}>
            {method}: H={positions[method].toFixed(3)}
          </text>
        ))}
      </svg>
    </div>
  );
}

function RankingBox({ ranking, W, H, PAD_R, PAD_T, PAD_B }) {
  const bx = W - PAD_R + 12;
  const by = PAD_T + 6;
  const bw = PAD_R - 20;
  const rowH = (H - PAD_T - PAD_B - 20) / 3;

  return (
    <g>
      <rect x={bx} y={by} width={bw} height={rowH * 3 + 18} rx={8}
        fill={PANEL_BG} stroke={GRID} strokeWidth={1.2} />
      <text x={bx + bw / 2} y={by + 13} textAnchor="middle"
        fill={DIM} fontSize={9} fontFamily={FONT} fontWeight={600} letterSpacing="0.06em">
        RANKING @ NFE=128
      </text>
      {ranking.map(({ method, ppl }, r) => {
        const col = METHOD_COLORS[method];
        const cy = by + 22 + r * rowH + rowH / 2;
        return (
          <g key={method}>
            <circle cx={bx + 18} cy={cy} r={11} fill={col} opacity={0.85} />
            <text x={bx + 18} y={cy + 4} textAnchor="middle"
              fill="white" fontSize={11} fontFamily={FONT} fontWeight={700}>{r + 1}</text>
            <text x={bx + 34} y={cy + 4}
              fill={col} fontSize={12} fontFamily={FONT} fontWeight={700}>{method}</text>
            <text x={bx + bw - 6} y={cy + 4} textAnchor="end"
              fill={MUTED} fontSize={9} fontFamily={FONT}>{ppl.toFixed(1)}</text>
          </g>
        );
      })}
    </g>
  );
}