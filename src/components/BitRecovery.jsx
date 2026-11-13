// Schematic, not data: how the bits of one short sentence get settled over sampling.
// Each word is a group of bit boxes. A box is empty until its bit is settled, then it
// takes the color of its value (0 or 1). Discrete fills word by word; continuous fills
// a little of every word at once. With self conditioning, both move toward filling the
// easy bits first. All settle times below are hand-set for illustration.
// Two views: "interactive" is one row of boxes that fills in place as the step changes;
// "static" stacks every step as its own row.
import { useEffect, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT } from "./SelfCondDepth.jsx";

const WORDS = ["the", "cat", "sat", "on", "the", "mat"];
const BITS = 4;          // bit boxes per word
const STEPS = 12;        // sampling steps shown (rows after the blank start)
const SC_PULL = 0.55;    // how far self conditioning pulls each path toward easy-first

// Small seeded generator so the picture is the same on every load.
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v) => Math.max(0.03, Math.min(0.99, v));

function build() {
  const r = rng(7);
  const value = WORDS.map(() => Array.from({ length: BITS }, () => (r() < 0.5 ? 0 : 1)));

  // Discrete: one whole word is settled at a time, in a random order (not left to right).
  // All of a word's bits land on the same step, so a word is either blank or complete.
  const order = [3, 0, 5, 2, 4, 1]; // rank of each word in the unmasking order
  const discrete = WORDS.map((_, w) => Array.from({ length: BITS }, () => (order[w] + 1) / WORDS.length - 1e-6));

  // Continuous: every word gains bits at about the same rate.
  const continuous = WORDS.map(() => {
    const slots = [0.125, 0.375, 0.625, 0.875].sort(() => r() - 0.5);
    return slots.map((s) => clamp(s + (r() - 0.5) * 0.16));
  });

  // Easy-first: what the model would settle first if it chose the order itself.
  const hard = [0.14, 0.74, 0.58, 0.28, 0.2, 0.86]; // short function words are easy
  const easy = WORDS.map((_, w) => Array.from({ length: BITS }, (_, b) =>
    clamp(hard[w] + (b - 1.5) * 0.07 + (r() - 0.5) * 0.06)));

  const mix = (base) => base.map((row, w) => row.map((t, b) => (1 - SC_PULL) * t + SC_PULL * easy[w][b]));
  // Keep only the order of the settle times, then spread them evenly over the run. Every
  // panel then settles the same number of bits per step, and only *where* they land differs.
  const even = (times) => {
    const flat = times.flat().map((t, i) => [t, i]).sort((x, y) => x[0] - y[0]);
    const out = new Array(flat.length);
    flat.forEach(([, i], rank) => { out[i] = (rank + 0.5) / flat.length; });
    return times.map((row, w) => row.map((_, b) => out[w * BITS + b]));
  };
  return { value, discrete, continuous: even(continuous), discreteSc: even(mix(discrete)), continuousSc: even(mix(continuous)) };
}
const D = build();

const BOX = 12, GAP = 2, WORD_GAP = 9, LEFT = 44, RIGHT = 40;
const wordW = BITS * BOX + (BITS - 1) * GAP;
const GRID_W = WORDS.length * wordW + (WORDS.length - 1) * WORD_GAP;
const TOTAL = WORDS.length * BITS;
const stepOf = (t) => Math.max(1, Math.ceil(t * STEPS)); // step at which a bit is settled
const settled = (times, k) => times.flat().filter((t) => k >= stepOf(t)).length;

// One row of the sentence's bit boxes, as they stand at step k.
function Row({ times, k, x0, y, h }) {
  const colors = [P.duo, P.accent2];
  return WORDS.map((word, w) => times[w].map((t, b) => {
    const at = stepOf(t), on = k >= at;
    return (
      <rect key={`${w}-${b}`} x={x0 + w * (wordW + WORD_GAP) + b * (BOX + GAP)} y={y} width={BOX} height={h} rx={2.5}
        fill={on ? colors[D.value[w][b]] : "transparent"} stroke={on ? colors[D.value[w][b]] : P.line2} strokeWidth={0.8}
        style={{ transition: "fill 250ms, stroke 250ms" }}>
        <title>{`"${word}", bit ${b + 1}: value ${D.value[w][b]}, settled at step ${at}`}</title>
      </rect>
    );
  }));
}

function Words({ x0, y }) {
  return WORDS.map((word, w) => (
    <text key={w} x={x0 + w * (wordW + WORD_GAP) + wordW / 2} y={y} fill={P.muted} fontSize={11} textAnchor="middle">{word}</text>
  ));
}

// Interactive view: a single row that changes in place.
function LivePanel({ title, blurb, times, shown }) {
  const PAD = 6, W = GRID_W + 2 * PAD, H = 50;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.text }}>{title}</div>
      <div style={{ fontSize: 12, color: P.muted, margin: "2px 0 6px", lineHeight: 1.4 }}>{blurb}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}
        role="img" aria-label={`${title}: bits of the sentence settled at step ${shown} of ${STEPS}`}>
        <Words x0={PAD} y={12} />
        <Row times={times} k={shown} x0={PAD} y={20} h={22} />
      </svg>
      <div style={{ fontFamily: FONT, fontSize: 11, color: P.dim2, marginTop: 2 }}>{settled(times, shown)} of {TOTAL} bits settled</div>
    </div>
  );
}

