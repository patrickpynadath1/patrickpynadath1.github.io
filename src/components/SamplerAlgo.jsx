// The sampling algorithm behind every sampler, as one template with slots (Part 2; `general` drops
// the notes about Part 2's runs for the design-framework post).
// Pick a sampler, a corruption (or a hybrid) and SC; the template fills in.
// Source of truth: candi core/samplers/composed.py (the shared loop), policies.py,
// psi.py, churn.py, hybrid_updates.py and each process's reverse/corrupt_state, with
// the settings in configs/inference/inference_policies/{hybrid_renoising,eb_churn,psi,anchoring}.yaml.
import { useState } from "react";
import katex from "katex";
import { P, withVizTheme } from "./vizTheme.js";
import { FONT, Frame, rgba } from "./SelfCondDepth.jsx";

const SAMPLERS = [
  { id: "general", label: "Template" }, { id: "native", label: "native" }, { id: "native_greedy", label: "native greedy" },
  { id: "renoise", label: "renoise" }, { id: "renoise_greedy", label: "renoise greedy" }, { id: "eb_greedy", label: "EB greedy" },
  { id: "eb_churn", label: "EB churn" }, { id: "psi", label: "Ψ" }, { id: "anchor_native", label: "anchor native" },
  { id: "anchor_renoise", label: "anchor renoise" },
];
const CORRUPTIONS = [
  { id: "masked", label: "Masked" }, { id: "uniform", label: "Uniform" }, { id: "gaussian", label: "Gaussian" },
  { id: "simplex", label: "Simplex" }, { id: "spherical", label: "Spherical" }, { id: "vmf", label: "vMF" }, { id: "hybrid", label: "Hybrid" },
];
const CONT = ["gaussian", "simplex", "spherical", "vmf"];

