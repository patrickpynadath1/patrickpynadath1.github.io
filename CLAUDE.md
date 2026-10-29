# Site notes for Claude

Patrick's personal site: Astro + MDX, deployed to GitHub Pages from `main`
(`.github/workflows/astro-deploy.yml`, built with bun). Blog posts live in `src/content/blog/`
and render through `src/layouts/BlogLayout.astro` and `src/styles/post.css`.

## How to talk to me

- Plain words, short sentences, sixth-grade reading level.
- Lead with the answer in one or two lines, then bullets, one idea each.
- No em dashes. No preamble, and no running commentary on your process.
- If you need a decision from me: one question at a time, options as bullets, say which one you recommend and why in one line.

## Never commit

- `static/images/Revolution Labs PoC 2: B300 cluster on SkyPilot.pdf`

## Design map figure (the draft post)

An interactive figure of every design choice in a diffusion language model, built on the
`candi` codebase. It has two linked parts:

- **Part 1, "How the parts fit together":** a clickable SVG map of the pipeline. Tokens → representation → corruption + schedule → network (attention, time input, self-cond, LM head) → output → loss / sampler, plus a "sequence modifiers" band.
- **Part 2, "Follow five tokens through every part":** a layer-by-layer walkthrough. Each layer has option buttons, a picture, a caption and a "See it in the code" popup.

A toggle at the top switches between "Explore parts" and "Paper recipes". The recipes are presets
taken from candi's experiment configs, grouped into families.

### Files

- `src/standalone/component-figures.html` is the **source of truth**. It is one self-contained page: styles, markup and scripts. Edit this file.
- `public/figures/design-map/index.html` is **generated**. Never edit it by hand. Rebuild it with:
  `python3 scripts/component-figures/build_embed.py src/standalone/component-figures.html public/figures/design-map/index.html`
  The embed version drops the page header, follows the post's theme, sizes its iframe to fit, and places popups where the reader is looking.
- `src/content/blog/untitled-draft.mdx` is the draft post (`draft: true`: off the blog list, but live at `/blog/untitled-draft/`). It embeds the figure as an iframe pointing at `/figures/design-map/`, inside `<div className="fig-bleed">`.
- `src/styles/post.css`: `.post-grid:has(.fig-bleed)` widens the reading column to the figure's width on screens wider than 1300px.
- Code popup snippets come from candi at a pinned commit:
  1. `python3 scripts/component-figures/code_refs.py /Users/patrickpynadath/candi > code_refs.json`
  2. `python3 scripts/component-figures/inject_refs.py src/standalone/component-figures.html` (reads `code_refs.json` from the current folder; delete it afterwards).

  The `SPEC` dict in `code_refs.py` maps each option key (for example `samp:eb`, `loss:elbo@gaussian`, `block:mix`) to its config file, Hydra override and core symbols. `RECIPE_IDS` lists the experiment files shown in recipe mode.
- `src/standalone/component-diagram.html` and `src/standalone/component-pipeline.html` are old standalone versions. Leave them alone.

### Inside component-figures.html

Three main scripts, in this order:

1. **Map (part 1).** `C` (components and options), `N` (box positions on a 1200-wide viewBox), `g()` (small glyph per box), `drawMap()`.
   - It never owns state. It listens for the `pipestate` event and maps part 2's state onto the map through `FROM`.
   - `NAME` / `TAG` override a box's label (the ELBO form, a recipe's schedule name, the block mode).
   - `VARY` marks boxes that differ across a recipe family. `BLOCKV` is the block mode.
   - Clicking a box fires `mapselect`.
2. **Detail (part 2).**
   - The option tables `REP`, `CORR`, `COMBINE`, `SCHED`, `ATTN`, `TCOND`, `SELF`, `PARAM`, `LOSS`, `SAMP`, `BLOCK`, `VARLEN`, each with `ok()` rules for what fits together.
   - The state `S`.
   - Recipe data: `RECIPES` (ids match candi `configs/experiment/*.yaml`), `FAMILIES`, `FIGS` (recipe-specific pictures).
   - `LAYERS`, the `draw*()` functions per layer, `render()` → `emitState()`.
   - All captions live in the hidden `#figure-text` block (`<p data-key>`), read through `T(key)`. Edit wording there.
   - The code popup code sits at the end of this script and reads the JSON in `#code-refs`.
3. **Bridge.** Part 2 shows only the layer picked on the map. "Show all parts" expands everything, in both modes.

### Rules

- **Show what candi's configs do, not what the papers say.** When the two differ, show the config and say so in the recipe text (`recipe.<id>` in `#figure-text`). Check `configs/experiment/*.yaml` in `/Users/patrickpynadath/candi` (branch `candiv2.1`) before you add or change a recipe.
- **Theme:** colors only through the CSS variables on `:root`. Dark is the default; light comes from `data-theme="light"`.
  - Use `--bg`, `--fg`, `--muted`, `--faint`, `--border`, `--surface`, `--surface-2`, `--accent`, `--accent-2`, `--teal`, `--rose`.
  - Never hard-code a color. Both themes must look right.
- **Fonts:** Georgia for display text, Helvetica for body text.
- **Map labels** must fit their boxes (`drawMap` shrinks the text, then trims it).
- **No sideways scroll** at phone width (390px), except the map, which scrolls inside its own frame.
- **Block diffusion mask** stays in the BD3-LM layout: the noisy copy first, then the clean copy.
  - Noisy → noisy: block diagonal (`--accent-2`).
  - Noisy → clean: earlier blocks only, offset block causal (`--teal`).
  - Clean → clean: block causal or token causal, depending on the option (`--accent`).
  - Clean → noisy: never.

### After every change

1. Rebuild the embed (command above). Refresh code snippets only if candi changed.
2. Run `npm run build` (CI uses bun; both work).
3. Check it in a browser with Playwright: serve `dist/` and open `/blog/untitled-draft/`.
   - Take screenshots at 1440, 1280, 1024 and 390 wide, in light and dark.
   - Click through the map, the recipe families and a code popup.
   - Check for console errors and for sideways scroll on the page.
4. Commit with a clear message, then `git push` to `main`.
