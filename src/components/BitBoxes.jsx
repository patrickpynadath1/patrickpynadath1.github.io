// Schematic, not data: the "stacks and colors" picture of bits used in Part 3.
// Each position is a stack of small boxes. The color of a box says which bit it is: two
// boxes of the same color are the same bit, seen from two positions. A box is unknown
// (solid color), settled by a match but not yet worked out by the model (striped), or
// known (gray). Every layout, order and timing below is hand-set or seeded for illustration.
import { useEffect, useId, useMemo, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, Pills, FONT } from "./SelfCondDepth.jsx";

import { rng, simulate } from "./bitBoxSim.js";

// The color of a box says which bit it is. Two boxes of the same color are the same bit,
// wherever they sit. A bit that only one position holds has a color that appears once.
const PAL = {
  r: () => P.mdlm, b: () => P.duo, g: () => P.candi, y: () => P.warn,
  p: () => P.accent, k: () => `rgb(${P.pinkRgb})`,
  // Cyan has no slot in the shared theme; pick the step for the current theme.
  c: () => (P.bg === "#121321" ? "#5cc8d6" : "#127a86"),
};
const NAME = { r: "red", b: "blue", g: "green", y: "yellow", p: "purple", k: "pink", c: "cyan" };
const huesFor = (col) => (Array.isArray(col) ? col : [col]).map((c) => PAL[c]());

// Layouts, bottom box first. Each entry is a color key; ["r","b"] is a blend of two bits.
// INTRO is the two-color starting picture: a stack can hold a color several times, and
// the only point is that boxes of one color are tied together. In every other layout no
// stack holds the same color twice, so one color is exactly one bit.
const INTRO = [
  ["r", "r", "r"],
  ["r", "b", "b", "b", "b"],
  ["b", "r"],
  ["b", "b", "r", "b"],
  ["r", "r", "b"],
];
const BASE = [
  ["r", "b"],
  ["r", "y", "p", "g"],
  ["b", "y", "c"],
  ["r", "g", "k"],
  ["p", "k"],
];
const LOCAL = [
  ["r", "b"],
  ["b", "g", "y"],
  ["y", "p"],
  ["p", "k", "c"],
  ["c"],
];
const WIDE = [
  ["r", "b", "g"],
  ["r", "b", "y", "p"],
  ["r", "g"],
  ["r", "y", "p", "k"],
  ["r", "b", "g", "y"],
];
// CHAIN: blends link the bits in a chain, so working one bit out can take several rounds.
// Position 2 holds red XOR blue, position 3 blue XOR green, position 4 green XOR pink.
const CHAIN = [
  ["r", "y"],
  [["r", "b"], "p"],
  [["b", "g"], "y"],
  [["g", "k"], "p"],
  ["k", "b"],
];
const MOSTLY_PRIVATE = [
  ["r", "b"],
  ["g", "y"],
  ["p"],
  ["k", "y"],
  ["c"],
];

const count = (stacks) => {
  const flat = stacks.flat();
  const colors = new Set(flat.filter((c) => !Array.isArray(c)));
  return { all: flat.length, need: colors.size, shared: flat.length - colors.size };
};

// ─── Drawing ──────────────────────────────────────────────────────────────────
const BW = 30, BH = 13, G = 2, SG = 14;
const stacksW = (stacks) => stacks.length * BW + (stacks.length - 1) * SG;
const stacksH = (stacks) => Math.max(...stacks.map((s) => s.length)) * (BH + G);
let clipSeq = 0;

// One box. st:
//   "u" unknown: solid color.
//   "d" settled by a match, not yet worked out by the model: stripes in its color.
//   "k" known: gray.
//   "e" not written to the state yet: empty outline.
//   "s" a token is shown, but it may be wrong (uniform): colored outline with a "?".
// amt (0..1): partly known. Gray fills the box from the bottom as it becomes known.
// twice: paid for a second time, marked "×2".
function Box({ x, y, col, hue = P.dim, hue2, st = "u", amt, twice, dashed, onClick }) {
  const cid = `bbclip${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const blend = Array.isArray(col);
  const tr = { transition: "fill 250ms, stroke 250ms, opacity 250ms" };
  const solid = blend
    ? (<>
      <rect x={x} y={y} width={BW} height={BH} rx={2.5} fill={hue} />
      <path d={`M${x + BW / 2},${y} H${x + BW - 2.5} Q${x + BW},${y} ${x + BW},${y + 2.5} V${y + BH - 2.5} Q${x + BW},${y + BH} ${x + BW - 2.5},${y + BH} H${x + BW / 2} Z`} fill={hue2 || hue} />
    </>)
    : <rect x={x} y={y} width={BW} height={BH} rx={2.5} fill={hue} style={tr} />;
  let body;
  if (amt !== undefined && amt < 1) {
    const h = BH * Math.max(0, amt);
    body = (<>
      <clipPath id={cid}><rect x={x} y={y} width={BW} height={BH} rx={2.5} /></clipPath>
      <g clipPath={`url(#${cid})`}>
        {solid}
        <rect x={x} y={y + BH - h} width={BW} height={h} fill={P.grid} style={{ transition: "y 250ms, height 250ms" }} />
      </g>
      <rect x={x + 0.4} y={y + 0.4} width={BW - 0.8} height={BH - 0.8} rx={2.5} fill="none" stroke={dashed ? P.text : P.line2} strokeWidth={dashed ? 1.1 : 0.8} strokeDasharray={dashed ? "3 2" : undefined} />
    </>);
  } else if (st === "k" || amt !== undefined) {
    body = <rect x={x} y={y} width={BW} height={BH} rx={2.5} fill={P.grid} stroke={P.line2} strokeWidth={0.8} style={tr} />;
  } else if (st === "d") {
    body = (<>
      <clipPath id={cid}><rect x={x} y={y} width={BW} height={BH} rx={2.5} /></clipPath>
      <g clipPath={`url(#${cid})`}>
        <rect x={x} y={y} width={BW} height={BH} fill={P.panel} />
        {[-12, -4, 4, 12, 20, 28].map((d) => (
          <line key={d} x1={x + d} y1={y + BH} x2={x + d + BH} y2={y} stroke={hue} strokeWidth={2.2} />
        ))}
      </g>
      <rect x={x + 0.7} y={y + 0.7} width={BW - 1.4} height={BH - 1.4} rx={2.5} fill="none" stroke={hue} strokeWidth={1.4} />
    </>);
  } else if (st === "e") {
    body = <rect x={x + 0.5} y={y + 0.5} width={BW - 1} height={BH - 1} rx={2.5} fill="none" stroke={P.line2} strokeWidth={1} />;
  } else if (st === "s") {
    body = (<>
      <rect x={x + 0.8} y={y + 0.8} width={BW - 1.6} height={BH - 1.6} rx={2.5} fill="none" stroke={hue} strokeWidth={1.6} />
      <text x={x + BW / 2} y={y + BH - 3.2} textAnchor="middle" fontSize={8.5} fontWeight={700} fill={hue}>?</text>
    </>);
  } else {
    body = solid;
  }
  return (
    <g onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      {body}
      {twice && <text x={x + BW / 2} y={y + BH - 3.2} textAnchor="middle" fontSize={8} fontWeight={700} fill={P.text} style={{ pointerEvents: "none" }}>×2</text>}
    </g>
  );
}

// view(si, bi) returns { st, amt, twice, col } for one box. col overrides the layout's color.
function Stacks({ stacks, view, x0 = 0, yBase, numbers = true, mark, onPick, crossed }) {
  return (
    <g>
      {stacks.map((s, si) => s.map((c, bi) => {
        const v = (view && view(si, bi)) || {};
        const col = v.col !== undefined ? v.col : c;
        const [hue, hue2] = huesFor(col);
        return <Box key={`${si}-${bi}`} x={x0 + si * (BW + SG)} y={yBase - (bi + 1) * (BH + G) + G}
          col={col} hue={hue} hue2={hue2} st={v.st} amt={v.amt} twice={v.twice} dashed={v.dashed}
          onClick={onPick ? () => onPick(si, bi) : undefined} />;
      }))}
      {crossed && stacks.map((s, si) => crossed(si) && (
        <path key={`x${si}`} transform={`translate(${x0 + si * (BW + SG) + BW / 2}, ${yBase - s.length * (BH + G) - 6})`}
          d="M-4,-4 L4,4 M4,-4 L-4,4" stroke={P.text} strokeWidth={2} strokeLinecap="round" />
      ))}
      {numbers && stacks.map((_, si) => (
        <text key={si} x={x0 + si * (BW + SG) + BW / 2} y={yBase + 13} textAnchor="middle" fontSize={9.5}
          fill={mark && mark.includes(si) ? P.text : P.dim2} fontWeight={mark && mark.includes(si) ? 700 : 400}>{si + 1}</text>
      ))}
    </g>
  );
}

