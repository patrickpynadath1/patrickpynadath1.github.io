// Part 3 illustration: one sentence sent through the three channels at a chosen noise level.
// Masked drops words but marks the gap; uniform swaps words silently; Gaussian blurs every
// word by a different amount, and shows how much each word can be trusted.
import { useMemo, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";

const SENTENCE = "the little cat sat on the warm mat and watched the rain".split(" ");
const VOCAB = ["dog", "tree", "blue", "ran", "under", "cold", "box", "sang", "a", "sky", "slept", "red", "boat", "quick", "door", "milk"];

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r() + 1e-12)) * Math.cos(2 * Math.PI * r());

function draw(noise, seed) {
  const r = rng(seed);
  return SENTENCE.map((w) => {
    const masked = r() < noise;
    const swap = r() < noise;
    const swapWord = VOCAB[Math.floor(r() * VOCAB.length)];
    // Gaussian: per-word noise draw; margin shrinks with the noise level, varies by draw.
    const z = Math.abs(gauss(r));
    const sigma = 0.15 + 2.4 * noise;
    const margin = Math.max(0, 1 / sigma - 0.55 * z); // larger = clearer
    const trust = 1 - Math.exp(-2.2 * margin);
    return { w, masked, swap: swap && swapWord !== w, swapWord, trust };
  });
}

function Row({ title, sub, color, children }) {
  return (
    <div style={{ padding: "10px 0", borderTop: `1px solid ${P.line}` }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color }}>{title}</span>
        <span style={{ fontSize: 12, color: P.muted }}>{sub}</span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 6px", alignItems: "flex-end" }}>{children}</div>
    </div>
  );
}
const chip = (extra) => ({ fontFamily: FONT, fontSize: 13.5, padding: "3px 7px", borderRadius: 6, lineHeight: 1.3, ...extra });

function ChannelIntuitionInner() {
  const [noise, setNoise] = useState(0.35);
  const [seed, setSeed] = useState(7);
  const [reveal, setReveal] = useState(false);
  const words = useMemo(() => draw(noise, seed), [noise, seed]);
  return (
    <Frame
      kicker="Illustration · not measured data"
      title="One sentence through three kinds of noisy line"
      subtitle="Each row sends the same sentence through one channel at the same noise level. Drag the slider to make the line worse, and draw again to see that the noise lands differently every time."
      controls={
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, fontSize: 12.5, color: P.muted }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>Noise level</span>
            <input type="range" min={0} max={0.9} step={0.01} value={noise} onChange={(e) => setNoise(+e.target.value)} style={{ width: 150, accentColor: P.accent }} />
            <span style={{ fontFamily: FONT, color: P.text, minWidth: 34 }}>{noise.toFixed(2)}</span>
          </label>
          <button type="button" onClick={() => setSeed((s) => s + 1)} style={{ border: `1px solid ${P.line2}`, background: P.inset, color: P.text, borderRadius: 999, padding: "4px 12px", fontFamily: FONT, fontSize: 12, cursor: "pointer" }}>Draw again</button>
          <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
            <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} />
            <span>Show which uniform words were swapped</span>
          </label>
        </div>
      }
      note={<>The model never sees the clean sentence. With masking it knows exactly which words are missing. With uniform noise it sees a full sentence of real words and must work out from context which ones are wrong; the checkbox shows what it cannot. With Gaussian noise every word arrives partly readable, and the bar under each word shows how far it can be trusted.</>}
    >
      <Row title="Clean" sub="what was sent" color={P.text}>
        {words.map((x, i) => <span key={i} style={chip({ color: P.text, background: rgba(P.text, 0.05) })}>{x.w}</span>)}
      </Row>
      <Row title="Masked" sub="erasure: drops words, marks the gap" color={P.mdlm}>
        {words.map((x, i) => x.masked
          ? <span key={i} style={chip({ color: P.dim, background: rgba(P.mdlm, 0.12), border: `1px dashed ${P.mdlm}`, minWidth: 30, textAlign: "center" })}>?</span>
          : <span key={i} style={chip({ color: P.text, background: rgba(P.text, 0.05) })}>{x.w}</span>)}
      </Row>
      <Row title="Uniform" sub="symmetric: swaps words, says nothing" color={P.duo}>
        {words.map((x, i) => (
          <span key={i} style={chip({ color: P.text, background: reveal && x.swap ? rgba(P.bad, 0.18) : rgba(P.text, 0.05), outline: reveal && x.swap ? `1px solid ${P.bad}` : "none" })}>
            {x.swap ? x.swapWord : x.w}
          </span>
        ))}
      </Row>
      <Row title="Gaussian" sub="static: blurs every word, by a different amount" color={P.accent}>
        {words.map((x, i) => (
          <span key={i} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
            <span style={chip({ color: P.text, background: rgba(P.accent, 0.08), filter: `blur(${((1 - x.trust) * 3.2).toFixed(2)}px)`, opacity: 0.35 + 0.65 * x.trust })}>{x.w}</span>
            <span style={{ width: 30, height: 4, borderRadius: 2, background: rgba(P.text, 0.08), overflow: "hidden" }}>
              <span style={{ display: "block", width: `${x.trust * 100}%`, height: "100%", background: P.accent }} />
            </span>
          </span>
        ))}
      </Row>
    </Frame>
  );
}

export const ChannelIntuition = withVizTheme(ChannelIntuitionInner);
export default ChannelIntuition;
