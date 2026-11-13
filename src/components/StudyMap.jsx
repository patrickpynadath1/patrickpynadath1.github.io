// The experimental wishlist as a diagram: one question, the sub-questions it splits into, and
// for each the ablation run (what varies, what is held fixed) and where the result lives.
import { P, withVizTheme } from "./vizTheme.js";
import { Frame, FONT, rgba } from "./SelfCondDepth.jsx";

const STUDIES = [
  { q: "Does SC help discrete and continuous models alike?",
    vary: ["SC on / off", "masked, uniform", "Gaussian, simplex, spherical, vMF"],
    fixed: ["architecture, training", "tuned sampler, 128 NFE"],
    href: "#self-conditioning-continuous-corruption-and-learned-noise-schedule", where: "Results" },
  { q: "Does SC still help once a continuous model has discrete anchoring?",
    vary: ["SC on / off", "hybrids: {masked, uniform} × each continuous view"],
    fixed: ["same continuous views as above", "CDCD schedule"],
    href: "#self-conditioning-hybrid-corruption-and-learned-noise-schedule", where: "Results" },
  { q: "Does SC change which sampler works best?",
    vary: ["8 samplers per model (10 for pure continuous)", "SC on / off"],
    fixed: ["same checkpoints, prompts, seeds", "same tuning budget"],
    href: "#self-conditioning-changes-sensitivity-to-tuning", where: "Results" },
];

function List({ label, items, color }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontFamily: FONT, fontSize: 10, letterSpacing: 0.5, color, textTransform: "uppercase" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
        {items.map((t) => (
          <span key={t} style={{ fontFamily: FONT, fontSize: 11, padding: "2px 7px", borderRadius: 6, color: P.muted, background: rgba(color, 0.1), border: `1px solid ${rgba(color, 0.35)}` }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function StudyInner() {
  const vary = P.accent, fixed = P.dim2;
  return (
    <Frame
      kicker="Figure · experimental wishlist"
      title="One question, three controlled comparisons"
      subtitle="Each comparison holds a family of recipes fixed and switches SC on and off, so a difference can be read as SC's effect on that family."
      note="Every comparison runs on Sudoku, text8 and TinyStories with one training seed per model."
    >
      <div style={{ display: "flex", justifyContent: "center" }}>
        <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: P.text, padding: "8px 14px", borderRadius: 9, border: `1.5px solid ${rgba(P.accent, 0.8)}`, background: rgba(P.accent, 0.14) }}>
          What does self conditioning do?
        </div>
      </div>
      <div aria-hidden style={{ height: 16, margin: "0 12%", borderLeft: `1.2px solid ${P.line2}`, borderRight: `1.2px solid ${P.line2}`, borderTop: `1.2px solid ${P.line2}`, marginTop: 10, borderRadius: "6px 6px 0 0" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
        {STUDIES.map((s, i) => (
          <div key={s.q} style={{ border: `1px solid ${P.line2}`, borderRadius: 9, padding: "10px 12px", background: rgba(P.panel, 0.6), display: "flex", flexDirection: "column" }}>
            <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.accent }}>Q{i + 1}</div>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: P.text, lineHeight: 1.35, marginTop: 2 }}>{s.q}</div>
            <List label="vary" items={s.vary} color={vary} />
            <List label="hold fixed" items={s.fixed} color={fixed} />
            <a href={s.href} style={{ marginTop: "auto", paddingTop: 10, fontFamily: FONT, fontSize: 11, color: P.accent, textDecoration: "none" }}>→ {s.where}</a>
          </div>
        ))}
      </div>
    </Frame>
  );
}

export const StudyMap = withVizTheme(StudyInner);
export default StudyMap;