function StackSvg({ stacks, view, label, mark, pad = 8, onPick, crossed, rowLabel }) {
  const top = (crossed ? 12 : 0) + (rowLabel ? 14 : 0);
  const W = stacksW(stacks) + 2 * pad, H = stacksH(stacks) + 22 + top;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W * 1.5, height: "auto", display: "block", fontFamily: FONT }} role="img" aria-label={label}>
      {rowLabel && <text x={pad} y={10} fontSize={9} fill={P.muted} letterSpacing="0.08em">{rowLabel}</text>}
      <Stacks stacks={stacks} view={view} x0={pad} yBase={H - 18} mark={mark} onPick={onPick} crossed={crossed} />
    </svg>
  );
}

function Key({ items }) {
  const sw = (props) => (
    <svg width={26} height={13} style={{ flex: "none" }}>
      <g transform={`scale(${24 / BW}, ${11 / BH}) translate(1,1)`}><Box x={0} y={0} hue={P.mdlm} hue2={P.duo} {...props} /></g>
    </svg>
  );
  const all = {
    unknown: [sw({ col: "r", st: "u" }), "unknown (same color = same bit)"],
    dim: [sw({ col: "r", st: "d" }), "fixed by what is known, not yet worked out by the model"],
    known: [sw({ col: "r", st: "k" }), "known"],
    twice: [sw({ col: "r", st: "k", twice: true }), "paid for, though already fixed"],
    blend: [sw({ col: ["r", "b"], st: "u" }), "blend: fixed by the red and blue bits together"],
    empty: [sw({ col: "r", st: "e" }), "state row: not written yet"],
    partial: [sw({ col: "r", amt: 0.5 }), "partly known: gray fills in as it becomes known"],
    shown: [sw({ col: "r", st: "s" }), "a token is shown, but it may be wrong"],
    shownPartial: [sw({ col: "r", amt: 0.5, dashed: true }), "uniform: partly known, and the shown token may be wrong"],
  };
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "4px 0 12px", fontFamily: FONT, fontSize: 11, color: P.muted }}>
      {items.map((id) => <span key={id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>{all[id][0]}{all[id][1]}</span>)}
    </div>
  );
}

const btn = () => ({
  border: `1px solid ${P.line2}`, background: P.inset, color: P.muted, cursor: "pointer",
  borderRadius: 999, padding: "5px 12px", fontFamily: FONT, fontSize: 11.5,
});
const small = () => ({ fontFamily: FONT, fontSize: 11, color: P.dim2, lineHeight: 1.5 });
const head = () => ({ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: P.text });
const blurbStyle = () => ({ fontSize: 12, color: P.muted, margin: "2px 0 6px", lineHeight: 1.4 });
const strong = (v) => <strong style={{ color: P.text }}>{v}</strong>;

function useStepper(max, start = 0) {
  const [k, setK] = useState(start);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return undefined;
    if (k >= max) { setPlaying(false); return undefined; }
    const id = setTimeout(() => setK((s) => s + 1), 800);
    return () => clearTimeout(id);
  }, [playing, k, max]);
  const shown = Math.min(k, max);
  const controls = (
    <>
      <button type="button" style={btn()} onClick={() => { setK(0); setPlaying(true); }}>{playing ? "Playing…" : "Play"}</button>
      <button type="button" style={btn()} onClick={() => { setPlaying(false); setK(Math.max(0, shown - 1)); }} aria-label="Previous step">Back</button>
      <button type="button" style={btn()} onClick={() => { setPlaying(false); setK(Math.min(max, shown + 1)); }} aria-label="Next step">Next</button>
      <span style={{ ...small(), alignSelf: "center" }}>step {shown} of {max}</span>
    </>
  );
  return { k: shown, controls, reset: () => { setPlaying(false); setK(0); } };
}

// ─── Opening rules ────────────────────────────────────────────────────────────
// The simulation lives in bitBoxSim.js. Each step: the model's pass (a bounded number of
// peeling rounds over the written boxes), then the sampler writes boxes into the state.
// Writing a box the model has worked out costs nothing; any other box costs one bit.
// The Shannon tally charges a box only if the boxes written before it do not fix it.

// ─── Figure 1: the setup (two colors) ────────────────────────────────────────
// One position is opened per step, left to right. Its boxes turn gray. Every other box of
// a color learned on that step fades, and turns gray on the next step.
function BoxSetupInner() {
  const { learnedAt, openedAt, last } = useMemo(() => {
    const learnedAt = {}, openedAt = {};
    let t = 0;
    while (Object.keys(learnedAt).length < 2) {
      t += 1;
      openedAt[t - 1] = t;
      INTRO[t - 1].forEach((c) => { if (learnedAt[c] === undefined) learnedAt[c] = t; });
    }
    return { learnedAt, openedAt, last: t + 1 };
  }, []);
  const s = useStepper(last);
  const k = s.k;
  const status = (si, c) => {
    if (openedAt[si] !== undefined && openedAt[si] <= k) return "k";
    if (learnedAt[c] !== undefined && learnedAt[c] < k) return "k";
    if (learnedAt[c] === k) return "d";
    return "u";
  };
  const all = INTRO.flat().length;
  const knownBoxes = INTRO.flatMap((st, si) => st.map((c) => status(si, c))).filter((x) => x !== "u").length;
  const opened = Object.values(openedAt).filter((t) => t <= k).length;
  const learned = Object.values(learnedAt).filter((t) => t <= k).length;
  const pick = openedAt[k - 1] === k ? [k - 1] : [];
  const fresh = Object.keys(learnedAt).filter((c) => learnedAt[c] === k).map((c) => NAME[c]);
  let caption;
  if (k === 0) caption = "Start: nothing is known, so every box is in color. Press Next to open position 1.";
  else if (k >= last) caption = `Everything is known after opening ${opened} positions. There are two colors, so two pieces of information decide all ${all} boxes.`;
  else if (pick.length) caption = `Position ${k} is opened: its boxes turn gray. ${fresh.length ? `Every other ${fresh.join(" and ")} box is now settled, so it is striped. It turns gray on the next step for free.` : "Its colors were already known, so nothing else changes."}`;
  else caption = "Nothing is left to open. The striped boxes turn gray.";
  return (
    <Frame kicker="Illustration · not measured data" title="Each position is a stack of boxes"
      subtitle="Five positions and two colors. Boxes of the same color carry the same information: once one of them is known, the others follow."
      controls={s.controls}
      note="Counting boxes overcounts, because many boxes repeat the same information. The sequence only needs each piece of information once.">
      <Key items={["unknown", "dim", "known"]} />
      <StackSvg stacks={INTRO} view={(si, bi) => ({ st: status(si, INTRO[si][bi]) })} mark={pick}
        label={`Five stacks of boxes in two colors, after step ${k}. ${knownBoxes} of ${all} boxes known.`} />
      <div style={{ ...small(), marginTop: 6, color: P.muted, minHeight: 50 }}>
        positions opened: {strong(opened)} · colors learned: {strong(`${learned} of 2`)} · boxes known: {strong(`${knownBoxes} of ${all}`)}<br />
        {caption}
      </div>
    </Frame>
  );
}
export const BoxSetup = withVizTheme(BoxSetupInner);

