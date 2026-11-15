// The opening simulation behind the box figures (BitBoxes.jsx). Pure functions, no drawing.
//
// The picture as a code (Richardson and Urbanke, Modern Coding Theory, §3.1-§3.5, §3.19):
//   - each color is one bit, a fair coin;
//   - a plain box is a copy of its bit; a blend box is the exclusive-or (XOR, parity) of its bits;
//   - writing a box into the state is like the channel revealing it.
//
// Two tallies per written box:
//   - Shannon cost: 1 if the box's value is not already fixed by the boxes written before it,
//     else 0. Over a whole run this adds up to the rank of all boxes over GF(2), whatever the
//     order (the chain rule, MacKay §8.1, p.138).
//   - Model cost: 0 if the model has worked the box out, else 1. A box the model has not worked
//     out is sampled as a fresh fair bit, which costs 1 bit of code length.
//   The model only works out boxes the state fixes, so model cost >= Shannon cost for every box.
//   This is Gibbs' inequality in miniature (MacKay §2.6, p.34; §5.4, p.98).
//
// The model's pass is a bounded number of peeling (belief propagation) rounds on the erasure
// channel (Richardson and Urbanke §3.5, §3.19; after l rounds a decision depends only on the
// depth-l computation graph, §3.7). One round: a bit becomes known if some written box holds
// it and every other bit in that box is already known. Treating the number of rounds per pass
// as the model's compute bound is this sketch's own framing (see Finzi et al. 2026 for the
// general idea of information relative to a compute bound).
//
// Self conditioning: the model keeps the bits it worked out on earlier passes and starts the
// next pass from them, instead of starting again from the state alone.

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const shuffle = (arr, r) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
};

// A GF(2) basis kept by pivot bit. reduce(m) is 0 exactly when m is fixed by what was added.
function makeBasis(piv = {}) {
  const P = { ...piv };
  const reduce = (m) => {
    for (let bit = 30; bit >= 0 && m; bit--) if ((m >> bit) & 1 && P[bit] !== undefined) m ^= P[bit];
    return m;
  };
  return {
    piv: P,
    fixed: (m) => reduce(m) === 0,
    add: (m) => { const r = reduce(m); if (!r) return false; P[31 - Math.clz32(r)] = r; return true; },
  };
}

export function bitsOf(stacks) {
  const colors = [];
  stacks.flat().forEach((c) => (Array.isArray(c) ? c : [c]).forEach((x) => { if (!colors.includes(x)) colors.push(x); }));
  const index = Object.fromEntries(colors.map((c, i) => [c, i]));
  const maskOf = (c) => (Array.isArray(c) ? c : [c]).reduce((m, x) => m ^ (1 << index[x]), 0);
  const all = makeBasis();
  stacks.flat().forEach((c) => all.add(maskOf(c)));
  return { colors, index, maskOf, need: Object.keys(all.piv).length };
}