// One view: its state, prior, clean encoding e(x), clean fraction α (Ψ), native update R and forward kernel K.
// τ is the view's own time: t for discrete views, τ = Q(t) (the learned CDCD map) for continuous ones.
const DISC_SCHED = String.raw`\alpha_t = \epsilon + (1-\epsilon)(1-t), \ \epsilon = 10^{-3} \ \text{(log-linear keep rate)}`;
const VIEW = {
  masked: {
    label: "Masked", discrete: true,
    space: String.raw`z_i \in \mathcal V \cup \{\mathtt m\}`,
    sched: DISC_SCHED,
    prior: String.raw`z_i = \mathtt m`,
    enc: String.raw`e(x) = x`,
    alpha: String.raw`\alpha_t`,
    R: String.raw`z_{s,i} \sim \mathrm{Cat}\!\Big(\tfrac{(\alpha_s-\alpha_t)\,\hat p_i \,+\, (1-\alpha_s)\,\delta_{\mathtt m}}{1-\alpha_t}\Big) \text{ if } z_{t,i} = \mathtt m, \ \text{else } z_{s,i} = z_{t,i}`,
    K: String.raw`z_{s,i} = x \text{ w.p. } \alpha_s, \ \text{else } \mathtt m`,
    R0: String.raw`z_{s,i} = z_{t,i} \ (\text{stays } \mathtt m)`,
    churn: String.raw`z_i \leftarrow \mathtt m`,
  },
  uniform: {
    label: "Uniform", discrete: true,
    space: String.raw`z_i \in \mathcal V`,
    sched: DISC_SCHED,
    prior: String.raw`z_i \sim \mathrm{Unif}(\mathcal V)`,
    enc: String.raw`e(x) = x`,
    alpha: String.raw`\alpha_t`,
    R: String.raw`z_{s,i} \sim \mathrm{Cat}\Big(\textstyle\propto q_{t|s}(z_{t,i}\mid z) \sum_{x} \frac{\hat p_i(x)}{q_t(z_{t,i}\mid x)}\, q_s(z\mid x)\Big), \ \ q_s(z\mid x) = \alpha_s\delta_x(z) + \tfrac{1-\alpha_s}{|\mathcal V|}, \ \ q_{t|s}(z'\mid z) = \tfrac{\alpha_t}{\alpha_s}\delta_z(z') + \big(1-\tfrac{\alpha_t}{\alpha_s}\big)\tfrac{1}{|\mathcal V|}`,
    K: String.raw`z_{s,i} = x \text{ w.p. } \alpha_s, \ \text{else } \sim \mathrm{Unif}(\mathcal V)`,
    R0: String.raw`R \ (\text{no Gaussian noise to zero})`,
    churn: String.raw`z_i \leftarrow K_t(y_i)`,
  },
  gaussian: {
    label: "Gaussian",
    space: String.raw`z_i \in \mathbb R^{512}`,
    sched: String.raw`\alpha_\tau = 1-\lambda_\tau, \ \sigma_\tau = \lambda_\tau; \ \ \lambda_\tau = r^{-1}(\rho_\tau), \ r(\lambda) = \mathbb E_c\big[\Phi\big(-\tfrac{1-\lambda}{\lambda}\sqrt{\tfrac{1-c}{2}}\big)\big] \ (c: \text{cosine of two random unit vectors in } \mathbb R^{512}), \ \rho_\tau = 0.01 + 0.48\,\tfrac{\tau-0.01}{0.98} \text{ on } [0.01, 0.99], \text{ linear to } 0, 1 \text{ at the ends}`,
    prior: String.raw`z_i \sim \mathcal N(0, I)`,
    enc: String.raw`e(x) = E_x, \ \lVert E_x\rVert = 1 \ \text{(learned)}`,
    alpha: String.raw`\alpha_\tau^2 / (\alpha_\tau^2 + \sigma_\tau^2)`,
    R: String.raw`\bar x_i = \textstyle\sum_v \hat p_i(v) E_v, \ \ z_{s,i} = \tfrac{\alpha_{t|s}\sigma_s^2}{\sigma_t^2} z_{t,i} + \tfrac{\alpha_s \sigma_{t|s}^2}{\sigma_t^2} \bar x_i + \tfrac{\sigma_{t|s}\sigma_s}{\sigma_t}\epsilon, \ \ \alpha_{t|s} = \tfrac{\alpha_t}{\alpha_s}, \ \sigma^2_{t|s} = \sigma_t^2 - \alpha_{t|s}^2\sigma_s^2 \ \ (\epsilon = 0 \text{ on the last step})`,
    K: String.raw`z_{s,i} = \alpha_s E_x + \sigma_s \epsilon, \ \epsilon \sim \mathcal N(0, I)`,
    R0: String.raw`R \text{ with } \epsilon = 0`,
    churn: String.raw`z_i \leftarrow K_t(y_i)`,
  },
  simplex: {
    label: "Simplex",
    space: String.raw`z_i \in \Delta^{|\mathcal V|-1}`,
    sched: String.raw`\alpha_\tau = 1-\tau; \ \ c_\tau = \tfrac{1}{\nu_\tau} - 1, \ \nu_\tau = 0.4 + 0.35\,\mathrm{clip}\big(\tfrac{\tau - 0.8}{0.2}, 0, 1\big); \ \ \pi = \mathrm{Unif}(\mathcal V)`,
    prior: String.raw`z_i \sim \mathrm{Dir}(c_1 \pi), \ c_1 = \tfrac13`,
    enc: String.raw`e(x) = \delta_x \ \text{(vertex)}`,
    alpha: String.raw`\alpha_\tau = 1-\tau`,
    R: String.raw`\tilde x_i \sim \hat p_i, \ \ z_{s,i} \sim \mathrm{Dir}\big(c_s[(1-s)\,\delta_{\tilde x_i} + s\,\pi]\big) \ \ (\text{Dirichlet bridge at churn} = 1)`,
    K: String.raw`z_{s,i} \sim \mathrm{Dir}\big(c_s[(1-s)\,\delta_x + s\,\pi]\big)`,
    R0: String.raw`R \ (\text{the bridge ignores the noise setting})`,
    churn: String.raw`z_i \leftarrow K_t(y_i)`,
  },
  spherical: {
    label: "Spherical",
    space: String.raw`z_i \in \mathbb S^{511}`,
    sched: String.raw`a_\tau = a_{\max} + (\epsilon - a_{\max})\tau, \ \epsilon = 10^{-3}, \ a_{\max} = \tfrac{2}{\pi}\arcsin\min\Big\{1, \sqrt{\tfrac{2}{512}\ln\tfrac{2(|\mathcal V|-1)}{0.1}}\Big\}`,
    prior: String.raw`z_i \sim \mathrm{Unif}(\mathbb S^{511})`,
    enc: String.raw`e(x) = \bar E_x = E_x / \lVert E_x \rVert`,
    alpha: String.raw`1 - \tau`,
    R: String.raw`v_i = \textstyle\sum_v \hat p_i(v) \tfrac{\theta_{iv}}{\sin\theta_{iv}}\big(\bar E_v - \cos\theta_{iv}\, z_{t,i}\big), \ \cos\theta_{iv} = \langle z_{t,i}, \bar E_v\rangle; \ \ z_{s,i} = \exp_{z_{t,i}}\!\Big(\tfrac{a_s - a_t}{1 - a_t}\, v_i\Big) \ (\text{deterministic})`,
    K: String.raw`z_{s,i} = \mathrm{slerp}(\bar E_x, n;\, 1 - a_s), \ n \sim \mathrm{Unif}(\mathbb S^{511})`,
    R0: String.raw`R \ (\text{already deterministic})`,
    churn: String.raw`z_i \leftarrow K_t(y_i)`,
  },
  vmf: {
    label: "vMF",
    space: String.raw`z_i \in \mathbb S^{511}`,
    sched: String.raw`\kappa_\tau = 250\,(1-\tau), \ \dot\kappa_\tau = -250; \ \ f_\kappa(c) \propto (1-c^2)^{\frac{509}{2}} e^{\kappa c} \ (\text{density of } \langle z, \bar E_x\rangle), \ m_\kappa = \mathbb E_{f_\kappa}[c], \ \psi_\kappa(c) = \tfrac{1}{f_\kappa(c)(1-c^2)}\int_{-1}^{c} (m_\kappa - u)\, f_\kappa(u)\, du \ (\psi_0 = \tfrac{1}{511})`,
    prior: String.raw`z_i \sim \mathrm{Unif}(\mathbb S^{511})`,
    enc: String.raw`e(x) = \bar E_x = E_x / \lVert E_x \rVert`,
    alpha: String.raw`1 - \tau`,
    R: String.raw`v_i = \textstyle\sum_v \hat p_i(v)\, \psi_{\kappa_t}(c_{iv})\big(\bar E_v - c_{iv}\, z_{t,i}\big), \ c_{iv} = \langle z_{t,i}, \bar E_v\rangle; \ \ z_{s,i} = \mathrm{normalize}\big(z_{t,i} + 250\,(t - s)\, v_i\big) \ (\text{Euler; deterministic})`,
    K: String.raw`c \sim F_{\kappa_s}^{-1}(U), \ U \sim \mathrm{Unif}[0,1], \ z_{s,i} = c\,\bar E_x + \sqrt{1-c^2}\; n_\perp \ (n_\perp: \text{random unit vector} \perp \bar E_x)`,
    R0: String.raw`R \ (\text{already deterministic})`,
    churn: String.raw`z_i \leftarrow K_t(y_i)`,
  },
};