// ─── Figures 2 and 3: the discount ───────────────────────────────────────────
// One box is opened per step, by clicking it or with Next, until every box is known.
// Every other box of the same color is settled on that step.
function BoxDiscountInner({ many = false }) {
  // many: the seven-color layout, where no stack holds a color twice and one color is one bit.
  const layout = many ? BASE : INTRO;
  const [seq, setSeq] = useState([]); // one entry per step: the key opened, or "" for a step that only works out
  const [playing, setPlaying] = useState(false);
  const ids = layout.flatMap((st, si) => st.map((c, bi) => ({ si, bi, c, key: `${si}-${bi}` })));
  const at = (si, bi) => ids.find((b) => b.si === si && b.bi === bi);
  const step = seq.length;
  const openedAt = {}, knownAt = {};
  seq.forEach((key, i) => {
    if (!key) return;
    openedAt[key] = i + 1;
    const c = ids.find((b) => b.key === key).c;
    if (knownAt[c] === undefined) knownAt[c] = i + 1;
  });
  const status = (b) => {
    if (openedAt[b.key]) return "k";
    if (knownAt[b.c] !== undefined) return knownAt[b.c] < step ? "k" : "d";
    return "u";
  };
  const unknown = ids.filter((b) => status(b) === "u");
  const settled = ids.filter((b) => status(b) === "d");
  const done = !unknown.length && !settled.length;
  const open = (b) => setSeq((q) => [...q, b.key]);
  const next = () => { if (unknown.length) open(unknown[0]); else if (settled.length) setSeq((q) => [...q, ""]); };
  useEffect(() => {
    if (!playing) return undefined;
    if (done) { setPlaying(false); return undefined; }
    const id = setTimeout(next, 600);
    return () => clearTimeout(id);
  });
  const reset = () => { setPlaying(false); setSeq([]); };
  const paid = seq.filter(Boolean).length;
  const free = ids.filter((b) => !openedAt[b.key] && status(b) !== "u").length;
  const lastKey = seq[seq.length - 1];
  const last = lastKey ? ids.find((b) => b.key === lastKey) : null;
  const need = count(layout).need;
  let caption;
  if (done) caption = `Everything is known. You opened ${paid} boxes, one for each color. The other ${free} came free.`;
  else if (!step) caption = "Start: every box is unknown. Click any box to open it, or press Next.";
  else if (!unknown.length) caption = "Nothing is left to open. Press Next: the striped boxes turn gray.";
  else if (settled.length) caption = `Opened a ${NAME[last.c]} box in position ${last.si + 1}. Every other ${NAME[last.c]} box is settled, so it is striped. Striped boxes turn gray on the next step and cost nothing.`;
  else caption = `Opened a ${NAME[last.c]} box in position ${last.si + 1}. No other box needed it, so nothing else changes.`;
  return (
    <Frame kicker="Illustration · not measured data" title={many ? "The same picture with more colors" : "Open one box, and its matches come free"}
      subtitle={many
        ? "Seven colors, and no stack holds a color twice, so each color is exactly one bit. Click a box to open it, or press Next."
        : "Open the boxes one at a time until all of them are known. Click a box to open it, or press Next."}
      controls={<>
        <button type="button" style={btn()} onClick={() => { if (done) setSeq([]); setPlaying(true); }}>{playing ? "Playing…" : "Play"}</button>
        <button type="button" style={btn()} onClick={() => { setPlaying(false); setSeq((q) => q.slice(0, -1)); }} aria-label="Previous step">Back</button>
        <button type="button" style={btn()} onClick={() => { setPlaying(false); next(); }} aria-label="Next step">Next</button>
        <button type="button" style={btn()} onClick={reset}>Reset</button>
      </>}
      note={many
        ? "A color that appears once is a bit only one position holds: opening it frees nothing. A color in several stacks is a shared bit: opening it once frees the rest. Opened one at a time, the boxes you pay for always add up to the number of colors."
        : "Three states: solid color is unknown, striped is settled by a match but not yet worked out by the model, gray is known."}>
      <Key items={["unknown", "dim", "known"]} />
      <StackSvg stacks={layout} view={(si, bi) => ({ st: status(at(si, bi)) })}
        mark={last ? [last.si] : undefined} onPick={(si, bi) => { const b = at(si, bi); if (status(b) === "u") { setPlaying(false); open(b); } }}
        label={`Five stacks of boxes in ${many ? "seven" : "two"} colors. ${paid} boxes opened, ${free} came free, ${unknown.length} still unknown.`} />
      <div style={{ ...small(), marginTop: 6, color: P.muted, minHeight: 50 }}>
        opened: {strong(paid)} · came free: {strong(free)} · still unknown: {strong(unknown.length)}{many ? <> · colors: {strong(need)}</> : null}<br />
        {caption}
      </div>
    </Frame>
  );
}
export const BoxDiscount = withVizTheme(BoxDiscountInner);

// ─── The opening figures ─────────────────────────────────────────────────────
const SHAPES = [
  { id: "base", label: "Example", stacks: BASE, text: "The seven-color example from above." },
  { id: "local", label: "Local", stacks: LOCAL, text: "Each shared bit sits in two neighboring positions." },
  { id: "wide", label: "Sequence-wide", stacks: WIDE, text: "One shared bit runs through every position, and the others span several." },
  { id: "private", label: "Mostly private", stacks: MOSTLY_PRIVATE, text: "Almost nothing is shared, so almost nothing comes free." },
];
const RULES = [
  { id: "ar", per: 1, label: "Autoregressive", blurb: "One whole position per step, left to right.",
    gate: (pk) => `writes position ${pk[0] + 1}` },
  { id: "masked", per: 2, label: "Masked", blurb: "Whole positions, in a random order.",
    gate: (pk) => `writes position${pk.length > 1 ? "s" : ""} ${pk.map((x) => x + 1).join(" and ")}` },
  { id: "cont", per: 0, label: "Continuous", blurb: "One box in every position per step, so every position fills in a little at a time.",
    gate: () => "writes one box in every position" },
];
const ruleOf = (id) => RULES.find((x) => x.id === id);
// Masked can open one or two positions per step.
function useRule(initialRule, initialPer) {
  const [rule, setRule] = useState(initialRule);
  const [per, setPer] = useState(initialPer);
  const R = ruleOf(rule);
  const n = rule === "masked" ? per : R.per;
  const blurb = rule === "masked" ? `${n === 1 ? "One whole position" : "Two whole positions"} per step, in a random order.` : R.blurb;
  const pills = (reset) => (<>
    <Pills value={rule} onChange={(v) => { reset(); setRule(v); }} options={RULES.filter((x) => x.id !== "cont")} />
    {rule === "masked" && <Pills value={String(per)} onChange={(v) => { reset(); setPer(Number(v)); }}
      options={[{ id: "1", label: "1 position per step" }, { id: "2", label: "2 positions per step" }]} />}
  </>);
  return { rule, R, n, blurb, pills };
}

// Layer 1: boxes only. One rule at a time; a shape switch shows other layouts.
function BoxThreeWaysInner() {
  const { rule, R, n, blurb, pills } = useRule("masked", 2);
  const [shape, setShape] = useState("base");
  const L = SHAPES.find((x) => x.id === shape);
  const sim = useMemo(() => simulate(L.stacks, rule, n, 5), [L, rule, n]);
  const s = useStepper(sim.last);
  const k = s.k, tw = sim.twice(k);
  const sw = (set) => (v) => { s.reset(); set(v); };
  return (
    <Frame kicker="Illustration · not measured data" title="Opening the boxes: autoregressive and masked"
      subtitle={`Pick a rule, then press Play or Next. ${L.text}`}
      controls={<>
        {pills(s.reset)}
        <Pills value={shape} onChange={sw(setShape)} options={SHAPES} />
        {s.controls}
      </>}
      note="Two counts. The Shannon count charges a box only if nothing written before it fixes it; it always ends at the number of bits, whatever the order. The model's count charges every box the model had not worked out when it was written; it can never be smaller. Autoregressive never pays extra, but needs one step per position. When two boxes of one color are written on the same step, each is drawn without the other, so the bit is paid twice, and the two draws could even disagree.">
      <Key items={["unknown", "dim", "known", "twice"]} />
      <div style={head()}>{R.label}</div>
      <div style={blurbStyle()}>{blurb}</div>
      <StackSvg stacks={L.stacks} view={sim.view(k)} mark={sim.picks(k)}
        label={`${R.label}, step ${k} of ${sim.last}. The model has paid ${sim.paid(k)} bits so far; the Shannon count is ${sim.shannon(k)} of ${sim.need}.`} />
      <div style={{ ...small(), marginTop: 4 }}>
        Shannon bits so far: {strong(sim.shannon(k))} of {strong(sim.need)} · bits the model paid: {strong(sim.paid(k))} · paid though already fixed: {strong(tw)} · steps: {strong(sim.last)}
      </div>
    </Frame>
  );
}
export const BoxThreeWays = withVizTheme(BoxThreeWaysInner);

