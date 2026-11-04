// Self conditioning vs doubling depth: four linked mockup figures.
// Data: src/data/sc_depth_results.json, built from candi
// docs/handoffs/performance-index-2026-11-01.csv for Sudoku and text8, and the
// portable-v2-mi210 snapshot for TinyStories BPE-10k (final held-out scores, one
// training seed, two evaluation seeds, 128 NFE). Each cell uses the sampler with the best validation score.
import { useMemo, useState } from "react";
import { P, withVizTheme } from "./vizTheme.js";
import DATA from "../data/sc_depth_results.json";

export const FONT = "'JetBrains Mono', 'Fira Code', 'SF Mono', monospace";

// ─── Data ─────────────────────────────────────────────────────────────────────
const IDX = {};
for (const r of DATA.rows) IDX[`${r.task}|${r.method}|${r.arm}`] = r;
const get = (task, method, arm) => IDX[`${task}|${method}|${arm}`];
const rel = (v, base) => (v / base - 1) * 100;

const METHODS = [
  { id: "gaussian", label: "Gaussian", color: () => P.accent },
  { id: "masked", label: "Masked", color: () => P.mdlm },
  { id: "uniform", label: "Uniform", color: () => P.duo },
];
const TASKS = [
  { id: "sudoku_hard", label: "Sudoku", metric: "solve rate", fmt: (v) => `${(v * 100).toFixed(1)}%`,
    domain: [0, 1], ticks: [0, 0.2, 0.4, 0.6, 0.8, 1], tick: (v) => `${Math.round(v * 100)}%` },
  { id: "text8", label: "text8", metric: "unique valid words / sample", fmt: (v) => v.toFixed(1),
    domain: [0, 18], ticks: [0, 3, 6, 9, 12, 15, 18], tick: (v) => `${v}` },
  { id: "tinystories", label: "TinyStories BPE", metric: "reference BLEU", fmt: (v) => v.toFixed(2),
    domain: [4, 9], ticks: [4, 5, 6, 7, 8, 9], tick: (v) => `${v}` },
];
const ARMS = [
  { id: "none", label: "8 layers", long: "8 layers, no SC", color: () => P.dim2 },
  { id: "depth", label: "16 layers", long: "16 layers, no SC", color: () => P.highlight },
  { id: "sc", label: "8 layers + SC", long: "8 layers + SC", color: () => P.candi },
];
const methodOf = (id) => METHODS.find((m) => m.id === id);
const taskOf = (id) => TASKS.find((t) => t.id === id);