const SLOT_COLOR = { TOKENS: "accent", POSITIONS: "duo", TRANSITION: "candi", COMMIT: "highlight", CHURN: "mdlm", SC: "candi", DECODE: "accent", HYBRID: "duo" };

// Each line: { k: indent, t: text with $math$, slot?: name when the line is a filled slot }.
function lines(sampler, hybrid, sc, clock = "controller", general = false) {
  const G = sampler === "general";
  const commit = ["eb_greedy", "eb_churn", "anchor_native", "anchor_renoise"].includes(sampler);
  const eb = sampler.startsWith("eb");
  const anchor = sampler.startsWith("anchor");
  const z = hybrid ? String.raw`(z^{d}, z^{c})` : "z";
  const f = sc || G ? String.raw`f_\theta(${z}, t, h)` : String.raw`f_\theta(${z}, t)`;
  const out = [];
  const L = (k, t, slot) => out.push({ k, t, slot });
  L(0, String.raw`**input** prompt tokens $x_{\mathcal P}$ (positions $\mathcal P$ fixed); generated positions $\mathcal G$; steps $${general ? "S" : "S = 127"}$; grid $t_k = 1 - k\,\tfrac{1-\varepsilon}{S}$, $\varepsilon = 10^{-5}$${sampler === "psi" || G ? " (Ψ loop schedule: grid warped so α holds flat on [t_off, t_on])" : ""}`);
  if (hybrid) L(0, String.raw`views: discrete $z^{d}$ at time $t$; continuous $z^{c}$ at $\tau = Q(t)$ (learned CDCD map)`, "HYBRID");
  L(0, String.raw`$z \leftarrow \text{prior}$ (per view); $z_{\mathcal P} \leftarrow e(x_{\mathcal P})$`);
  L(0, String.raw`$\mathcal C \leftarrow \mathcal P$ (committed), $y \leftarrow x_{\mathcal P}$ (output buffer)${sc || G ? ", $h \\leftarrow 0$" : ""}`);
  L(0, String.raw`**for** $k = 0, \dots, S-1$: $\ t \leftarrow t_k,\ s \leftarrow t_{k+1}$`);
  if (G) L(1, String.raw`$\mathsf{Churn}(\mathcal C, z)$`, "CHURN");
  else if (sampler === "eb_churn") {
    L(1, String.raw`$\rho_k = r \max\!\big(0,\, 1 - \tfrac{k}{(S-1) f}\big)$; each $i \in \mathcal C \setminus \mathcal P$ is released w.p. $\rho_k$: $\ \mathcal C \leftarrow \mathcal C \setminus \{i\}$, $\ z_i \leftarrow \mathsf{reset}(z_i)$ (churn reset, below)`, "CHURN");
  }
  L(1, commit || G ? String.raw`$\mathcal A \leftarrow \mathcal G \setminus \mathcal C$ ${G ? "(commitment: freeze) or $\\mathcal G$ (none)" : ""}` : String.raw`$\mathcal A \leftarrow \mathcal G$`);
  L(1, String.raw`$\hat p^{\,0} \leftarrow \mathrm{softmax}\,${f}$, $\ \hat p \leftarrow \mathrm{top}_p\big(\mathrm{softmax}(\log \hat p^{\,0} / T)\big)$ ${hybrid ? "(one $\\hat p$ for both views)" : ""} ▹ 1 NFE`);
  if (G) L(1, String.raw`$\mathsf{SC}(h, \hat p^{\,0})$`, "SC");
  else if (sc) L(1, String.raw`$h_i \leftarrow \sum_v \hat p^{\,0}_i(v)\, e_v$ (expected embedding of the untempered prediction, fed to the next call)`, "SC");
  // positions
  if (G) L(1, String.raw`$\mathcal M \leftarrow \mathsf{Positions}(\hat p, \mathcal A)$`, "POSITIONS");
  else if (eb) L(1, String.raw`sort $\mathcal A$ by $H(\hat p_i)$ ascending; $\mathcal M \leftarrow$ longest prefix with $\sum_{i \in \mathcal M} H(\hat p_i) - \max_{i \in \mathcal M} H(\hat p_i) \le \gamma$ (at least one)`, "POSITIONS");
  else if (anchor) L(1, String.raw`$\mathcal M \leftarrow$ random $\subseteq \mathcal A$ with $|\mathcal C \cup \mathcal M| = \mathrm{round}\big(|\mathcal G|\,(\tfrac{k+1}{S})^{p}\big)$ (all of $\mathcal A$ at $k = S-1$)`, "POSITIONS");
  else L(1, String.raw`$\mathcal M \leftarrow \mathcal A$ (every generated position)`);
  // tokens
  if (G) L(1, String.raw`$\hat x \leftarrow \mathsf{Tokens}(\hat p)$`, "TOKENS");
  else if (sampler === "native") L(1, String.raw`no token draw: the update uses all of $\hat p_i$`, "TOKENS");
  else if (["native_greedy", "renoise_greedy", "eb_greedy", "eb_churn"].includes(sampler)) L(1, String.raw`$\hat x_i \leftarrow \arg\max_v \hat p_i(v)$${sampler === "native_greedy" ? ", and $\\hat p_i \\leftarrow \\delta_{\\hat x_i}$ inside the update" : ""}`, "TOKENS");
  else if (anchor) L(1, String.raw`$\hat x_i \sim \hat p_i$ or $\hat x_i = \arg\max \hat p_i$ (tuned)`, "TOKENS");
  else L(1, String.raw`$\hat x_i \sim \hat p_i$`, "TOKENS");
  if (sampler === "psi") {
    L(1, String.raw`$\sigma_t = \eta\,\sigma_t^{\max}$ (rescale) or $\min(\eta, \sigma_t^{\max})$ (cap), $\sigma_t^{\max} = \min\{1, \tfrac{1-\alpha_s}{\alpha_t}\}$; $\ \kappa_t = 1 - \tfrac{\sigma_t}{1-\alpha_s}$, ${clock === "corruption" ? `with $\\alpha_t$ the ${hybrid ? "discrete view's" : "view's"} corruption level ${hybrid ? "(its keep rate at $t$)" : "at its own time (row \"Ψ's $\\\\alpha$\" below)"} (corruption clock, Ψ·c)` : `with $\\alpha_t = 1 - t$ on the shared grid (controller clock, Ψ·t; every view${hybrid ? ", both views" : ""})`}`, "TRANSITION");
    L(1, String.raw`$b_i \sim \mathrm{Bernoulli}(\kappa_t)$ per position${hybrid ? " (shared by both views)" : ""}`, "TRANSITION");
  }
  // transition
  const tr = G ? String.raw`\mathsf{Transition}(z_{t,i}, \hat p_i, \hat x_i;\ t \to s)`
    : sampler === "native" ? String.raw`R(z_{t,i}, \hat p_i;\ t \to s)`
    : sampler === "native_greedy" ? String.raw`R(z_{t,i}, \delta_{\hat x_i};\ t \to s)`
    : sampler.startsWith("renoise") || sampler === "anchor_renoise" ? String.raw`K_s(\hat x_i)`
    : eb ? String.raw`R_0(z_{t,i}, \hat p_i;\ t \to s)`
    : sampler === "psi" ? String.raw`b_i \,?\, R(z_{t,i}, \hat p_i;\ t \to s) : K_s(\hat x_i)`
    : String.raw`R(z_{t,i}, \hat p_i;\ t \to s)`;
  L(1, String.raw`**for** $i \in \mathcal A$: $\ z_{s,i} \leftarrow ${tr}$ ${hybrid ? "(each view with its own $R$, $K$ and time)" : ""}`, "TRANSITION");
  // commit
  if (G) L(1, String.raw`$\mathsf{Commit}(\mathcal M, \hat x)$`, "COMMIT");
  else if (commit) {
    L(1, String.raw`$\mathcal C \leftarrow \mathcal C \cup \mathcal M$, $\ y_{\mathcal M} \leftarrow \hat x_{\mathcal M}$, $\ z_{\mathcal C} \leftarrow e(y_{\mathcal C})$ (frozen from now on)`, "COMMIT");
    L(1, String.raw`**if** $\mathcal C = \mathcal P \cup \mathcal G$: stop`, "COMMIT");
  }
  // decode
  if (G) L(0, String.raw`$\mathsf{Decode}$: $\hat p \leftarrow f_\theta(${z}, t_S, h)$ ▹ 1 NFE; $x$ from $\hat p$`, "DECODE");
  else if (commit) L(0, String.raw`**if** $\mathcal C \ne \mathcal P \cup \mathcal G$: $\ \hat p \leftarrow ${f.replace(", t", ", t_S")}$ ▹ 1 NFE; $\ y_i \leftarrow \arg\max \hat p_i$ for $i \notin \mathcal C$`, "DECODE");
  else L(0, String.raw`$\hat p \leftarrow ${f.replace(", t", ", t_S")}$ ▹ 1 NFE; $\ x_i \leftarrow \arg\max \hat p_i$${["native_greedy", "renoise_greedy"].includes(sampler) ? " or $x_i \\sim \\hat p_i$ (tuned)" : ""}`, "DECODE");
  L(0, String.raw`**return** ${commit ? "$y$" : "$x$"}, with $x_{\mathcal P}$ restored; $\ $NFE ${commit ? (anchor ? (general ? "$= S$" : "$= S = 127$") + " (all committed at the last step, so no decode call)" : "$\\le S + 1$ (stops once all are committed)") : (general ? "$= S + 1$" : "$= S + 1 = 128$")}`);
  return out;
}