// The two-row picture: the model's view on top, the sampler, the state below.
function TwoRows({ stacks, sim, k, R, topLabel }) {
  const pad = 8, W = stacksW(stacks) + 2 * pad, h = stacksH(stacks);
  const y1 = 16 + h, mid = y1 + 26, y2 = mid + 44 + h, H = y2 + 20;
  const pick = sim.picks(k);
  const gateText = k === 0 ? "nothing written yet" : k >= sim.last && !pick.length ? "done" : R.gate(pick);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", maxWidth: W * 1.5, height: "auto", display: "block", fontFamily: FONT }} role="img"
      aria-label={`${R.label}, step ${k}. The model's view above, the state below. Sampler: ${gateText}.`}>
      <text x={pad} y={10} fontSize={9} fill={P.muted} letterSpacing="0.06em">{topLabel || "THE MODEL'S VIEW"}</text>
      <Stacks stacks={stacks} view={sim.view(k)} x0={pad} yBase={y1} numbers={false} />
      <line x1={W / 2} y1={y1 + 5} x2={W / 2} y2={mid + 32} stroke={P.dim} strokeWidth={1.2} />
      <path d={`M${W / 2 - 4},${mid + 27} L${W / 2},${mid + 33} L${W / 2 + 4},${mid + 27}`} fill="none" stroke={P.dim} strokeWidth={1.2} />
      <rect x={pad} y={mid - 4} width={W - 2 * pad} height={20} rx={10} fill={P.inset} stroke={P.line2} />
      <text x={W / 2} y={mid + 9.5} textAnchor="middle" fontSize={9} fill={P.muted}>sampler: {gateText}</text>
      <text x={pad} y={mid + 40} fontSize={9} fill={P.muted} letterSpacing="0.06em">THE STATE</text>
      <Stacks stacks={stacks} view={sim.state(k)} x0={pad} yBase={y2} mark={pick} />
    </svg>
  );
}

// Layer 2: the sampler as a gate.
function BoxLoopInner() {
  const { rule, R, n, blurb, pills } = useRule("masked", 2);
  const sim = useMemo(() => simulate(BASE, rule, n, 5), [rule, n]);
  const s = useStepper(sim.last);
  const k = s.k;
  return (
    <Frame kicker="Illustration · not measured data" title="The model's view, the sampler and the state"
      subtitle="Top row: the model's view of every box. Bottom row: the state, which holds only what the sampler has written. An empty outline is a box not written yet. Pick a rule, then press Next."
      controls={<>
        {pills(s.reset)}
        {s.controls}
      </>}
      note="The gray boxes in the top row that the state lacks are ones the model has worked out but the sampler has not written yet. The state does imply them, so a model with no limit on how much it works out per pass finds them again on every step. The loss starts once that is limited, further below.">
      <Key items={["unknown", "dim", "known", "twice", "empty"]} />
      <div style={head()}>{R.label}</div>
      <div style={blurbStyle()}>{blurb}</div>
      <TwoRows stacks={BASE} sim={sim} k={k} R={R} />
      <div style={{ ...small(), marginTop: 4 }}>
        Shannon bits so far: {strong(sim.shannon(k))} of {strong(sim.need)} · bits the model paid: {strong(sim.paid(k))} · worked out by the model but not in the state: {strong(sim.ahead(k))}
      </div>
    </Frame>
  );
}
export const BoxLoop = withVizTheme(BoxLoopInner);

// Layer 3: the model's pass runs a fixed number of peeling rounds, with and without self
// conditioning, side by side. The layout links bits through blends, so some bits need
// several rounds to work out.
const ROUNDS = [{ id: "1", label: "1 round per pass" }, { id: "2", label: "2 rounds per pass" }, { id: "inf", label: "no limit" }];
function BoxCapacityInner() {
  const { rule, R, n, blurb, pills } = useRule("masked", 1);
  const [rounds, setRounds] = useState("1");
  const D = rounds === "inf" ? Infinity : Number(rounds);
  const sims = useMemo(() => [false, true].map((sc) => simulate(CHAIN, rule, n, 9, { rounds: D, sc })), [rule, n, D]);
  const s = useStepper(Math.max(...sims.map((x) => x.last)));
  const k = s.k;
  const sw = (set) => (v) => { s.reset(); set(v); };
  const limitText = D === Infinity
    ? "Each pass works out everything the state fixes."
    : `Each pass runs ${D} round${D > 1 ? "s" : ""} of working out. One round turns a box gray when it is a copy of a known bit, or a blend with one unknown ingredient left.`;
  const [off, on] = sims;
  return (
    <Frame kicker="Illustration · rounds per pass are this sketch's stand-in for compute" title="A model that can only work so far per pass"
      subtitle="Blends chain the bits together: red fixes blue through position 2, blue fixes green through position 3, and so on. Each pass can follow the chain only a few links. Left: without self conditioning. Right: with it."
      controls={<>
        {pills(s.reset)}
        <Pills value={rounds} onChange={sw(setRounds)} options={ROUNDS} />
        {s.controls}
      </>}
      note="Striped boxes are fixed by the state but not yet worked out by the model. Without self conditioning, each pass starts again from the state and reaches only a few links. With it, the model starts from what it worked out last time, so the links add up across passes. Self conditioning writes nothing new: the Shannon count is the same on both sides. It only lowers what the model pays, and never below the Shannon count. With no limit, the two sides match.">
      <Key items={["unknown", "blend", "dim", "known", "twice", "empty"]} />
      <div style={head()}>{R.label}</div>
      <div style={blurbStyle()}>{blurb} {limitText}</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px 24px" }}>
        {[{ sim: off, title: "Without self conditioning", top: "THE MODEL'S VIEW · rebuilt" },
          { sim: on, title: "With self conditioning", top: "THE MODEL'S VIEW · kept" }].map((p) => (
          <div key={p.title} style={{ minWidth: 0 }}>
            <div style={{ ...head(), fontSize: 12 }}>{p.title}</div>
            <TwoRows stacks={CHAIN} sim={p.sim} k={Math.min(k, p.sim.last)} R={R} topLabel={p.top} />
            <div style={{ ...small(), marginTop: 2 }}>Shannon bits: {strong(p.sim.shannon(k))} · model paid: {strong(p.sim.paid(k))} · fixed but not worked out: {strong(p.sim.hidden(k))}</div>
          </div>
        ))}
      </div>
      <div style={{ ...small(), marginTop: 8, color: P.muted }}>
        Whole run: the model pays {strong(off.total)} bits without self conditioning and {strong(on.total)} with it. The Shannon count is {strong(off.need)} either way.
      </div>
    </Frame>
  );
}
export const BoxCapacity = withVizTheme(BoxCapacityInner);