const pct = (v) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`;

export function rgba(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

// ─── Shared chrome ────────────────────────────────────────────────────────────
export function Frame({ kicker, title, subtitle, controls, children, note }) {
  return (
    <figure style={{
      margin: "32px 0", padding: "18px 18px 14px", borderRadius: 14,
      border: `1px solid ${P.line}`, background: rgba(P.panel, 0.55),
    }}>
      <div style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: "0.12em", color: P.accent, textTransform: "uppercase", marginBottom: 4 }}>
        {kicker}
      </div>
      <div style={{ fontSize: 18, fontWeight: 650, color: P.text, lineHeight: 1.3 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 13.5, color: P.muted, marginTop: 4, lineHeight: 1.45 }}>{subtitle}</div>}
      {controls && <div style={{ display: "flex", flexWrap: "wrap", gap: 10, margin: "14px 0 6px" }}>{controls}</div>}
      <div>{children}</div>
      {note && <figcaption style={{ fontSize: 12, color: P.dim2, marginTop: 8, lineHeight: 1.5 }}>{note}</figcaption>}
    </figure>
  );
}

export function Pills({ options, value, onChange }) {
  return (
    <div style={{ display: "inline-flex", padding: 3, borderRadius: 999, border: `1px solid ${P.line2}`, background: P.inset }}>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} style={{
            border: 0, cursor: "pointer", borderRadius: 999, padding: "5px 12px",
            fontFamily: FONT, fontSize: 11.5, letterSpacing: "0.02em",
            background: on ? rgba(o.color ? o.color() : P.accent, 0.22) : "transparent",
            color: on ? (o.color ? o.color() : P.accentSoft) : P.dim2,
            transition: "background 200ms, color 200ms",
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Shape({ task, size = 7, fill, stroke, strokeWidth = 1.5, opacity = 1 }) {
  const common = { fill, stroke, strokeWidth, opacity };
  if (task === "sudoku_hard") return <rect x={-size} y={-size} width={size * 2} height={size * 2} rx={2} {...common} />;
  if (task === "tinystories") {
    const s = size * 1.2;
    return <path d={`M0,${-s} L${s * 0.95},${s * 0.7} L${-s * 0.95},${s * 0.7} Z`} {...common} />;
  }
  return <circle r={size} {...common} />;
}

const move = (x, y) => ({ transform: `translate(${x}px, ${y}px)`, transition: "transform 750ms cubic-bezier(.2,.8,.2,1)" });

const POLICY = {
  native: "native", native_greedy: "native greedy", eb_greedy: "entropy-bounded greedy",
  renoise_sample: "renoise (sampled)", renoise_greedy: "renoise (greedy)",
};

// ─── Figure A: head-to-head scatter ───────────────────────────────────────────
// x = gain from doubling depth, y = gain from SC, both vs the 8-layer no-SC
// model. Signed square-root axes so small and large effects are both readable.
function HeadToHeadInner() {
  const [hover, setHover] = useState(null);
  const [focus, setFocus] = useState(null);

  const L = 58, T = 18, S = 384;
  const lim = 120, low = -40;
  const f = (v) => Math.sign(v) * Math.sqrt(Math.min(Math.abs(v), lim));
  const lo = f(low), hi = f(lim);
  const px = (v) => L + ((f(v) - lo) / (hi - lo)) * S;
  const py = (v) => T + S - ((f(v) - lo) / (hi - lo)) * S;
  const ticks = [-20, -5, 0, 5, 20, 50, 100];

  const points = useMemo(() => {
    const out = [];
    for (const t of TASKS) for (const m of METHODS) {
      const base = get(t.id, m.id, "none").score;
      out.push({
        key: `${t.id}|${m.id}`, task: t.id, method: m.id,
        dx: rel(get(t.id, m.id, "depth").score, base),
        dy: rel(get(t.id, m.id, "sc").score, base),
      });
    }
    return out;
  }, []);

  const wins = points.filter((p) => p.dy > p.dx).length;
  const hp = hover && points.find((p) => p.key === hover);
  const shown = (p) => !focus || focus === p.method;
  const RX = 470;

  return (
    <Frame
      kicker="Figure A · the headline"
      title="Does self conditioning buy what doubling depth buys?"
      subtitle="Each mark is one corruption type on one task. Both axes show the change over the same 8-layer model without SC. Above the diagonal, 8 layers + SC beats 16 layers."
      note="Final held-out scores. Each model uses the sampler that scored best on validation. Axes use a signed square-root scale. One training seed per cell. TinyStories uses a 10k-token BPE vocabulary and comes from a second, independent run (AMD MI210, new data splits); Sudoku and text8 come from the original run."
    >
      <svg viewBox="0 0 720 440" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        <polygon points={`${L},${T + S} ${L},${T} ${L + S},${T}`} fill={rgba(P.candi, 0.07)} />
        <polygon points={`${L},${T + S} ${L + S},${T + S} ${L + S},${T}`} fill={rgba(P.highlight, 0.06)} />
        <text x={L + 12} y={T + 20} fill={P.candi} fontSize={11}>SC wins</text>
        <text x={L + S - 12} y={T + S - 12} fill={P.highlight} fontSize={11} textAnchor="end">16 layers wins</text>

        {ticks.map((v) => (
          <g key={v}>
            <line x1={px(v)} x2={px(v)} y1={T} y2={T + S} stroke={v === 0 ? P.line2 : P.grid} strokeWidth={v === 0 ? 1.2 : 0.6} />
            <line x1={L} x2={L + S} y1={py(v)} y2={py(v)} stroke={v === 0 ? P.line2 : P.grid} strokeWidth={v === 0 ? 1.2 : 0.6} />
            <text x={px(v)} y={T + S + 16} fill={P.dim} fontSize={9.5} textAnchor="middle">{v === 0 ? "0" : pct(v)}</text>
            <text x={L - 8} y={py(v) + 3} fill={P.dim} fontSize={9.5} textAnchor="end">{v === 0 ? "0" : pct(v)}</text>
          </g>
        ))}
        <line x1={L} y1={T + S} x2={L + S} y2={T} stroke={P.muted} strokeDasharray="4 4" strokeWidth={1} />
        <text x={L + S / 2} y={T + S + 36} fill={P.muted} fontSize={11} textAnchor="middle">gain from 16 layers →</text>
        <text transform={`translate(${L - 44}, ${T + S / 2}) rotate(-90)`} fill={P.muted} fontSize={11} textAnchor="middle">gain from self conditioning →</text>

        {points.map((p) => {
          const c = methodOf(p.method).color();
          const on = hover === p.key;
          return (
            <g key={p.key} style={{ ...move(px(p.dx), py(p.dy)), cursor: "pointer", opacity: shown(p) ? 1 : 0.12 }}
              onMouseEnter={() => setHover(p.key)} onMouseLeave={() => setHover(null)}>
              <circle r={14} fill="transparent" />
              <Shape task={p.task} size={on ? 9 : 7} fill={rgba(c, on ? 0.95 : 0.75)} stroke={c} />
            </g>
          );
        })}

        <g transform={`translate(${RX}, ${T + 4})`}>
          <text fill={P.dim} fontSize={9.5} letterSpacing="0.1em">CORRUPTION · click to isolate</text>
          {METHODS.map((m, i) => (
            <g key={m.id} transform={`translate(0, ${22 + i * 22})`} style={{ cursor: "pointer" }}
              onClick={() => setFocus(focus === m.id ? null : m.id)}>
              <rect x={-4} y={-12} width={150} height={20} rx={6} fill={focus === m.id ? rgba(m.color(), 0.16) : "transparent"} />
              <circle cx={6} cy={-2} r={5.5} fill={m.color()} opacity={!focus || focus === m.id ? 1 : 0.3} />
              <text x={20} y={2} fill={!focus || focus === m.id ? P.text : P.dim} fontSize={12}>{m.label}</text>
            </g>
          ))}
          <text y={102} fill={P.dim} fontSize={9.5} letterSpacing="0.1em">TASK</text>
          {TASKS.map((t, i) => (
            <g key={t.id} transform={`translate(0, ${124 + i * 22})`}>
              <g transform="translate(6,-2)"><Shape task={t.id} size={5} fill="none" stroke={P.muted} /></g>
              <text x={20} y={2} fill={P.text} fontSize={12}>{t.label}</text>
            </g>
          ))}

          <rect y={198} width={238} height={190} rx={10} fill={P.inset} stroke={P.line} />
          {hp ? (() => {
            const m = methodOf(hp.method), t = taskOf(hp.task);
            const rows = ARMS.map((a) => ({ a, r: get(hp.task, hp.method, a.id) }));
            const base = rows[0].r.score;
            return (
              <g transform="translate(14, 222)">
                <text fill={m.color()} fontSize={13} fontWeight={700}>{m.label} <tspan fill={P.text}>· {t.label}</tspan></text>
                <text y={17} fill={P.dim} fontSize={10}>{t.metric}</text>
                {rows.map(({ a, r }, i) => (
                  <g key={a.id} transform={`translate(0, ${44 + i * 34})`}>
                    <circle cx={4} cy={-4} r={4} fill={a.color()} />
                    <text x={14} fill={P.muted} fontSize={11}>{a.label}</text>
                    <text x={150} fill={P.text} fontSize={12} fontWeight={600} textAnchor="end">{t.fmt(r.score)}</text>
                    {i > 0 && <text x={210} fill={(r.score - base) >= 0 ? P.good : P.bad} fontSize={11} textAnchor="end">{pct(rel(r.score, base))}</text>}
                    <text x={14} y={13} fill={P.dim} fontSize={9}>{POLICY[r.policy] || r.policy}</text>
                  </g>
                ))}
                <text y={152} fill={P.muted} fontSize={10.5}>
                  {hp.dy > hp.dx ? "SC gets more out of 8 layers" : "Doubling depth helps more"}
                </text>
                <text y={166} fill={P.dim} fontSize={10}>than {hp.dy > hp.dx ? "doubling depth." : "adding SC."}</text>
              </g>
            );
          })() : (
            <g transform="translate(14, 226)">
              <text fill={P.text} fontSize={28} fontWeight={700}>{wins}<tspan fill={P.dim} fontSize={16}> / 9</tspan></text>
              <text y={22} fill={P.muted} fontSize={11}>cells where 8 layers + SC</text>
              <text y={38} fill={P.muted} fontSize={11}>beats 16 layers</text>
              <text y={70} fill={P.dim} fontSize={10}>Hover a mark for raw scores</text>
              <text y={84} fill={P.dim} fontSize={10}>and the sampler each model used.</text>
            </g>
          )}
        </g>
      </svg>
    </Frame>
  );
}

// ─── Figure B: raw scores as dumbbells ────────────────────────────────────────
function DumbbellsInner() {
  const [task, setTask] = useState("sudoku_hard");
  const t = taskOf(task);
  const L = 112, R = 560, T = 34, rowH = 70;
  const x = (v) => L + ((v - t.domain[0]) / (t.domain[1] - t.domain[0])) * (R - L);
  const H = T + rowH * 3 + 34;

  return (
    <Frame
      kicker="Figure B · the raw scores"
      title="Where each model lands, per task"
      subtitle="Grey ring: 8 layers. Gold diamond: 16 layers. Green dot: 8 layers + SC. Thin bars show the two evaluation seeds."
      controls={<Pills value={task} onChange={setTask} options={TASKS.map((tk) => ({ id: tk.id, label: tk.label }))} />}
      note={`Metric: ${t.metric}. Gains on the right are relative to the 8-layer model. Hover a marker for the sampler it used.`}
    >
      <svg viewBox={`0 0 720 ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {t.ticks.map((v) => (
          <g key={v}>
            <line x1={x(v)} x2={x(v)} y1={T - 10} y2={T + rowH * 3 - 10} stroke={P.grid} strokeWidth={0.6} />
            <text x={x(v)} y={T + rowH * 3 + 8} fill={P.dim} fontSize={9.5} textAnchor="middle">{t.tick(v)}</text>
          </g>
        ))}
        <text x={R + 30} y={T - 14} fill={P.dim} fontSize={9.5} letterSpacing="0.08em">16 LAYERS</text>
        <text x={R + 110} y={T - 14} fill={P.dim} fontSize={9.5} letterSpacing="0.08em">+ SC</text>
        {METHODS.map((m, i) => {
          const cy = T + i * rowH + rowH / 2 - 10;
          const r = Object.fromEntries(ARMS.map((a) => [a.id, get(task, m.id, a.id)]));
          const vals = ARMS.map((a) => r[a.id].score);
          const lo = Math.min(...vals), hi = Math.max(...vals);
          const gd = rel(r.depth.score, r.none.score), gs = rel(r.sc.score, r.none.score);
          return (
            <g key={m.id}>
              <rect x={8} y={cy - rowH / 2 + 6} width={704} height={rowH - 12} rx={10} fill={i % 2 ? "transparent" : rgba(P.panel, 0.6)} />
              <circle cx={22} cy={cy} r={5} fill={m.color()} />
              <text x={34} y={cy + 4} fill={P.text} fontSize={13} fontWeight={600}>{m.label}</text>
              <line x1={x(lo)} x2={x(hi)} y1={cy} y2={cy} stroke={P.line2} strokeWidth={3} strokeLinecap="round"
                style={{ transition: "all 750ms cubic-bezier(.2,.8,.2,1)" }} />
              {[ARMS[1], ARMS[2], ARMS[0]].map((a) => {
                const row = r[a.id];
                const c = a.color();
                return (
                  <g key={a.id}>
                    <line x1={x(Math.min(...row.seeds))} x2={x(Math.max(...row.seeds))} y1={cy} y2={cy} stroke={c} strokeWidth={6} opacity={0.35}
                      strokeLinecap="round" style={{ transition: "all 750ms cubic-bezier(.2,.8,.2,1)" }} />
                    <g style={{ ...move(x(row.score), cy), cursor: "help" }}>
                      {a.id === "none" && <circle r={6.5} fill={P.bg} stroke={c} strokeWidth={2} />}
                      {a.id === "depth" && <rect x={-6} y={-6} width={12} height={12} transform="rotate(45)" fill={c} />}
                      {a.id === "sc" && <circle r={7} fill={c} />}
                      <title>{`${a.long}: ${t.fmt(row.score)} (seeds ${row.seeds.map(t.fmt).join(", ")}; sampler: ${POLICY[row.policy] || row.policy})`}</title>
                    </g>
                  </g>
                );
              })}
              <text x={R + 30} y={cy + 4} fill={gd >= 0 ? P.highlight : P.bad} fontSize={12} fontWeight={600}>{pct(gd)}</text>
              <text x={R + 110} y={cy + 4} fill={gs >= 0 ? P.candi : P.bad} fontSize={12} fontWeight={600}>{pct(gs)}</text>
            </g>
          );
        })}
      </svg>
    </Frame>
  );
}

