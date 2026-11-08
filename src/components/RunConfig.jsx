// "How this was run": a collapsible preview under each experiment question, with the
// run commands, what the sweep varies, what it holds fixed, and the sweep YAML plus the
// recipe configs it composes. Data: src/data/run_configs.json, built by
// scripts/run-configs/run_configs.py from the SDDC repo at a pinned commit.
import { useState } from "react";
import DATA from "../data/run_configs.json";
import { highlight, langOf } from "./codeHighlight.jsx";

const S = {
  h: { font: "600 11px var(--font-mono)", letterSpacing: ".1em", textTransform: "uppercase", color: "var(--muted)", margin: "22px 0 8px" },
  pre: { margin: "0 0 6px", fontSize: 12.5, lineHeight: 1.6, maxHeight: 420, overflow: "auto" },
  chip: { display: "inline-block", padding: "1px 8px", margin: "2px 6px 2px 0", borderRadius: 6, fontSize: 13,
    boxShadow: "inset 0 0 0 1px var(--border)", background: "var(--surface)" },
  tab: (on) => ({ padding: "5px 12px", borderRadius: 8, border: 0, cursor: "pointer", fontSize: 13,
    background: on ? "var(--accent-wash)" : "transparent", color: on ? "var(--accent)" : "var(--fg)",
    boxShadow: on ? "none" : "inset 0 0 0 1px var(--border)" }),
  small: { fontSize: 13, color: "var(--muted)", lineHeight: 1.55, margin: "6px 0" },
  path: { font: "12.5px var(--font-mono)" },
};

function FileView({ f }) {
  return (
    <div>
      <div style={{ ...S.small, display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <a href={f.url} style={S.path}>{f.path}</a>
        {f.excerpt && <span>excerpt</span>}
      </div>
      <pre style={S.pre}><code>{highlight(f.text, langOf(f.path))}</code></pre>
    </div>
  );
}

function Configs({ q }) {
  const tabs = [...(q.sweep ? [{ label: "Sweep", files: [{ ...q.sweep }] }] : []), ...q.groups];
  const [tab, setTab] = useState(0);
  const [pick, setPick] = useState({});
  const g = tabs[tab];
  const i = Math.min(pick[tab] ?? 0, g.files.length - 1);
  const name = (p) => p.split("/").pop();
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }} role="tablist">
        {tabs.map((t, k) => (
          <button key={t.label} type="button" role="tab" aria-selected={k === tab} style={S.tab(k === tab)} onClick={() => setTab(k)}>
            {t.label}{t.files.length > 1 ? ` (${t.files.length})` : ""}
          </button>
        ))}
      </div>
      {g.files.length > 1 && (
        <label style={{ ...S.small, display: "flex", alignItems: "center", gap: 8 }}>
          File
          <select value={i} onChange={(e) => setPick({ ...pick, [tab]: +e.target.value })}
            style={{ font: "13px var(--font-mono)", padding: "4px 8px", borderRadius: 8, background: "var(--surface)", color: "var(--fg)", border: "1px solid var(--border)", maxWidth: "100%" }}>
            {g.files.map((f, k) => <option key={f.path} value={k}>{name(f.path)}</option>)}
          </select>
        </label>
      )}
      <FileView f={g.files[i]} />
      <p style={S.small}>Merge order: the sweep's own keys override its defaults, and the recipe files are picked by the sweeper axes.</p>
    </>
  );
}

export default function RunConfig({ id }) {
  const q = DATA.questions.find((x) => x.id === id);
  const [open, setOpen] = useState(false);
  if (!q) return null;
  const cases = q.axes.reduce((n, a) => n * a.values.length, 1);
  const see = q.see && DATA.questions.find((x) => x.id === q.see);
  return (
    <div className="expandable-section" id={`run-${q.id}`}>
      <button type="button" className="expandable-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="expandable-title">How this was run</span>
        <span className="expandable-icon">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="expandable-content">
          <p style={S.small}>
            Worked example <a href={q.dir_url} style={S.path}>{q.dir}/</a> in the SDDC repo at commit{" "}
            <a href={`${DATA.github}/tree/${DATA.sha}`} style={S.path}>{DATA.short}</a>.
          </p>

          <div style={S.h}>Run it</div>
          <pre style={S.pre}><code>{highlight(q.run, "bash")}</code></pre>

          {q.axes.length > 0 && (
            <>
              <div style={S.h}>What varies · {cases} cases</div>
              <table style={{ display: "table", width: "100%", boxShadow: "none", margin: 0 }}>
                <tbody>
                  {q.axes.map((a) => (
                    <tr key={a.key}>
                      <td style={{ padding: "6px 12px 6px 0", verticalAlign: "top", whiteSpace: "nowrap", fontWeight: 600 }}>{a.axis}</td>
                      <td style={{ padding: "4px 0" }}>{a.values.map((v) => <span key={v.value} style={S.chip} title={`${a.key}=${v.value}`}>{v.name}</span>)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          <div style={S.h}>Held fixed</div>
          <ul style={{ margin: "0 0 4px", paddingLeft: 20, fontSize: 14.5 }}>
            {q.fixed.map((f) => <li key={f}>{f}</li>)}
          </ul>

          <div style={S.h}>Configs</div>
          {q.sweep || q.groups.length ? <Configs q={q} /> : (
            <p style={S.small}>
              No sweep of its own: it reads the runs of{" "}
              {see ? <a href={`#run-${see.id}`}>{see.question.replace(/\?$/, "")}</a> : q.see}, whose panel shows the configs.
            </p>
          )}

          {q.notes.length > 0 && (
            <ul style={{ ...S.small, paddingLeft: 20, margin: "12px 0 16px" }}>
              {q.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