// Hidden bits: one state, two observers. The unlimited observer works out everything the state
// fixes; the model runs a fixed number of peeling rounds from scratch.
function BoxTwoObserversInner() {
  const sim = useMemo(() => simulate(CHAIN, "masked", 1, 3), []);
  const [rounds, setRounds] = useState("1");
  const [k, setK] = useState(2);
  const R = rounds === "inf" ? Infinity : Number(rounds);
  const full = sim.observe(k, Infinity), model = sim.observe(k, R);
  const line = (c) => <>known {strong(c.written + c.known)} · hidden {strong(c.hidden)} · undecided {strong(c.undecided)}</>;
  return (
    <Frame kicker="Illustration · rounds per pass are this sketch's stand-in for compute" title="The same state, seen by two observers"
      subtitle="Blends chain the bits: red fixes blue through position 2, blue fixes green through position 3, and so on. The state is partway through masked sampling. Both rows see exactly the same written boxes. The top observer works out everything they fix. The bottom one is the model, which gets a fixed number of rounds of working out per pass."
      controls={<>
        <Pills value={rounds} onChange={setRounds} options={[{ id: "1", label: "model: 1 round" }, { id: "2", label: "model: 2 rounds" }, { id: "inf", label: "model: no limit" }]} />
        <button type="button" style={btn()} onClick={() => setK((v) => Math.max(0, v - 1))} aria-label="Previous step">Back</button>
        <button type="button" style={btn()} onClick={() => setK((v) => Math.min(sim.last, v + 1))} aria-label="Next step">Next</button>
        <span style={{ ...small(), alignSelf: "center" }}>step {k} of {sim.last}</span>
      </>}
      note="Gray: written into the state, or worked out from it. Striped: fixed by the state, but not worked out by this observer; these are the hidden bits. Solid: nothing fixes them yet; these are the undecided bits. Only the striped boxes differ between the rows: compute changes what the model can read off the state, not what the state holds.">
      <Key items={["unknown", "blend", "dim", "known"]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "14px 24px" }}>
        {[{ t: "Unlimited compute", v: full }, { t: `The model, ${R === Infinity ? "no limit" : `${R} round${R > 1 ? "s" : ""} per pass`}`, v: model }].map((p) => (
          <div key={p.t} style={{ minWidth: 0 }}>
            <div style={{ ...head(), fontSize: 12 }}>{p.t}</div>
            <StackSvg stacks={CHAIN} view={p.v.view} label={`${p.t}, step ${k}.`} />
            <div style={{ ...small(), marginTop: 2 }}>{line(p.v.counts)}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
export const BoxTwoObservers = withVizTheme(BoxTwoObserversInner);

// ─── Blends ──────────────────────────────────────────────────────────────────
const BLEND = [["r"], ["b"], [["r", "b"]]];
function BoxBlendsInner() {
  const s = useStepper(3);
  const k = s.k;
  const view = (si) => {
    if (si === 0) return { st: k >= 1 ? "k" : "u" };
    if (si === 1) return { st: k >= 2 ? "k" : "u" };
    if (k === 0) return {};
    if (k === 1) return { col: "b" };
    return { col: "b", st: k === 2 ? "d" : "k" };
  };
  const caption = [
    "Start. The box in position 3 is a blend of the red bit and the blue bit. It is fixed by the two together, and by neither alone.",
    "The red bit is opened. Red is removed everywhere, so the blend becomes a plain blue box: knowing the red bit, the third bit is now a copy of the blue one. Nothing is free yet.",
    "The blue bit is opened. The blend has no ingredient left, so it is settled.",
    "The model works it out, and it turns gray. Two bits were paid for, and the blend came free.",
  ][k];
  return (
    <Frame kicker="Illustration · not measured data" title="A blend comes free only when its last ingredient is opened"
      subtitle="Three bits. The third is the exclusive-or of the first two: it is 1 when exactly one of them is 1. Press Next."
      controls={s.controls}
      note="Opening a bit removes its color everywhere. A blend gets simpler each time, and it is free once nothing is left.">
      <Key items={["unknown", "blend", "dim", "known"]} />
      <StackSvg stacks={BLEND} view={(si) => view(si)} mark={[undefined, [0], [1], undefined][k]}
        label="Three positions: the red bit, the blue bit, and a blend of the two." />
      <div style={{ ...small(), marginTop: 6, color: P.muted, minHeight: 34 }}>{caption}</div>
    </Frame>
  );
}
export const BoxBlends = withVizTheme(BoxBlendsInner);

// ─── Partial amounts (information combining, binary symbols) ─────────────────
// Bounds from Land and Huber, "Information Combining" (2006). x is the information each
// clue carries, in bits. Erasure-type clues are all-or-nothing (masking). Binary-symmetric
// clues are evenly unreliable (uniform corruption). Every other symmetric channel,
// Gaussian included, lies between the two curves.
const h2 = (p) => (p <= 0 || p >= 1 ? 0 : -p * Math.log2(p) - (1 - p) * Math.log2(1 - p));
const h2inv = (y) => { // flip probability in [0, 0.5] with entropy y
  let lo = 0, hi = 0.5;
  for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; if (h2(m) < y) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
const binom = (n, k) => { let v = 1; for (let i = 1; i <= k; i++) v = (v * (n - k + i)) / i; return v; };
const combine = {
  copyAll: (I, n) => 1 - (1 - I) ** n,
  copyEven: (I, n) => {
    const p = h2inv(1 - I);
    let H = 0;
    for (let k = 0; k <= n; k++) {
      const a = (1 - p) ** k * p ** (n - k), b = p ** k * (1 - p) ** (n - k);
      if (a + b > 0) H += binom(n, k) * ((a + b) / 2) * h2(a / (a + b));
    }
    return 1 - H;
  },
  blendAll: (I, n) => I ** n,
  blendEven: (I, n) => { const p = h2inv(1 - I); return 1 - h2((1 - (1 - 2 * p) ** n) / 2); },
};

function CombinePanel({ title, blurb, n, all, even, hover, setHover }) {
  const W = 300, H = 214, L = 46, R = 12, T = 12, B = 36;
  const X = (v) => L + v * (W - L - R), Y = (v) => T + (1 - v) * (H - T - B);
  const xs = Array.from({ length: 101 }, (_, i) => i / 100);
  const path = (f) => xs.map((v, i) => `${i ? "L" : "M"}${X(v).toFixed(1)},${Y(f(v, n)).toFixed(1)}`).join(" ");
  const band = `${path(all)} ${xs.slice().reverse().map((v) => `L${X(v).toFixed(1)},${Y(even(v, n)).toFixed(1)}`).join(" ")} Z`;
  const onMove = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const v = ((e.clientX - box.left) / box.width * W - L) / (W - L - R);
    setHover(Math.max(0, Math.min(1, Math.round(v * 100) / 100)));
  };
  return (
    <div style={{ minWidth: 0 }}>
      <div style={head()}>{title}</div>
      <div style={blurbStyle()}>{blurb}</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT, touchAction: "none" }}
        role="img" aria-label={`${title}: information learned about the target against information in each clue, for all-or-nothing and evenly unreliable clues`}
        onPointerMove={onMove} onPointerLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={Y(v)} y2={Y(v)} stroke={P.grid} strokeWidth={1} />
            <text x={L - 6} y={Y(v) + 3.5} textAnchor="end" fontSize={9.5} fill={P.dim2}>{v}</text>
            <text x={X(v)} y={H - B + 14} textAnchor="middle" fontSize={9.5} fill={P.dim2}>{v}</text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 5} textAnchor="middle" fontSize={9.5} fill={P.dim2}>information in each clue (bits)</text>
        <text x={9} y={(T + H - B) / 2} textAnchor="middle" fontSize={9.5} fill={P.dim2} transform={`rotate(-90 9 ${(T + H - B) / 2})`}>learned about the target</text>
        <path d={band} fill={P.dim} opacity={0.22} />
        <path d={path(all)} fill="none" stroke={P.text} strokeWidth={2} strokeLinejoin="round" />
        <path d={path(even)} fill="none" stroke={P.muted} strokeWidth={2} strokeLinejoin="round" strokeDasharray="5 3" />
        {hover !== null && (
          <g>
            <line x1={X(hover)} x2={X(hover)} y1={T} y2={H - B} stroke={P.dim} strokeWidth={1} />
            <circle cx={X(hover)} cy={Y(all(hover, n))} r={4} fill={P.text} stroke={P.panel} strokeWidth={2} />
            <circle cx={X(hover)} cy={Y(even(hover, n))} r={4} fill={P.muted} stroke={P.panel} strokeWidth={2} />
          </g>
        )}
      </svg>
      <div style={{ ...small(), minHeight: 34 }}>
        {hover === null ? "Hover or drag over the chart to read values." : <>
          each clue holds {hover.toFixed(2)} bits<br />
          all-or-nothing: {strong(all(hover, n).toFixed(2))} · evenly unreliable: {strong(even(hover, n).toFixed(2))}
        </>}
      </div>
    </div>
  );
}

function CombineChartInner() {
  const [n, setN] = useState(3);
  const [hover, setHover] = useState(null);
  const line = (color, dash, label) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <svg width={24} height={8}><line x1={0} x2={24} y1={4} y2={4} stroke={color} strokeWidth={2} strokeDasharray={dash} /></svg>{label}
    </span>
  );
  return (
    <Frame kicker="Known result · binary symbols" title="Which kind of evidence helps more depends on how the bits are shared"
      subtitle="One target bit and several partly known clues about it. A clue is another box that bears on the target: a box of the same color (left) or an ingredient of a blend (right). Every clue holds the same amount of information."
      controls={<Pills value={String(n)} onChange={(v) => setN(Number(v))} options={[2, 3, 4].map((v) => ({ id: String(v), label: `${v} clues` }))} />}
      note="Curves follow the bounds in Land and Huber (2006). They hold for binary bits and exact rules, with clues combined perfectly. They are a guide to what to measure in language models, not a result about them.">
      <Key items={["partial"]} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", margin: "0 0 12px", fontFamily: FONT, fontSize: 11, color: P.muted }}>
        {line(P.text, undefined, "all-or-nothing clues, like masking")}
        {line(P.muted, "5 3", "evenly unreliable clues, like uniform corruption")}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width={24} height={10}><rect width={24} height={10} rx={2} fill={P.dim} opacity={0.35} /></svg>any other noise that treats 0 and 1 alike, Gaussian included
        </span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "18px 28px" }}>
        <CombinePanel title="Matching colors" blurb={`${n} clues about the same bit. All-or-nothing clues help the most.`}
          n={n} all={combine.copyAll} even={combine.copyEven} hover={hover} setHover={setHover} />
        <CombinePanel title="Blends" blurb={`A bit fixed jointly by ${n} others. The order flips.`}
          n={n} all={combine.blendAll} even={combine.blendEven} hover={hover} setHover={setHover} />
      </div>
    </Frame>
  );
}
export const CombineChart = withVizTheme(CombineChartInner);