// ─── Figure C: the gap as a grid ──────────────────────────────────────────────
function GapGridInner() {
  const [hover, setHover] = useState(null);
  const cw = 150, ch = 58, gx = 150, T = 30;
  const cells = [];
  METHODS.forEach((m, mi) => TASKS.forEach((t, ti) => {
    const sc = get(t.id, m.id, "sc"), d = get(t.id, m.id, "depth");
    cells.push({ key: `${m.id}|${t.id}`, m, t, sc, d, v: rel(sc.score, d.score), x: gx + ti * cw, y: T + mi * ch });
  }));
  const h = hover && cells.find((c) => c.key === hover);

  return (
    <Frame
      kicker="Figure C · the gap at a glance"
      title="How much better is 8 layers + SC than 16 layers?"
      subtitle="Each cell is SC's score relative to the 16-layer score. Green means SC is ahead; gold means depth is ahead."
    >
      <svg viewBox="0 0 720 250" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
        {TASKS.map((t, ti) => (
          <text key={t.id} x={gx + ti * cw + cw / 2} y={T - 10} fill={P.dim} fontSize={11} textAnchor="middle">{t.label}</text>
        ))}
        {METHODS.map((m, mi) => (
          <g key={m.id}>
            <circle cx={40} cy={T + mi * ch + ch / 2} r={4.5} fill={m.color()} />
            <text x={52} y={T + mi * ch + ch / 2 + 4} fill={P.text} fontSize={12}>{m.label}</text>
          </g>
        ))}
        {cells.map((c) => {
          const col = c.v >= 0 ? P.candi : P.highlight;
          const a = 0.1 + 0.8 * Math.min(1, Math.sqrt(Math.abs(c.v)) / 5.5);
          const on = hover === c.key;
          return (
            <g key={c.key} onMouseEnter={() => setHover(c.key)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
              <rect x={c.x + 3} y={c.y + 3} width={cw - 6} height={ch - 6} rx={8} fill={rgba(col, a)}
                stroke={on ? P.text : "transparent"} strokeWidth={1.5} />
              <text x={c.x + cw / 2} y={c.y + ch / 2 + 5} fill={a > 0.55 ? P.bg : P.text} fontSize={14} fontWeight={700} textAnchor="middle">{pct(c.v)}</text>
            </g>
          );
        })}
        <g transform={`translate(${gx}, ${T + ch * 3 + 26})`}>
          {h ? (
            <text fill={P.muted} fontSize={11.5}>
              <tspan fill={h.m.color()} fontWeight={700}>{h.m.label}</tspan>
              <tspan> · {h.t.label}:  </tspan>
              <tspan fill={P.candi}>SC {h.t.fmt(h.sc.score)}</tspan>
              <tspan> vs </tspan>
              <tspan fill={P.highlight}>16 layers {h.t.fmt(h.d.score)}</tspan>
            </text>
          ) : (
            <text fill={P.dim} fontSize={11}>Hover a cell for the raw scores.</text>
          )}
        </g>
      </svg>
    </Frame>
  );
}

// ─── Figure D: which sampler wins on validation ───────────────────────────────
const SAMPLER_LIST = [
  { id: "native", label: "native", short: "native", family: "standard", color: () => P.lime },
  { id: "native_greedy", label: "native greedy", short: "native greedy", family: "standard", color: () => P.warn },
  { id: "eb_greedy", label: "EB greedy", short: "EB greedy", family: "standard", color: () => P.accentSoft },
  { id: "renoise_sample", label: "renoise sample", short: "renoise samp.", family: "renoise", color: () => P.orange2 },
  { id: "renoise_greedy", label: "renoise greedy", short: "renoise greedy", family: "renoise", color: () => P.pinkText },
];
const samplerOf = (id) => SAMPLER_LIST.find((s) => s.id === id);
const SHORT_ARM = { none: "8L", depth: "16L", sc: "8L+SC" };
// Winner's validation lead over the runner-up sampler, in percent.
function margin(r) {
  const vals = r.samplers.map((p) => p.validation).sort((a, b) => b - a);
  const second = r.samplers.filter((p) => p.policy !== r.policy).map((p) => p.validation).sort((a, b) => b - a)[0];
  const best = vals[0];
  const runner = r.samplers.find((p) => p.policy !== r.policy && p.validation === second);
  return { pct: second > 0 ? (best / second - 1) * 100 : Infinity, runner };
}
const fmtMargin = (m) => (m.pct < 0.05 ? "tie" : m.pct === Infinity ? "+∞" : `+${m.pct < 10 ? m.pct.toFixed(1) : m.pct.toFixed(0)}%`);

function SamplerChoiceInner() {
  const [view, setView] = useState("map");
  const [task, setTask] = useState("text8");
  const [hover, setHover] = useState(null);

  const isRenoise = (r) => samplerOf(r.policy).family === "renoise";
  const all = DATA.rows;
  const noSc = all.filter((r) => r.arm !== "sc");
  const sc = all.filter((r) => r.arm === "sc");
  const stat = (
    <div style={{ display: "flex", gap: 22, flexWrap: "wrap", fontFamily: FONT, margin: "4px 0 2px" }}>
      <div><span style={{ fontSize: 24, fontWeight: 700, color: P.orange2 }}>{noSc.filter(isRenoise).length}</span>
        <span style={{ color: P.dim, fontSize: 14 }}> / {noSc.length}</span>
        <div style={{ fontSize: 11, color: P.muted }}>models without SC pick renoising</div></div>
      <div><span style={{ fontSize: 24, fontWeight: 700, color: P.candi }}>{sc.filter(isRenoise).length}</span>
        <span style={{ color: P.dim, fontSize: 14 }}> / {sc.length}</span>
        <div style={{ fontSize: 11, color: P.muted }}>models with SC pick renoising</div></div>
    </div>
  );

  return (
    <Frame
      kicker="Figure D · sampler selection"
      title="Self conditioning changes which sampler wins"
      subtitle="Every model was tuned with five samplers at 128 NFE, and the one with the best validation score was kept. These are validation numbers."
      controls={<>
        <Pills value={view} onChange={setView} options={[{ id: "map", label: "Winner map" }, { id: "grid", label: "All samplers" }]} />
        {view === "grid" && <Pills value={task} onChange={setTask} options={TASKS.map((tk) => ({ id: tk.id, label: tk.label }))} />}
      </>}
      note="Lead = winner's validation score over the runner-up sampler's. Small leads (under 2%, in yellow) mean the choice is close to a coin flip. Renoising sends committed tokens back through the forward process during generation. TinyStories: BPE-10k run on MI210 GPUs."
    >
      {stat}
      {view === "map" ? <WinnerMap hover={hover} setHover={setHover} /> : <SamplerGrid task={task} />}
    </Frame>
  );
}

function WinnerMap({ hover, setHover }) {
  const gx = 120, cw = 196, T = 40, rowH = 92;
  const h = hover && DATA.rows.find((r) => `${r.task}|${r.method}|${r.arm}` === hover);
  return (
    <svg viewBox="0 0 720 400" style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
      {TASKS.map((t, ti) => (
        <g key={t.id}>
          <text x={gx + ti * cw + cw / 2 - 16} y={T - 12} fill={P.dim} fontSize={11} textAnchor="middle">{t.label}</text>
          <text x={gx + ti * cw + cw - 14} y={T - 12} fill={P.dim} fontSize={9} textAnchor="end">lead</text>
        </g>
      ))}
      {METHODS.map((m, mi) => (
        <g key={m.id}>
          <circle cx={14} cy={T + mi * rowH + rowH / 2 - 4} r={4.5} fill={m.color()} />
          <text x={26} y={T + mi * rowH + rowH / 2} fill={P.text} fontSize={12}>{m.label}</text>
          {TASKS.map((t, ti) => {
            const x0 = gx + ti * cw, y0 = T + mi * rowH;
            return (
              <g key={t.id}>
                <rect x={x0 + 4} y={y0 + 4} width={cw - 8} height={rowH - 8} rx={10} fill={rgba(P.panel, 0.7)} stroke={P.line} />
                {ARMS.map((a, ai) => {
                  const r = get(t.id, m.id, a.id);
                  const s = samplerOf(r.policy);
                  const key = `${t.id}|${m.id}|${a.id}`;
                  const yy = y0 + 22 + ai * 23;
                  return (
                    <g key={a.id} onMouseEnter={() => setHover(key)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
                      <text x={x0 + 14} y={yy + 4} fill={a.id === "sc" ? P.candi : P.dim2} fontSize={10.5} fontWeight={a.id === "sc" ? 700 : 400}>{SHORT_ARM[a.id]}</text>
                      <rect x={x0 + 56} y={yy - 9} width={92} height={18} rx={9}
                        fill={rgba(s.color(), hover === key ? 0.4 : 0.2)} stroke={rgba(s.color(), 0.7)} />
                      <text x={x0 + 102} y={yy + 3.5} fill={s.color()} fontSize={9.5} textAnchor="middle">{s.short}</text>
                      <text x={x0 + cw - 14} y={yy + 4} fill={margin(r).pct < 2 ? P.warn : P.text} fontSize={10.5} fontWeight={600} textAnchor="end">{fmtMargin(margin(r))}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </g>
      ))}
      <g transform={`translate(${gx}, ${T + rowH * 3 + 24})`}>
        {h ? (() => {
          const t = taskOf(h.task);
          const mg = margin(h);
          const top = [h.samplers.find((p) => p.policy === h.policy), mg.runner];
          return (
            <text fill={P.muted} fontSize={11}>
              <tspan fill={methodOf(h.method).color()} fontWeight={700}>{methodOf(h.method).label}</tspan>
              <tspan> · {t.label} · {SHORT_ARM[h.arm]}:  </tspan>
              {top.map((p, i) => (
                <tspan key={p.policy} fill={samplerOf(p.policy).color()}>{i ? "  vs runner-up  " : "best "}{samplerOf(p.policy).label} {t.fmt(p.validation)}</tspan>
              ))}
              <tspan fill={P.text}>  ({fmtMargin(mg)})</tspan>
            </text>
          );
        })() : (
          <text fill={P.dim} fontSize={11}>Right number: lead over the runner-up sampler on validation. Hover for both scores.</text>
        )}
      </g>
    </svg>
  );
}

function SamplerGrid({ task }) {
  const t = taskOf(task);
  const L = 112, T = 44, cw = 100, ch = 30, gap = 12;
  const colX = (i) => L + i * cw + (i >= 3 ? gap : 0) + (i >= 5 ? 6 : 0);
  const rows = METHODS.flatMap((m) => ARMS.map((a) => ({ m, a, r: get(task, m.id, a.id) })));
  const yOf = (i) => T + i * ch + Math.floor(i / 3) * 10;
  const H = yOf(rows.length - 1) + ch + 20;
  return (
    <svg viewBox={`0 0 720 ${H}`} style={{ width: "100%", height: "auto", display: "block", fontFamily: FONT }}>
      <text x={colX(0) + (cw * 3) / 2} y={14} fill={P.muted} fontSize={10} textAnchor="middle" letterSpacing="0.1em">STANDARD</text>
      <text x={colX(3) + cw} y={14} fill={P.muted} fontSize={10} textAnchor="middle" letterSpacing="0.1em">RENOISING</text>
      <text x={colX(5) + 34} y={14} fill={P.muted} fontSize={10} textAnchor="middle" letterSpacing="0.1em">LEAD</text>
      <text x={colX(5) + 34} y={T - 10} fill={P.dim} fontSize={9.5} textAnchor="middle">vs 2nd</text>
      {SAMPLER_LIST.map((s, i) => (
        <text key={s.id} x={colX(i) + cw / 2} y={T - 10} fill={s.color()} fontSize={10} textAnchor="middle">{s.label}</text>
      ))}
      {rows.map(({ m, a, r }, i) => {
        const y0 = yOf(i);
        const best = Math.max(...r.samplers.map((p) => p.validation));
        return (
          <g key={`${m.id}${a.id}`}>
            {i % 3 === 0 && <><circle cx={8} cy={y0 + ch / 2} r={4} fill={m.color()} />
              <text x={16} y={y0 + ch / 2 + 4} fill={P.text} fontSize={11}>{m.label}</text></>}
            <text x={L - 10} y={y0 + ch / 2 + 4} fill={a.id === "sc" ? P.candi : P.dim2} fontSize={10.5} textAnchor="end" fontWeight={a.id === "sc" ? 700 : 400}>{SHORT_ARM[a.id]}</text>
            <text x={colX(5) + 34} y={y0 + ch / 2 + 4} fill={margin(r).pct < 2 ? P.warn : P.text} fontSize={11} fontWeight={700} textAnchor="middle">{fmtMargin(margin(r))}</text>
            {SAMPLER_LIST.map((s, si) => {
              const p = r.samplers.find((q) => q.policy === s.id);
              const frac = best > 0 ? Math.max(0, p.validation / best) : 0;
              const win = p.policy === r.policy;
              return (
                <g key={s.id}>
                  <rect x={colX(si) + 2} y={y0 + 2} width={cw - 4} height={ch - 4} rx={6}
                    fill={rgba(P.accent, 0.05 + 0.55 * frac ** 3)} stroke={win ? P.text : "transparent"} strokeWidth={1.5} />
                  <text x={colX(si) + cw / 2} y={y0 + ch / 2 + 4} fill={win ? P.text : P.muted} fontSize={10.5} fontWeight={win ? 700 : 400} textAnchor="middle">{t.fmt(p.validation)}</text>
                  <title>{`${s.label}: ${t.fmt(p.validation)} validation; tuned ${JSON.stringify(p.params)}`}</title>
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}

export const SamplerChoice = withVizTheme(SamplerChoiceInner);
export const HeadToHead = withVizTheme(HeadToHeadInner);
export const Dumbbells = withVizTheme(DumbbellsInner);
export const GapGrid = withVizTheme(GapGridInner);
export default HeadToHead;