const tex = (s) => katex.renderToString(s, { throwOnError: false, output: "html" });
function Rich({ text }) {
  // $...$ is math, **...** is bold, the rest is text.
  const parts = text.split(/(\$[^$]+\$|\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((p, i) => p.startsWith("$") ? <span key={i} dangerouslySetInnerHTML={{ __html: tex(p.slice(1, -1)) }} />
    : p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b> : <span key={i}>{p}</span>);
}

function Chips({ value, onChange, options, label }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
      <span style={{ fontFamily: FONT, fontSize: 10.5, color: P.dim2, minWidth: 74 }}>{label}</span>
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} type="button" onClick={() => onChange(o.id)} aria-pressed={on} style={{
            border: `1px solid ${on ? rgba(P.accent, 0.6) : P.line2}`, cursor: "pointer", borderRadius: 999, padding: "4px 10px",
            fontFamily: FONT, fontSize: 11, background: on ? rgba(P.accent, 0.2) : P.inset, color: on ? P.accentSoft : P.muted,
          }}>{o.label}</button>
        );
      })}
    </div>
  );
}

function Defs({ view, tag, general }) {
  const v = VIEW[view];
  const rows = [["state", v.space], ["schedule", v.sched], ["prior", v.prior], ["clean encoding", v.enc], ["native update $R$", v.R], ["forward kernel $K_s(x)$", v.K],
    ["$R_0$ (EB, zero noise)", v.R0], ["churn reset", v.churn], ...(tag.startsWith("continuous") ? [] : [["Ψ's $\\alpha$ on the corruption clock", v.alpha]])]; // hybrids take Ψ's α from the discrete view
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: FONT, fontSize: 11, fontWeight: 700, color: P.text, margin: "0 0 6px" }}>{tag}{v.label} view</div>
      <div style={{ fontSize: 12, color: P.muted, margin: "0 0 8px" }}><Rich text={v.discrete ? "In $R$ and $K$, $t \\to s$ is this view's step on the shared grid." : "In $R$, $K$ and the schedule, $t \\to s$ is this view's own step: $\\tau_k = Q(t_k)$, the learned CDCD map applied to the grid."} /></div>
      <div style={{ display: "grid", gap: 8, fontSize: 13, color: P.text }}>
        {rows.map(([k, m]) => (
          <div key={k} style={{ minWidth: 0 }}>
            <div style={{ fontFamily: FONT, fontSize: 10.5, color: P.muted }}><Rich text={k} /></div>
            <div style={{ overflowX: "auto", minWidth: 0, padding: "1px 0 3px 10px" }} dangerouslySetInnerHTML={{ __html: tex(m) }} />
          </div>
        ))}
      </div>
    </div>
  );
}