// ─── Hybrids, Gaussian and uniform states ────────────────────────────────────
// Every fill here is computed, not hand-set. Assumptions: each color is an independent fair
// bit; each position gives every one of its bits its own noisy view (analog bits, Chen et al.
// 2022); all positions share one noise level per step, chosen so that one view carries
// I = k/HU_STEPS bits. A color held by m stacks combines m views.
//   Gaussian: one binary-input Gaussian view at snr s carries J(s) bits. Log-likelihood ratios
//     add, so m views act like one view at snr m·s: J(m·s).
//   Uniform: each bit alone looks like a binary symmetric channel with information I; m views
//     combine by the BSC rule (combine.copyEven). A swap replaces a whole token, so a position
//     is either right or wrong as a whole: those are the × marks.
//   Hybrid: committed positions reveal their bits exactly; the rest are Gaussian.
const HU_STEPS = 8;
// Capacity of the binary-input Gaussian channel at snr s (noise variance 1/s), in bits:
// J(s) = 1 - E[log2(1 + e^{-L})], L ~ N(2s, 4s) (Richardson and Urbanke §4.1.5, Lemma 4.35).
const J = (s) => {
  if (s <= 0) return 0;
  const mu = 2 * s, sd = Math.sqrt(4 * s), n = 600, lo = mu - 9 * sd, hi = mu + 9 * sd, dx = (hi - lo) / n;
  let e = 0;
  for (let i = 0; i <= n; i++) {
    const l = lo + i * dx, w = (i === 0 || i === n ? 0.5 : 1) * Math.exp(-((l - mu) ** 2) / (2 * sd * sd)) / (sd * Math.sqrt(2 * Math.PI));
    e += w * (l > 30 ? Math.exp(-l) / Math.LN2 : Math.log2(1 + Math.exp(-l))) * dx;
  }
  return Math.max(0, Math.min(1, 1 - e));
};
const Jinv = (I) => { // snr whose single view carries I bits
  if (I <= 0) return 0;
  if (I >= 1) return Infinity;
  let lo = 0, hi = 1;
  while (J(hi) < I) hi *= 2;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (J(m) < I) lo = m; else hi = m; }
  return (lo + hi) / 2;
};
const HU = (() => {
  const copies = {};
  BASE.flat().forEach((c) => { copies[c] = (copies[c] || 0) + 1; });
  const colors = Object.keys(copies);
  const r = rng(24); // seed picked so the wrong count tracks its expected value, 5 × swap rate
  const u = BASE.map(() => r());
  const truth = Object.fromEntries(colors.map((c) => [c, r() < 0.5 ? 1 : -1])); // the sample's bits, as ±1
  const coin = BASE.map((st) => Object.fromEntries(st.map((c) => [c, r() < 0.5 ? 1 : -1]))); // a wrong token's random bits
  const normal = () => { let a = 0; while (a === 0) a = r(); return Math.sqrt(-2 * Math.log(a)) * Math.cos(2 * Math.PI * r()); };
  const conf = (L) => 1 - h2(1 / (1 + Math.exp(Math.abs(L)))); // information in a belief with log-likelihood ratio L
  const llrG = Object.fromEntries(colors.map((c) => [c, 0])); // running Gaussian LLR per color, summed over its copies
  let sPrev = 0;
  const steps = Array.from({ length: HU_STEPS + 1 }, (_, k) => {
    const I = k / HU_STEPS, last = I >= 1;
    const sNow = last ? Infinity : Jinv(I);
    if (!last && k > 0) {
      // Incremental channel: one extra independent look at snr Δ = s_k - s_{k-1} per copy.
      const d = sNow - sPrev;
      BASE.forEach((st) => st.forEach((c) => { llrG[c] += 2 * d * truth[c] + 2 * Math.sqrt(d) * normal(); }));
      sPrev = sNow;
    }
    const swap = last ? 0 : Math.min(1, 2 * h2inv(1 - I));
    const p = last ? 0 : h2inv(1 - I); // per-bit flip rate of the uniform channel
    const avgG = {}, avgU = {}, drawG = {}, drawU = {}, wrongG = {};
    colors.forEach((c) => {
      const m = copies[c];
      avgG[c] = last ? 1 : J(m * sNow);
      avgU[c] = last ? 1 : I <= 0 ? 0 : combine.copyEven(I, m);
      drawG[c] = last ? 1 : k === 0 ? 0 : conf(llrG[c]);
      wrongG[c] = !last && k > 0 && Math.sign(llrG[c]) !== truth[c] && drawG[c] > 0.2;
      // Uniform: each copy shows the true bit unless its token was swapped, in which case it shows a coin.
      let L = 0;
      if (!last && p > 0 && p < 0.5) {
        const w = Math.log((1 - p) / p);
        BASE.forEach((st, si) => { if (st.includes(c)) { const shown = u[si] < swap ? coin[si][c] : truth[c]; L += shown === truth[c] ? w : -w; } });
      }
      drawU[c] = last ? 1 : k === 0 ? 0 : conf(L);
    });
    return { I, swap, avgG, avgU, drawG, drawU, wrongG };
  });
  return { copies, steps, u, commit: [1, 3, 0, 4, 2] };
})();
const known = (fill) => Object.keys(HU.copies).reduce((a, c) => a + fill(c), 0);
function BoxHybridUniformInner() {
  const [marks, setMarks] = useState(true);
  const [mode, setMode] = useState("draw");
  const s = useStepper(HU_STEPS);
  const k = s.k, st = HU.steps[k];
  const draw = mode === "draw";
  const G = draw ? st.drawG : st.avgG, U = draw ? st.drawU : st.avgU;
  const nCommit = Math.round((k / HU_STEPS) * 5);
  const committed = HU.commit.slice(0, nCommit);
  const committedColor = (c) => committed.some((si) => BASE[si].includes(c));
  const hyb = (c) => (committedColor(c) ? 1 : G[c]);
  const wrong = (si) => HU.u[si] < st.swap;
  const nWrong = BASE.filter((_, si) => wrong(si)).length;
  const nFlip = draw ? Object.keys(HU.copies).filter((c) => st.wrongG[c]).length : 0;
  const fmt = (v) => v.toFixed(1);
  const panels = [
    { title: "Hybrid state", fill: hyb,
      blurb: `${committed.length} of 5 positions committed: their bits are exact. The rest are Gaussian.`,
      mark: committed.length ? [committed[committed.length - 1]] : undefined,
      view: (si, bi) => (committed.includes(si) ? { st: "k" } : { amt: hyb(BASE[si][bi]) }) },
    { title: "Gaussian state", fill: (c) => G[c],
      blurb: draw
        ? `Each bit has its own confidence, read from its noisy views.${nFlip ? ` ${nFlip} currently lean${nFlip > 1 ? "" : "s"} the wrong way.` : ""}`
        : "On average, shared colors get several views, and the views add up.",
      view: (si, bi) => ({ amt: G[BASE[si][bi]] }) },
    { title: "Uniform state", fill: (c) => U[c],
      blurb: `${nWrong} of 5 shown tokens are wrong, and nothing in the state says which. Every shown token gets the same trust; only comparing copies helps.`,
      view: (si, bi) => ({ amt: U[BASE[si][bi]], dashed: k < HU_STEPS }),
      crossed: marks ? wrong : undefined },
  ];
  return (
    <Frame kicker="Computed · assumes analog bits and independent fair bits" title="What a hybrid, a Gaussian and a uniform state hold"
      subtitle={`The same sequence as it is generated. At every step, one view of a bit carries ${fmt(st.I * 100)}% of a bit on average, under both kinds of noise. A color held by several stacks combines several views. Press Next.`}
      controls={<>
        <Pills value={mode} onChange={setMode} options={[{ id: "draw", label: "One noisy draw" }, { id: "avg", label: "Average" }]} />
        {s.controls}
        <button type="button" style={btn()} onClick={() => setMarks((v) => !v)}>{marks ? "Hide the × marks" : "Show the × marks"}</button>
      </>}
      note={draw
        ? "Gray shows how sure an ideal model is about each bit, given the noisy views it actually got. Under Gaussian noise the confidence differs from bit to bit, by the luck of the noise, and the model can read it: that is the log-likelihood ratio. Now and then a draw leans the wrong way. Under uniform noise every shown token is trusted the same; a bit is surer only when its copies agree. A uniform swap replaces a whole token, so a stack is right or wrong as a whole: the × marks are for you, not the model."
        : "Gray shows how much of each bit an ideal model knows on average. Gaussian views combine better than uniform ones at the same information per view, so shared colors clear sooner under Gaussian noise (Land and Huber 2006). Even filling within a stack holds for analog bits; with a learned embedding, some of a token's bits clear before others."}>
      <Key items={["partial", "known", "shownPartial"]} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "18px 24px" }}>
        {panels.map((p) => (
          <div key={p.title} style={{ minWidth: 0 }}>
            <div style={head()}>{p.title}</div>
            <div style={{ ...blurbStyle(), minHeight: 66 }}>{p.blurb}</div>
            <StackSvg stacks={BASE} view={p.view} mark={p.mark} crossed={p.crossed} rowLabel="THE STATE"
              label={`${p.title}, step ${k}. ${p.blurb}`} />
            <div style={small()}>bits known: {strong(fmt(known(p.fill)))} of {strong(Object.keys(HU.copies).length)}</div>
          </div>
        ))}
      </div>
    </Frame>
  );
}
export const BoxHybridUniform = withVizTheme(BoxHybridUniformInner);