// Static view: every step as its own row, first step at the top.
function GridPanel({ title, blurb, times }) {
  const ROW = 15, TOP = 34, W = LEFT + GRID_W + RIGHT, H = TOP + (STEPS + 1) * ROW + 4;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.text }}>{title}</div>
      <div style={{ fontSize: 12, color: P.muted, margin: "2px 0 6px", lineHeight: 1.4 }}>{blurb}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}
        role="img" aria-label={`${title}: bits of the sentence settled at each sampling step, one row per step`}>
        <text x={LEFT - 8} y={12} fill={P.dim2} fontSize={9.5} textAnchor="end">step</text>
        <text x={LEFT + GRID_W + 8} y={12} fill={P.dim2} fontSize={9.5}>bits</text>
        <Words x0={LEFT} y={TOP - 8} />
        {Array.from({ length: STEPS + 1 }, (_, k) => {
          const y = TOP + k * ROW;
          return (
            <g key={k}>
              <text x={LEFT - 8} y={y + BOX - 2.5} fill={P.dim2} fontSize={9.5} textAnchor="end">{k}</text>
              <Row times={times} k={k} x0={LEFT} y={y} h={BOX - 1} />
              <text x={LEFT + GRID_W + 8} y={y + BOX - 2.5} fill={P.dim2} fontSize={9.5}>{settled(times, k)}/{TOTAL}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Key() {
  const item = (fill, stroke, label) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width={12} height={12}><rect x={0.5} y={0.5} width={11} height={11} rx={2.5} fill={fill} stroke={stroke} strokeWidth={0.8} /></svg>
      {label}
    </span>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "4px 0 12px", fontFamily: FONT, fontSize: 11, color: P.muted }}>
      {item("transparent", P.line2, "bit not settled yet")}
      {item(P.duo, "none", "settled, value 0")}
      {item(P.accent2, "none", "settled, value 1")}
    </div>
  );
}

const btn = () => ({
  border: `1px solid ${P.line2}`, background: P.inset, color: P.muted, cursor: "pointer",
  borderRadius: 999, padding: "5px 12px", fontFamily: FONT, fontSize: 11.5,
});

// sc = false: two panels (discrete, continuous), no self conditioning.
// sc = true: a 2 x 2 grid. Rows are the method, columns are without / with self conditioning.
function BitRecoveryInner({ sc = false }) {
  const [view, setView] = useState("live");
  const [shown, setShown] = useState(STEPS / 2); // start halfway, where the paths differ most
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    if (shown >= STEPS) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setShown((s) => s + 1), 500);
    return () => clearTimeout(id);
  }, [playing, shown]);
  const live = view === "live";
  const play = () => { setShown(0); setPlaying(true); };
  const Panel = live ? LivePanel : GridPanel;
  const what = `Each word is ${BITS} bit boxes. A box is empty until its bit is settled, then takes the color of its value.`;
  const cells = [
    { title: "Discrete (masked)", blurb: "Bits arrive one whole word at a time.", times: D.discrete, sc: false },
    { title: "Discrete + self conditioning", blurb: "Still word by word, but hard words fill in gradually.", times: D.discreteSc, sc: true },
    { title: "Continuous", blurb: "Bits arrive evenly across words.", times: D.continuous, sc: false },
    { title: "Continuous + self conditioning", blurb: "Still spread out, but easy words finish early.", times: D.continuousSc, sc: true },
  ].filter((c) => sc || !c.sc);
  const colHead = { fontFamily: FONT, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: P.accent };
  return (
    <Frame
      kicker="Illustration · not measured data"
      title={sc ? "With self conditioning, the two paths look more alike" : "Two ways to settle the bits of a sentence"}
      subtitle={`${sc ? "Rows: the method. Columns: without and with self conditioning. " : ""}${live
        ? `${what} Press Play, or drag the step slider, to move from the start of sampling (nothing settled) to the end (everything settled).`
        : `${what} Each row of boxes is one sampling step, from step 0 at the top (nothing settled) to step ${STEPS} at the bottom (everything settled).`}`}
      controls={<>
        <Pills value={view} onChange={(v) => { setPlaying(false); setView(v); }} options={[{ id: "live", label: "Interactive" }, { id: "static", label: "Static" }]} />
        {live && <>
          <button type="button" style={btn()} onClick={play}>{playing ? "Playing…" : "Play"}</button>
          <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: FONT, fontSize: 11.5, color: P.dim2 }}>
            step
            <input type="range" min={0} max={STEPS} value={shown} aria-label="Sampling step shown"
              onChange={(e) => { setPlaying(false); setShown(Number(e.target.value)); }} style={{ accentColor: P.accent, width: 140 }} />
            <span style={{ minWidth: 52 }}>{shown} of {STEPS}</span>
          </label>
        </>}
      </>}
      note={sc
        ? "A sketch of the idea, with hand-set timings. The boxes are drawn as separate bits for simplicity; in practice the bits of different words overlap, since settling one word also tells the model something about the others. Without self conditioning (left), the two methods look very different. With it (right), each keeps its own bias, but both settle the easy bits first, so they look more alike."
        : "A sketch of the idea, with hand-set timings. The boxes are drawn as separate bits for simplicity; in practice the bits of different words overlap, since settling one word also tells the model something about the others. Discrete settles one whole word at a time: a word is either blank or complete. Continuous settles a little of every word at each step. Both settle all the bits over the same number of steps."}
    >
      <Key />
      {sc && (
        <div className="bitrec-colheads" style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "0 28px", marginBottom: 6 }}>
          <div style={colHead}>No self conditioning</div>
          <div style={colHead}>With self conditioning</div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: sc ? "repeat(2, minmax(0, 1fr))" : "repeat(auto-fit, minmax(280px, 1fr))", gap: "18px 28px" }}>
        {cells.map((c) => <Panel key={c.title} title={c.title} blurb={c.blurb} times={c.times} shown={shown} />)}
      </div>
    </Frame>
  );
}

export const BitRecovery = withVizTheme(BitRecoveryInner);
export default BitRecovery;