function notes(sampler, corr, disc, cont, sc, g = false) {
  const n = [];
  const views = corr === "hybrid" ? [disc, cont] : [corr];
  if (corr === "hybrid") n.push("Hybrid: one network call sees both views and returns one p̂; every per-position draw (x̂, Ψ's coin b, EB's set M) is shared, and each view applies its own R or K. The continuous view runs at τ = Q(t)" + (g ? ", its learned clock." : ", which for these hybrids is ≈ 0.99 from t = 0.01 on (collapsed clock)."));
  if (views.includes("simplex") && ["native", "native_greedy", "psi"].includes(sampler)) n.push("Simplex: with churn = 1" + (g ? "" : " (the setting used)") + ", the native update draws a token from p̂ and re-samples the forward marginal, so native ≡ renoise and Ψ's two branches coincide." + (g ? "" : " Their validation scores are identical in 3 of 6 simplex cases."));
  if (sampler === "psi") n.push((g ? "Ψ takes one of two clocks for α" : "Ψ is run, and selected over, with both clocks, as two samplers") + ": the controller clock (Ψ·t, α_t = 1 − t on the grid) and the corruption clock (Ψ·c, α_t = the view's own corruption level: Gaussian sigmoid(log-SNR) = α_τ²/(α_τ² + σ_τ²), simplex α_τ, discrete keep rate, spherical and vMF 1 − τ; hybrids use the discrete view's). For continuous views the two are not equivalent: the learned clock warps τ, and the corruption level is nonlinear in it. For discrete views and hybrids they differ only by the 10⁻³ floor.");
  if (sampler === "psi") n.push("Ψ: κ = 1 is native, κ = 0 is renoise. For discrete views K is the paper's α_s δ_x̂ + (1 − α_s) π, and the paper's rule is α_t ≈ 1 − t; for continuous views K is that process's forward kernel, which extends the paper by analogy.");
  if (sampler.startsWith("eb") && views.includes("masked")) n.push("EB on a masked view: uncommitted positions stay masked (preserve_absorbing), so each step only reveals the committed set." + (g ? "" : " On text8 (no prompt) EB greedy is deterministic: every sample is the same string."));
  if (sampler.startsWith("eb") && views.some((v) => CONT.includes(v))) n.push("EB on a continuous view: uncommitted positions take the native update with its Gaussian noise set to zero; committed ones are clamped to e(x̂). The continuous models never see clamped embeddings in training.");
  if (!g && sampler.startsWith("anchor") && (corr === "hybrid" || !CONT.includes(corr))) n.push("Random anchoring was run only on the 24 pure continuous models; the algorithm is defined for this choice but has no results.");
  if (sampler.startsWith("anchor")) n.push(g ? "Anchoring commits every position by the last step, so the decode call is skipped: S network calls instead of S + 1." : "Anchoring commits every position by the last step, so the decode call is skipped: these samplers used 127 network calls, the others 128.");
  if (sc) n.push("SC adds no network calls: the previous call's expected embedding is an extra input to the next call (zero at the first). Training uses the same input from a no-grad pass on 90% of rows.");
  if (!g) n.push("Tuned per sampler: temperature T (0.5–1.5) everywhere; plus top-p, η and the κ schedule (Ψ); γ (EB); r and f (EB churn); p and sampled-vs-argmax tokens (anchoring); the last decode, argmax or sampled (greedy variants).");
  return n;
}