// ─── The lifecycle of a bit, in boxes ─────────────────────────────────────────
// One sampling step on the seven-color example: the state, the model's logits after one
// pass, and the next state after the sampler writes position 3. A family switch changes how
// the state looks and what it says about reliability. Every view below is hand-set.
const LC_FAMS = [
  { id: "masked", label: "Masked" },
  { id: "uniform", label: "Uniform" },
  { id: "cont", label: "Continuous" },
];
const LC_BLURB = {
  masked: "The state flags exactly which positions are known (1) and which are blank (0). After the sampler, the worked-out red boxes go back to striped: the state cannot hold work in progress.",
  uniform: "Every position shows a token and nothing says which ones are right, so every position gets the same reliability. The model works out less, because it cannot fully trust even the committed position.",
  cont: "Every position is partly known, and how far it leans gives each position its own graded reliability. A soft state keeps part of the worked-out red boxes, so less is lost.",
};
// Which bits (colors) are fixed by what is committed. Position 1 = r, b; after the step
// position 3 adds y, c (chosen by the sampler's randomness).
const LC_FIX_A = new Set(["r", "b"]);
const LC_FIX_C = new Set(["r", "b", "y", "c"]);
const lcCommittedA = [0], lcCommittedC = [0, 2];
// How far each position leans in the continuous state (A: before, C: after).
const LC_LEAN_A = [0.8, 0.35, 0.25, 0.4, 0.15];
const LC_LEAN_C = [0.9, 0.5, 0.85, 0.5, 0.2];

function lcView(fam, stage) {
  // stage: "A" state s_k, "B" logits after one pass, "C" state s_k+1
  const committed = stage === "C" ? lcCommittedC : lcCommittedA;
  const fixed = stage === "C" ? LC_FIX_C : LC_FIX_A;
  return (si, bi) => {
    const c = BASE[si][bi];
    const isCommitted = committed.includes(si);
    if (stage === "B") {
      if (isCommitted) return { st: "k" };
      if (!fixed.has(c)) return { st: "u" };
      // the pass works the fixed bits out; uniform works out only the nearest one
      if (fam === "uniform") return si === 1 ? { st: "k" } : { st: "d" };
      return { st: "k" };
    }
    if (fam === "masked") {
      if (isCommitted) return { st: "k" };
      return fixed.has(c) ? { st: "d" } : { st: "u" };
    }
    if (fam === "uniform") {
      if (isCommitted) return { amt: 0.7, dashed: true };
      return fixed.has(c) ? { st: "d" } : { st: "s" };
    }
    // continuous
    const lean = stage === "C" ? LC_LEAN_C : LC_LEAN_A;
    if (isCommitted) return { amt: lean[si] };
    if (stage === "C" && c === "r") return { amt: 0.6 }; // the soft state keeps part of the work
    return fixed.has(c) ? { st: "d" } : { amt: lean[si] };
  };
}

// Tally one view. A color is one bit of X. known = colors held for sure (gray, or a mostly
// filled box); open = the rest, H(X | s); buried = striped boxes, bits the state fixes that
// one pass has not worked out, so a bounded model would pay for them again.
function lcCount(view) {
  const known = new Set(), all = new Set();
  let buried = 0;
  BASE.forEach((s, si) => s.forEach((c, bi) => {
    const v = view(si, bi);
    all.add(c);
    if (v.st === "k" || (v.amt !== undefined && v.amt >= 0.7)) known.add(c);
    if (v.st === "d") buried += 1;
  }));
  return { all: all.size, k: known.size, o: all.size - known.size, b: buried };
}

// Indicator over each stack. kind: "binary" (0 or 1), "flat" (same everywhere), "graded".
function LcIndicators({ x0, y, values, kind }) {
  return (
    <g>
      {values.map((v, si) => {
        const x = x0 + si * (BW + SG);
        if (kind === "binary") {
          return (
            <g key={si}>
              <rect x={x + 7} y={y - 1} width={16} height={13} rx={3} fill={v ? P.text : "none"} stroke={P.line2} />
              <text x={x + BW / 2} y={y + 9} textAnchor="middle" fontSize={9.5} fontWeight={700} fill={v ? P.bg : P.dim2}>{v ? 1 : 0}</text>
            </g>
          );
        }
        return (
          <g key={si}>
            <rect x={x} y={y + 2} width={BW} height={7} rx={3.5} fill={P.inset} stroke={P.line2} strokeWidth={0.8} />
            <rect x={x} y={y + 2} width={BW * v} height={7} rx={3.5} fill={kind === "flat" ? P.dim : P.accent} />
          </g>
        );
      })}
    </g>
  );
}

function LcBadge({ x, y, n }) {
  return (
    <g>
      <circle cx={x} cy={y} r={8.5} fill={P.warn} />
      <text x={x} y={y + 3.6} textAnchor="middle" fontSize={10.5} fontWeight={700} fill={P.bg}>{n}</text>
    </g>
  );
}

