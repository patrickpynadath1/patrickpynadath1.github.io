# Bun + Astro Migration Strategy

Plan to migrate the existing static site to Bun + Astro while keeping the visual design identical, adding a structured blog, and leaving room for future growth.

## Goals
- Preserve current layout, styling, and assets (Bulma, FontAwesome, existing custom CSS, images, cv.pdf).
- Use Bun for tooling (`bun install`, `bun dev`, `bun run build`) with Astro as the framework.
- Introduce a blog powered by Astro content collections with consistent metadata and layouts.
- Maintain simple authoring (new post = new Markdown file) and modular components for reuse.

## Bootstrap with Bun + Astro
1) Prereqs: Bun ≥1.1 installed.  
2) Initialize: `bun create astro@latest . --template minimal` (or `--template basics` if preferring starter styles).  
3) Install deps: `bun install`.  
4) Scripts (package.json): `"dev": "astro dev", "build": "astro build", "preview": "astro preview", "check": "astro check"`.  
5) Run locally: `bun dev` and `bun run check` before `bun run build`.  
6) Configure `astro.config.mjs` with `site` URL and ensure `public/` is used for static assets.

## Target Project Structure
```
/
├─ public/                # Direct copies of current static assets
│  ├─ cv.pdf
│  ├─ images/…
│  ├─ css/…               # Existing Bulma + custom CSS (or move into src/styles)
│  └─ js/…                # Existing Bulma JS + custom JS if still needed
├─ src/
│  ├─ pages/
│  │  ├─ index.astro      # Current landing page recreated in Astro
│  │  └─ blog/
│  │     ├─ index.astro   # Blog listing
│  │     └─ [slug].astro  # Individual blog posts from content collection
│  ├─ layouts/
│  │  ├─ BaseLayout.astro # Shared head/meta/fonts/scripts; wraps all pages
│  │  └─ BlogLayout.astro # Post layout (title/date/tags/hero/TOC optional)
│  ├─ components/
│  │  ├─ NavBar.astro
│  │  ├─ Hero.astro
│  │  ├─ SectionBlock.astro
│  │  ├─ PostCard.astro
│  │  └─ TagPill.astro
│  ├─ content/
│  │  └─ posts/           # Markdown/MDX posts
│  ├─ content/config.ts   # Astro content collection schema
│  └─ styles/
│     ├─ tokens.css       # Design tokens / CSS variables for easy theming
│     └─ global.css       # Imports Bulma + custom overrides (from current index.css)
├─ astro.config.mjs
├─ tsconfig.json          # From Astro starter (type safety)
├─ package.json / bun.lockb
└─ README.md              # Usage docs (can expand with deploy steps)
```

## Migration Steps (Preserve Current UI)
1) Copy `static/**` into `public/` unchanged; keep image paths stable. Map `cv.pdf` to `/cv.pdf`.  
2) Move `static/css/index.css` and other overrides into `src/styles/global.css`; import Bulma + FontAwesome either from CDN (as today) or from `public/css`.  
3) Create `src/layouts/BaseLayout.astro` to include `<head>` meta, fonts, favicon, global styles, and scripts (Bulma carousel/slider).  
4) Rebuild `index.html` as `src/pages/index.astro`, splitting repeated sections into components (Hero, About, Sections, Publications) while reusing the same markup/CSS to keep visuals identical.  
5) If carousels/sliders are still required, hydrate only the necessary components with Astro islands (e.g., `<Slider client:load>`), otherwise keep them static.  
6) Keep routing parity: `/` -> `index.astro`; add redirects if prior paths change (e.g., `/static/...` now under `/`).  
7) Update `public/robots.txt`/`sitemap.xml` later if needed; not required for initial migration.

## Blog Infrastructure
- Content collection schema (`src/content/config.ts`):
  ```ts
  import { defineCollection, z } from 'astro:content';

  const posts = defineCollection({
    type: 'content',
    schema: z.object({
      title: z.string(),
      description: z.string(),
      publishDate: z.coerce.date(),
      tags: z.array(z.string()).default([]),
      heroImage: z.string().optional(),
      draft: z.boolean().default(false)
    })
  });

  export const collections = { posts };
  ```
- Post template: `src/pages/blog/[slug].astro` uses `getCollection('posts')`, renders via `BlogLayout`, shows metadata (title/date/tags/description/hero image) and Markdown content.  
- Blog index: `src/pages/blog/index.astro` lists posts sorted by `publishDate` descending using a `PostCard` component with title, description, date, and tags.  
- Adding a post: create `src/content/posts/my-post.md` with frontmatter:
  ```md
  ---
  title: "Post title"
  description: "Short summary"
  publishDate: 2025-02-08
  tags: ["astro", "research"]
  heroImage: "/images/hero.png"
  draft: false
  ---
  Markdown content here…
  ```
- Optional future additions: tags page (`/blog/tags/[tag]`), RSS feed via `@astrojs/rss`, MDX support if needed.

## Extensibility & Styling
- Keep components small and reusable; colocate per-feature styles next to components when helpful.  
- Centralize tokens in `styles/tokens.css` (colors, spacing, fonts) to tweak the look without touching every component.  
- Prefer global Bulma utilities for layout; keep custom gradients and sections from the current CSS in `global.css`.  
- Store shared data (nav links, social links) in a small config file to avoid duplication.

## Testing & Validation
- Automated: `bun run check` (Astro type/markdown checks) and `bun run build`.  
- Visual parity: compare the new `/` against the current `index.html` in desktop/mobile viewports; ensure gradients, sections, and carousels match.  
- Links/navigation: verify all anchors, CV download, and blog routes (`/blog`, `/blog/[slug]`) work.  
- Responsive: test key breakpoints (mobile ≤768px, tablet, desktop) for layout regressions.  
- Accessibility: quick pass for alt text on images and semantic headings when porting components.