// ─── Layout pieces ────────────────────────────────────────────────────────────
// What each slot of the loop decides, in plain words.
const SLOT_INFO = {
  HYBRID: "the two views and the time each one runs on",
  CHURN: "release some committed positions so they can change again",
  SC: "what is fed back to the next network call",
  POSITIONS: "which positions are chosen this step",
  TOKENS: "how a token is picked from the prediction",
  TRANSITION: "how each position's state moves from t to s",
  COMMIT: "freeze the chosen positions to their token",
  DECODE: "the final read-out to tokens",
};

// The symbols the loop uses for the current choice, grouped so they can be scanned.
function symbols(sampler, hybrid, sc, general) {
  const G = sampler === "general";
  const commit = G || ["eb_greedy", "eb_churn", "anchor_native", "anchor_renoise"].includes(sampler);
  const groups = [
    ["Sequence", [
      [String.raw`x_{\mathcal P}`, "the prompt tokens"],
      [String.raw`\mathcal P,\ \mathcal G`, "prompt positions (fixed) and generated positions"],
      ["i", "one position"],
    ]],
    ["State and time", [
      ["z", hybrid ? "the noisy state, one per view" : "the noisy state"],
      ["e(x)", "the clean encoding of token x in that state space"],
      [String.raw`t \to s`, "the current time and the next one on the grid"],
      ["S", "the number of steps"],
      ...(hybrid ? [[String.raw`\tau = Q(t)`, "the continuous view's own time"]] : []),
    ]],
    ["Network", [
      [String.raw`f_\theta`, "the network"],
      [String.raw`\hat p_i`, "its predicted distribution over tokens at position i"],
      ["T", "temperature"],
      [String.raw`\hat x_i`, "a token picked from the prediction"],
      ...(sc || G ? [["h", "the self-conditioning input"]] : []),
    ]],
    ["Updates", [
      ["R", "the corruption's own reverse step"],
      ["K_s", "the forward kernel: fresh noise at time s"],
      ...(G || sampler.startsWith("eb") ? [["R_0", "the reverse step with its noise set to zero"]] : []),
    ]],
    ...(commit ? [["Commitment", [
      [String.raw`\mathcal C`, "committed (frozen) positions"],
      [String.raw`\mathcal A`, "positions still free to move"],
      [String.raw`\mathcal M`, "positions chosen this step"],
      ["y", "the output buffer of committed tokens"],
    ]]] : []),
    ...(sampler.startsWith("eb") ? [["Entropy bound", [
      [String.raw`H(\hat p_i)`, "entropy of the prediction at position i"],
      [String.raw`\gamma`, "the entropy budget per step"],
      ...(sampler === "eb_churn" ? [[String.raw`\rho_k,\ r,\ f`, "release probability, its starting rate, and when it reaches zero"]] : []),
    ]]] : []),
    ...(sampler.startsWith("anchor") ? [["Anchoring", [["p", "the power of the commit schedule (larger commits later)"]]]] : []),
    ...(sampler === "psi" ? [["Ψ", [
      [String.raw`\kappa_t`, "the chance a position takes the reverse step instead of fresh noise"],
      [String.raw`\eta,\ \sigma_t`, "the noise setting and the resulting noise level"],
      ["b_i", "the coin flip per position"],
    ]]] : []),
  ];
  return groups;
}

