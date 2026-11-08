// Tiny syntax colouring for the bash and YAML shown in the "How this was run" panels.
// Returns React spans (no innerHTML). Colours come from the post's --viz-* tokens, so
// they follow the light/dark theme.
const C = {
  comment: { color: "var(--viz-dim)", fontStyle: "italic" },
  key: { color: "var(--viz-accent)" },
  str: { color: "var(--viz-good)" },
  num: { color: "var(--viz-orange)" },
  kw: { color: "var(--viz-mdlm)" },
  punct: { color: "var(--viz-dim2)" },
  interp: { color: "var(--viz-duo)" },
  cmd: { color: "var(--viz-accent)", fontWeight: 600 },
  flag: { color: "var(--viz-duo)" },
  envvar: { color: "var(--viz-highlight)" },
  override: { color: "var(--viz-orange)" },
};

// Index of a "#" that starts a comment (at line start or after whitespace, outside quotes).
function commentAt(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === "'" || ch === '"') { q = ch; continue; }
    if (ch === "#" && (i === 0 || /\s/.test(line[i - 1]))) return i;
  }
  return -1;
}

// Split text by a global regex; classify(match) gives the style for each match.
function tokens(text, re, classify, out) {
  let last = 0;
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push([null, text.slice(last, m.index)]);
    out.push([classify(m[0]), m[0]]);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push([null, text.slice(last)]);
}

const YAML_VALUE = /\$\{(?:[^{}]|\{[^}]*\})*\}|'[^']*'|"[^"]*"|\b(?:true|false|null)\b|(?<![\w./-])-?\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?(?![\w./-])|[\w.]+(?=:\s)|[\[\]{},]/g;
function yamlValue(text, out) {
  tokens(text, YAML_VALUE, (t) =>
    t.startsWith("${") ? C.interp
    : t[0] === "'" || t[0] === '"' ? C.str
    : /^(true|false|null)$/.test(t) ? C.num
    : /^-?\d/.test(t) ? C.num
    : /^[[\]{},]$/.test(t) ? C.punct
    : C.key, out);
}

function yamlLine(line) {
  const out = [];
  const c = commentAt(line);
  let code = c < 0 ? line : line.slice(0, c);
  const comment = c < 0 ? "" : line.slice(c);
  const m = code.match(/^(\s*)(-\s+)?(override\s+)?((?:[\w@/.~+$-]|\$\{[^}]*\})+|'[^']*'|"[^"]*")(\s*:)(?=\s|$)/);
  if (m) {
    out.push([null, m[1]]);
    if (m[2]) out.push([C.punct, m[2]]);
    if (m[3]) out.push([C.kw, m[3]]);
    out.push([C.key, m[4]]);
    out.push([C.punct, m[5]]);
    yamlValue(code.slice(m[0].length), out);
  } else {
    const d = code.match(/^(\s*)(-\s+|-$)/);
    if (d) { out.push([null, d[1]]); out.push([C.punct, d[2]]); code = code.slice(d[0].length); }
    yamlValue(code, out);
  }
  if (comment) out.push([C.comment, comment]);
  return out;
}

const BASH_CMDS = new Set(["uv", "python", "python3", "export", "huggingface-cli", "cd", "git", "pip"]);
const BASH = /\$\{[^}]*\}|\$[A-Za-z_]\w*|"(?:[^"\\]|\\.)*"|'[^']*'|(?<=^|\s)--?[A-Za-z][\w-]*|(?<=^|\s)[+~]{0,2}[A-Za-z_][\w.@/]*=|\\$|(?<=^|\s|\()[A-Za-z][\w-]*/g;
function bashLine(line, state) {
  const out = [];
  const c = commentAt(line);
  const code = c < 0 ? line : line.slice(0, c);
  // The first word of a command (not a continuation line) is the command itself.
  let first = !state.cont;
  tokens(code, BASH, (t) => {
    if (t === "\\") return C.punct;
    if (t[0] === "$") return C.envvar;
    if (t[0] === '"' || t[0] === "'") return C.str;
    if (t[0] === "-") return C.flag;
    if (t.endsWith("=")) return C.override;
    const isCmd = first && BASH_CMDS.has(t);
    first = false;
    return isCmd || (BASH_CMDS.has(t) && t !== "python") ? C.cmd : null;
  }, out);
  if (c >= 0) out.push([C.comment, line.slice(c)]);
  state.cont = /\\\s*$/.test(code);
  return out;
}

export function highlight(text, lang) {
  const lines = text.replace(/\n$/, "").split("\n");
  const state = {};
  return lines.map((ln, i) => {
    const toks = lang === "yaml" ? yamlLine(ln) : lang === "bash" ? bashLine(ln, state) : [[null, ln]];
    return (
      <span key={i}>
        {toks.map(([s, t], k) => (s ? <span key={k} style={s}>{t}</span> : t))}
        {"\n"}
      </span>
    );
  });
}

export const langOf = (path) => (/\.ya?ml$/.test(path) ? "yaml" : /\.(sh|bash)$/.test(path) ? "bash" : "text");