function BoxLifecycleInner({ kicker = "Figure 2", start = "masked" }) {
  const [fam, setFam] = useState(start);
  const colW = stacksW(BASE);
  const XA = 14, XB = XA + colW + 110, XC = XB + colW + 180;
  const W = XC + colW + 14;
  const yBase = 150, yInd = yBase - stacksH(BASE) - 20;
  const stateKind = fam === "masked" ? "binary" : fam === "uniform" ? "flat" : "graded";
  const stateVals = (stage) => {
    if (fam === "masked") return [0, 1, 2, 3, 4].map((i) => ((stage === "C" ? lcCommittedC : lcCommittedA).includes(i) ? 1 : 0));
    if (fam === "uniform") return Array(5).fill(stage === "C" ? 0.6 : 0.5);
    return stage === "C" ? LC_LEAN_C : LC_LEAN_A;
  };
  const conf = fam === "uniform" ? [0.7, 0.45, 0.3, 0.35, 0.1] : fam === "masked" ? [1, 0.6, 0.45, 0.6, 0.1] : [0.95, 0.6, 0.45, 0.6, 0.15];
  const indLabel = { binary: "reliability |Lᵢ| ∈ {0, ∞}", flat: "reliability |Lᵢ| equal for every i", graded: "reliability |Lᵢ| graded per i" }[stateKind];
  const arrow = (x1, x2, y) => (
    <g>
      <line x1={x1} y1={y} x2={x2 - 6} y2={y} stroke={P.dim} strokeWidth={1.4} />
      <path d={`M${x2 - 9},${y - 4} L${x2 - 3},${y} L${x2 - 9},${y + 4}`} fill="none" stroke={P.dim} strokeWidth={1.4} />
    </g>
  );
  const box = (x, w, label) => (
    <g>
      <rect x={x} y={yBase - 52} width={w} height={26} rx={13} fill={P.inset} stroke={P.line2} />
      <text x={x + w / 2} y={yBase - 35} textAnchor="middle" fontSize={10} fill={P.text}>{label}</text>
    </g>
  );
  const mB = XA + colW + 18, mW = 74, sB = XB + colW + 48, sW = 84;
  const H = 292;
  const tallies = [[XA, lcCount(lcView(fam, "A"))], [XB, lcCount(lcView(fam, "B"))], [XC, lcCount(lcView(fam, "C"))]];
  return (
    <Frame kicker={kicker} title="The lifecycle of a bit during sampling"
      subtitle="One sampling step on the seven-color example. Left: the state. Middle: the model's logits after one pass. Right: the next state, after the sampler writes position 3. Switch the corruption family to see what the state can keep."
      controls={<Pills value={fam} onChange={setFam} options={LC_FAMS} />}
      note={<>Hand-set illustration, not measured data. For uniform and continuous a mostly filled box counts as known, so their counts are rounded. Gray boxes are bits the model has worked out (usable); striped boxes are fixed by what is committed but not worked out (buried). The bar or flag over each stack is what the state says about that position's reliability; over the logits it is the model's confidence, which is always graded. The split into worked-out and fixed-but-not-worked-out bits is an assumption; see the text.</>}>
      <Key items={["unknown", "dim", "known", fam === "uniform" ? "shown" : fam === "cont" ? "partial" : "empty"].filter((k) => k !== "empty")} />
      <div style={blurbStyle()}><strong style={{ color: P.text }}>How to read it.</strong> Each stack is one position i. Each color is one bit of the final sample X, so the 7 colors give H(X) = 7 bits; a color in several stacks is one bit shared by those positions. Under each column, I(X; s) counts the colors known for sure, H(X | s) the colors still open, and "buried" the striped boxes: bits the state fixes that one pass has not worked out. Here buried = H_V(X | s) − H(X | s), the extra bits a model limited to one pass would pay.</div>
      <div style={blurbStyle()}>{LC_BLURB[fam]}</div>
      <div style={{ overflowX: "auto" }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 560, height: "auto", display: "block", fontFamily: FONT }} role="img"
          aria-label={`One sampling step for ${fam} diffusion: state, logits after one pass, and the next state after the sampler writes position 3.`}>
          {[[XA, "STATE sₖ"], [XB, "LOGITS ŷₖ = f_θ(sₖ), ONE PASS"], [XC, "STATE sₖ₊₁"]].map(([x, t]) => (
            <text key={t} x={x} y={16} fontSize={9.5} fill={P.muted} letterSpacing="0.08em">{t}</text>
          ))}
          <text x={XA} y={yInd - 8} fontSize={9} fill={P.dim2}>{indLabel}</text>
          <text x={XB} y={yInd - 8} fontSize={9} fill={P.dim2}>confidence maxₓ p_θ(xᵢ | sₖ): graded</text>
          <text x={XC} y={yInd - 8} fontSize={9} fill={P.dim2}>{indLabel}</text>
          <LcIndicators x0={XA} y={yInd} values={stateVals("A")} kind={stateKind} />
          <LcIndicators x0={XB} y={yInd} values={conf} kind="graded" />
          <LcIndicators x0={XC} y={yInd} values={stateVals("C")} kind={stateKind} />

          <Stacks stacks={BASE} view={lcView(fam, "A")} x0={XA} yBase={yBase} mark={lcCommittedA} />
          <Stacks stacks={BASE} view={lcView(fam, "B")} x0={XB} yBase={yBase} />
          <Stacks stacks={BASE} view={lcView(fam, "C")} x0={XC} yBase={yBase} mark={[2]} />

          {arrow(XA + colW + 4, mB, yBase - 39)}
          {box(mB, mW, "model pass")}
          {arrow(mB + mW, XB - 4, yBase - 39)}
          {arrow(XB + colW + 4, sB, yBase - 39)}
          {box(sB, sW, "sampler")}
          {arrow(sB + sW, XC - 4, yBase - 39)}

          {/* new randomness into the sampler */}
          <text x={sB + sW / 2} y={yBase - 92} textAnchor="middle" fontSize={9.5} fill={P.warn}>new randomness</text>
          <line x1={sB + sW / 2} y1={yBase - 86} x2={sB + sW / 2} y2={yBase - 58} stroke={P.warn} strokeWidth={1.4} />
          <path d={`M${sB + sW / 2 - 4},${yBase - 62} L${sB + sW / 2},${yBase - 56} L${sB + sW / 2 + 4},${yBase - 62}`} fill="none" stroke={P.warn} strokeWidth={1.4} />
          <text x={sB + sW / 2} y={yBase - 8} textAnchor="middle" fontSize={9} fill={P.muted}>writes position 3: x₃ ~ p_θ</text>
          <text x={sB + sW / 2} y={yBase + 4} textAnchor="middle" fontSize={9} fill={P.muted}>chosen: yellow, cyan = {tallies[2][1].k - tallies[0][1].k} bits</text>

          {/* 1: sampling wall */}
          <text x={sB - 26} y={yBase + 81} fontSize={9} fill={P.bad}>sampling wall: drops the worked-out</text>
          <text x={sB - 26} y={yBase + 93} fontSize={9} fill={P.bad}>boxes and the rest of ŷₖ</text>
          
          <LcBadge x={sB - 38} y={yBase + 84} n={1} />

          {/* 2: self conditioning carries the logits forward */}
          <path d={`M${XB + colW / 2 + 40},${yBase + 62} C${XB + colW / 2 + 40},${yBase + 118} ${mB + mW / 2},${yBase + 118} ${mB + mW / 2},${yBase - 22}`}
            fill="none" stroke={P.good} strokeWidth={1.5} strokeDasharray="5 4" />
          <path d={`M${mB + mW / 2 - 4},${yBase - 17} L${mB + mW / 2},${yBase - 23} L${mB + mW / 2 + 4},${yBase - 17}`} fill="none" stroke={P.good} strokeWidth={1.5} />
          <text x={(XB + colW / 2 + mB + mW / 2) / 2 + 30} y={yBase + 128} textAnchor="middle" fontSize={9.5} fill={P.good}>self conditioning: ŷₖ fed into the next pass, f_θ(sₖ₊₁, ŷₖ)</text>
          <LcBadge x={mB + mW / 2 - 14} y={yBase + 80} n={2} />

          {/* tallies, in math terms */}
          {[[XA, tallies[0][1], "sₖ"], [XB, tallies[1][1], "ŷₖ"], [XC, tallies[2][1], "sₖ₊₁"]].map(([x, c, v]) => (
            <g key={v}>
              <text x={x} y={yBase + 30} fontSize={9.5} fill={P.text}>I(X; {v}) = {c.k} bits known</text>
              <text x={x} y={yBase + 43} fontSize={9.5} fill={P.text}>H(X | {v}) = {c.o} bits open</text>
              <text x={x} y={yBase + 56} fontSize={9.5} fill={P.warn}>buried = {c.b} {c.b === 1 ? "box" : "boxes"}</text>
            </g>
          ))}

          {/* 3: the corruption process decides what the state keeps */}
          <LcBadge x={XC - 12} y={yInd + 5} n={3} />
        </svg>
      </div>
      <div style={{ ...small(), marginTop: 2, display: "flex", flexWrap: "wrap", gap: "4px 14px" }}>
        <span><strong style={{ color: P.text }}>1</strong> sampling wall: the draw throws away the rest of the belief</span>
        <span><strong style={{ color: P.text }}>2</strong> self conditioning: graded beliefs carried forward</span>
        <span><strong style={{ color: P.text }}>3</strong> corruption process: decides what the state keeps</span>
      </div>
    </Frame>
  );
}
export const BoxLifecycle = withVizTheme(BoxLifecycleInner);