// rule: "ar" (next whole stack), "masked" (next `per` whole stacks in a seeded random order),
// "cont" (one box in every stack not fully written). rounds: peeling rounds per pass.
export function simulate(stacks, rule, per, seed = 5, { rounds = Infinity, sc = true } = {}) {
  const r = rng(seed);
  const { colors, maskOf, need } = bitsOf(stacks);
  const ids = [];
  stacks.forEach((s, si) => s.forEach((c, bi) => ids.push({ si, bi, c, key: `${si}-${bi}`, mask: maskOf(c) })));
  const order = shuffle(stacks.map((_, i) => i), r);
  const written = new Set(), again = new Set();
  const basis = makeBasis();
  let K = 0, paid = 0, shannon = 0, W = new Set();
  const frames = [];
  const snap = (pick) => frames.push({ written: new Set(written), again: new Set(again), K, W: new Set(W), piv: { ...basis.piv }, pick, paid, shannon });
  snap([]);
  for (let t = 1; t < 400 && written.size < ids.length; t++) {
    // 1. The model's pass: peeling rounds over the written boxes.
    let k = sc ? K : 0;
    const obs = ids.filter((b) => written.has(b.key)).map((b) => b.mask);
    for (let i = 0; i < rounds; i++) {
      let nk = k;
      for (const m of obs) {
        const left = m & ~k;
        if (left && (left & (left - 1)) === 0) nk |= left; // exactly one bit left: it is fixed
      }
      if (nk === k) break;
      k = nk;
    }
    K = k;
    W = new Set(ids.filter((b) => !written.has(b.key) && (b.mask & ~K) === 0).map((b) => b.key));
    // 2. The sampler.
    const pending = (si) => ids.some((b) => b.si === si && !written.has(b.key));
    let which, pick;
    if (rule === "ar") which = [stacks.findIndex((_, si) => pending(si))];
    else if (rule === "masked") which = order.filter(pending).slice(0, per);
    else which = stacks.map((_, si) => si).filter(pending);
    if (rule === "cont") pick = which.map((si) => shuffle(ids.filter((b) => b.si === si && !written.has(b.key)), r)[0]);
    else pick = ids.filter((b) => which.includes(b.si) && !written.has(b.key));
    for (const b of pick) {
      written.add(b.key);
      const s = basis.add(b.mask) ? 1 : 0;
      const m = W.has(b.key) ? 0 : 1;
      shannon += s; paid += m;
      if (m > s) again.add(b.key);
    }
    snap(which);
  }
  const last = frames.length - 1;
  const byKey = Object.fromEntries(ids.map((b) => [b.key, b]));
  const F = (k) => frames[Math.min(k, last)];
  const known = (f, m) => (m & ~f.K) === 0;
  // Colors of a blend that the state has not fixed yet (the rest have been removed).
  const left = (f, b) => {
    if (!Array.isArray(b.c)) return b.c;
    const fb = makeBasis(f.piv);
    const rest = b.c.filter((x) => !fb.fixed(maskOf(x)));
    return rest.length === 1 ? rest[0] : rest.length ? rest : b.c;
  };
  // The model's view after step k: gray if written or worked out, striped if the state fixes
  // it but the model has not worked it out, solid if nothing fixes it yet.
  const view = (k) => (si, bi) => {
    const f = F(k), b = byKey[`${si}-${bi}`];
    if (f.written.has(b.key)) return { st: "k", twice: f.again.has(b.key) };
    if (known(f, b.mask)) return { st: "k" };
    if (makeBasis(f.piv).fixed(b.mask)) return { st: "d", col: left(f, b) };
    return { st: "u", col: left(f, b) };
  };
  const state = (k) => (si, bi) => {
    const f = F(k), key = `${si}-${bi}`;
    return f.written.has(key) ? { st: "k", twice: f.again.has(key) } : { st: "e" };
  };
  return {
    steps: last, last, need, colors, view, state,
    paid: (k) => F(k).paid,
    shannon: (k) => F(k).shannon,
    twice: (k) => F(k).again.size,
    picks: (k) => F(k).pick,
    total: frames[last].paid,
    // Boxes the model has worked out that are not in the state yet.
    ahead: (k) => { const f = F(k); return ids.filter((b) => !f.written.has(b.key) && known(f, b.mask)).length; },
    // What an observer running `R` peeling rounds from scratch can work out from the state after step k.
    observe: (k, R) => {
      const f = F(k);
      const obs = ids.filter((b) => f.written.has(b.key)).map((b) => b.mask);
      let kk = 0;
      for (let i = 0; i < R; i++) {
        let nk = kk;
        for (const m of obs) { const l = m & ~kk; if (l && (l & (l - 1)) === 0) nk |= l; }
        if (nk === kk) break;
        kk = nk;
      }
      const fb = makeBasis(f.piv);
      const status = (b) => (f.written.has(b.key) ? "w" : (b.mask & ~kk) === 0 ? "k" : fb.fixed(b.mask) ? "d" : "u");
      const view = (si, bi) => {
        const b = byKey[`${si}-${bi}`], st = status(b);
        if (st === "w" || st === "k") return { st: "k" };
        return { st, col: left(f, b) };
      };
      const counts = { written: 0, known: 0, hidden: 0, undecided: 0 };
      ids.forEach((b) => { const st = status(b); counts[st === "w" ? "written" : st === "k" ? "known" : st === "d" ? "hidden" : "undecided"] += 1; });
      return { view, counts };
    },
    // Boxes the state fixes but the model has not worked out (striped, not yet written).
    hidden: (k) => { const f = F(k); const fb = makeBasis(f.piv); return ids.filter((b) => !f.written.has(b.key) && !known(f, b.mask) && fb.fixed(b.mask)).length; },
  };
}