function Box({ title, hint, children }) {
  return (
    <div style={{ border: `1px solid ${P.line}`, borderRadius: 12, background: P.inset, marginTop: 14, overflow: "hidden" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: "2px 10px", padding: "8px 14px", borderBottom: `1px solid ${P.line}`, background: rgba(P.accent, 0.06) }}>
        <span style={{ fontFamily: FONT, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: P.accent }}>{title}</span>
        {hint && <span style={{ fontSize: 12, color: P.dim2 }}>{hint}</span>}
      </div>
      <div style={{ padding: "10px 14px" }}>{children}</div>
    </div>
  );
}

function Symbols({ groups }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "12px 22px" }}>
      {groups.map(([name, rows]) => (
        <div key={name} style={{ minWidth: 0 }}>
          <div style={{ fontFamily: FONT, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: P.dim2, marginBottom: 4 }}>{name}</div>
          {rows.map(([sym, meaning]) => (
            <div key={sym} style={{ display: "grid", gridTemplateColumns: "64px 1fr", gap: 8, alignItems: "baseline", padding: "2px 0", fontSize: 12.5, color: P.muted, lineHeight: 1.4 }}>
              <span style={{ color: P.text }} dangerouslySetInnerHTML={{ __html: tex(sym) }} />
              <span>{meaning}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Line({ l, n }) {
  const c = l.slot ? P[SLOT_COLOR[l.slot]] : null;
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "baseline", padding: "4px 12px 4px 0", background: c ? rgba(c, 0.07) : "transparent", borderLeft: `3px solid ${c || "transparent"}` }}>
      <span style={{ fontFamily: FONT, fontSize: 10, color: P.dim, width: 22, textAlign: "right", flexShrink: 0 }}>{n}</span>
      <span style={{ fontSize: 14, color: P.text, paddingLeft: l.k * 18, flex: 1, minWidth: 0, lineHeight: 1.6 }}><Rich text={l.t} /></span>
      {l.slot && <span style={{ fontFamily: FONT, fontSize: 9, letterSpacing: "0.08em", color: c, flexShrink: 0 }}>{l.slot}</span>}
    </div>
  );
}

// The loop in three phases, so it reads as set up, repeat, finish.
function Loop({ L }) {
  const start = L.findIndex((l) => l.t.startsWith("**for** $k"));
  let end = start + 1;
  while (end < L.length && L[end].k >= 1) end += 1;
  const phases = [["Set up", L.slice(0, start), 0], ["Repeat for every step", L.slice(start, end), start], ["Finish", L.slice(end), end]];
  return (
    <div style={{ margin: "-10px -14px", overflowX: "auto" }}>
      {phases.map(([name, ls, off], pi) => (
        <div key={name} style={{ borderTop: pi ? `1px dashed ${P.line2}` : "none", padding: "8px 0 6px" }}>
          <div style={{ fontFamily: FONT, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase", color: P.dim2, padding: "0 14px 4px 35px" }}>{name}</div>
          {ls.map((l, i) => <Line key={i} l={l} n={off + i + 1} />)}
        </div>
      ))}
    </div>
  );
}

// A note becomes a short label plus its text.
function splitNote(t) {
  const tags = [["Hybrid", "Hybrid"], ["Simplex", "Simplex"], ["Ψ", "Ψ"], ["EB", "Entropy bound"], ["Random anchoring", "Anchoring"], ["Anchoring", "Anchoring"], ["SC", "Self conditioning"], ["Tuned", "Tuning"]];
  const hit = tags.find(([k]) => t.startsWith(k));
  if (!hit) return ["Note", t];
  const lead = `${hit[0]}: `;
  const body = t.startsWith(lead) ? t.slice(lead.length) : t;
  return [hit[1], body.charAt(0).toUpperCase() + body.slice(1)];
}

function SamplerAlgoInner({ general = false }) {
  const [sampler, setSampler] = useState("native");
  const [corr, setCorr] = useState("gaussian");
  const [disc, setDisc] = useState("masked");
  const [cont, setCont] = useState("gaussian");
  const [sc, setSc] = useState("on");
  const [clock, setClock] = useState("controller");
  const hybrid = corr === "hybrid";
  const L = lines(sampler, hybrid, sc === "on", sampler === "psi" ? clock : "controller", general);
  const slots = [...new Set(L.filter((l) => l.slot).map((l) => l.slot))];
  const ns = notes(sampler, corr, disc, cont, sc === "on", general).map(splitNote);
  const views = hybrid ? [[disc, "discrete · "], [cont, "continuous · "]] : [[corr, ""]];
  return (
    <Frame
      kicker={general ? "Inference · the samplers" : "Reference · the samplers"}
      title="One sampling loop; each sampler fills its slots"
      subtitle="Pick a sampler, a corruption and SC. Read the symbols first, then the loop. Colored lines are the slots this sampler fills. The corruption's formulas are folded away underneath."
      controls={<div style={{ display: "grid", gap: 8, width: "100%" }}>
        <Chips label="sampler" value={sampler} onChange={setSampler} options={SAMPLERS} />
        <Chips label="corruption" value={corr} onChange={setCorr} options={CORRUPTIONS} />
        {hybrid && <Chips label="discrete view" value={disc} onChange={setDisc} options={[{ id: "masked", label: "Masked" }, { id: "uniform", label: "Uniform" }]} />}
        {hybrid && <Chips label="continuous" value={cont} onChange={setCont} options={CONT.map((c) => ({ id: c, label: VIEW[c].label }))} />}
        <Chips label="SC" value={sc} onChange={setSc} options={[{ id: "off", label: "off" }, { id: "on", label: "on" }]} />
        {sampler === "psi" && <Chips label="Ψ clock" value={clock} onChange={setClock} options={[{ id: "controller", label: "controller time (Ψ·t)" }, { id: "corruption", label: "corruption level (Ψ·c)" }]} />}
      </div>}
      note={`Read from candi core/samplers (composed.py, policies.py, psi.py, churn.py, hybrid_updates.py) and each process's reverse and corrupt_state${general ? "" : ", with the settings of the runs in this post"}.`}
    >
      <Box title="Symbols" hint="everything the loop below refers to">
        <Symbols groups={symbols(sampler, hybrid, sc === "on", general)} />
      </Box>

      <Box title="The loop" hint="▹ 1 NFE marks a network call">
        <Loop L={L} />
      </Box>

      {slots.length > 0 && (
        <Box title="Slots" hint="the parts of the loop a sampler chooses">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "6px 22px" }}>
            {slots.map((sl) => (
              <div key={sl} style={{ display: "grid", gridTemplateColumns: "92px 1fr", gap: 8, alignItems: "baseline", fontSize: 12.5, color: P.muted, lineHeight: 1.4 }}>
                <span style={{ fontFamily: FONT, fontSize: 9.5, letterSpacing: "0.08em", color: P[SLOT_COLOR[sl]], borderLeft: `3px solid ${P[SLOT_COLOR[sl]]}`, paddingLeft: 7 }}>{sl}</span>
                <span>{SLOT_INFO[sl]}</span>
              </div>
            ))}
          </div>
        </Box>
      )}

      {ns.length > 0 && (
        <Box title="Good to know" hint="for this choice of sampler and corruption">
          <div style={{ display: "grid", gap: 8 }}>
            {ns.map(([tag, body], i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(88px, 120px) 1fr", gap: 10, alignItems: "baseline", fontSize: 12.5, color: P.muted, lineHeight: 1.55 }}>
                <span style={{ fontFamily: FONT, fontSize: 10.5, color: P.text }}>{tag}</span>
                <span>{body}</span>
              </div>
            ))}
          </div>
        </Box>
      )}

      <details style={{ border: `1px solid ${P.line}`, borderRadius: 12, background: P.inset, marginTop: 14 }}>
        <summary style={{ cursor: "pointer", padding: "9px 14px", fontFamily: FONT, fontSize: 10.5, letterSpacing: "0.12em", textTransform: "uppercase", color: P.accent }}>
          Formulas for {views.map(([v]) => VIEW[v].label).join(" + ")}
          <span style={{ fontFamily: "inherit", letterSpacing: 0, textTransform: "none", color: P.dim2, marginLeft: 10 }}>state, schedule, prior, R and K</span>
        </summary>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 18, padding: "4px 14px 14px" }}>
          {views.map(([v, tag]) => <Defs key={v + tag} view={v} tag={tag} general={general} />)}
        </div>
      </details>
    </Frame>
  );
}

export const SamplerAlgo = withVizTheme(SamplerAlgoInner);
