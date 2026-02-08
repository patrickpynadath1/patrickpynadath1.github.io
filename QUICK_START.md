# Migration Implementation Quick Start Guide

This guide provides step-by-step commands and actions to implement the migration from static HTML to Bun + Astro.

## Prerequisites

- Bun installed (https://bun.sh)
- Git installed
- Text editor (VS Code recommended)
- Basic understanding of HTML, CSS, and JavaScript

## Quick Start Commands

### 1. Initialize Astro Project

```bash
# Initialize Astro with Bun in the current directory
bunx create-astro@latest . --template minimal --install --git --typescript strict

# Or if starting fresh in a new directory:
# mkdir new-site && cd new-site
# bunx create-astro@latest . --template minimal --install --git --typescript strict
```

### 2. Install Dependencies (if any additional needed)

```bash
bun add astro
bun add -d @astrojs/check typescript
```

### 3. Create Folder Structure

```bash
# Create component folders
mkdir -p src/components/base
mkdir -p src/components/sections
mkdir -p src/components/projects
mkdir -p src/components/blog

# Create layout folders
mkdir -p src/layouts

# Create page folders
mkdir -p src/pages/blog

# Create content folders
mkdir -p src/content/blog

# Create style folders
mkdir -p src/styles/components
mkdir -p src/styles/blog

# Create scripts folder
mkdir -p src/scripts

# Create public folders (if not exist)
mkdir -p public/images
mkdir -p public/css
mkdir -p public/js
```

### 4. Copy Existing Assets

```bash
# Copy images
cp -r static/images/* public/images/

# Copy CSS
cp static/css/bulma.min.css public/css/
cp static/css/bulma-carousel.min.css public/css/
cp static/css/bulma-slider.min.css public/css/
cp static/css/fontawesome.all.min.css public/css/

# Copy JavaScript
cp static/js/bulma-carousel.min.js public/js/
cp static/js/bulma-slider.min.js public/js/
cp static/js/fontawesome.all.min.js public/js/

# Copy PDF
cp cv.pdf public/
```

### 5. Configure Astro

Create or update `astro.config.mjs`:

```javascript
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://patrickpynadath1.github.io',
  output: 'static',
  build: {
    format: 'file',
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});
```

### 6. Set Up Content Collections

Create `src/content/config.ts`:

```typescript
import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()),
    draft: z.boolean().optional().default(false),
    author: z.string().default('Patrick Pynadath'),
    image: z.string().optional(),
  }),
});

export const collections = {
  blog,
};
```

### 7. Test Development Server

```bash
bun run dev
# Open http://localhost:4321
```

### 8. Test Build

```bash
bun run build
bun run preview
```

## Implementation Order

Follow this order to implement the migration systematically:

### Week 1: Foundation (Phases 1-3)

**Day 1: Project Setup**
- [ ] Initialize Astro with Bun
- [ ] Create folder structure
- [ ] Copy assets
- [ ] Configure Astro
- [ ] Test dev server runs

**Day 2-3: Style Extraction**
- [ ] Create `src/styles/design-tokens.css`
- [ ] Create `src/styles/global.css`
- [ ] Extract TL;DR section styles → `src/styles/components/tldr-section.css`
- [ ] Extract profile styles → `src/styles/components/profile.css`
- [ ] Extract cat styles → `src/styles/components/cats.css`
- [ ] Extract project styles → `src/styles/components/projects.css`
- [ ] Extract badge styles → `src/styles/components/badges.css`
- [ ] Extract expandable styles → `src/styles/components/expandable.css`

**Day 4-5: Base Components & Layouts**
- [ ] Create `src/layouts/BaseLayout.astro`
- [ ] Create `src/components/base/Header.astro`
- [ ] Create `src/components/base/Footer.astro`
- [ ] Test these components render

**Day 6-7: Section Components**
- [ ] Create `src/components/sections/TLDRSection.astro`
- [ ] Create `src/components/sections/ProfileSection.astro`
- [ ] Create `src/components/sections/AboutSection.astro`
- [ ] Create `src/components/sections/CatsSection.astro`
- [ ] Create `src/components/sections/EducationSection.astro`
- [ ] Create `src/components/sections/ContactSection.astro`
- [ ] Test each component individually

### Week 2: Main Site (Phases 4-6)

**Day 8-9: Project Components**
- [ ] Create `src/components/projects/ProjectBadge.astro`
- [ ] Create `src/components/projects/ProjectCatDecor.astro`
- [ ] Create `src/components/projects/ProjectCard.astro`
- [ ] Test project card with different color themes

**Day 10: Page Assembly**
- [ ] Create `src/pages/index.astro`
- [ ] Import and arrange all section components
- [ ] Add all 4 research projects
- [ ] Test expandable functionality
- [ ] Implement JavaScript for interactions

**Day 11: Visual Verification**
- [ ] Compare side-by-side with original
- [ ] Fix any visual discrepancies
- [ ] Test responsive behavior (mobile, tablet, desktop)
- [ ] Test all links and badges

**Day 12: Asset Verification**
- [ ] Verify all images load
- [ ] Verify favicon shows
- [ ] Verify PDF downloads
- [ ] Verify external links work

### Week 3: Blog & Testing (Phases 5, 7-9)

**Day 13-14: Blog Infrastructure**
- [ ] Create content collection config (done in setup)
- [ ] Create `src/layouts/BlogPostLayout.astro`
- [ ] Create `src/components/blog/BlogPostCard.astro`
- [ ] Create `src/components/blog/BlogPostHeader.astro`
- [ ] Create `src/pages/blog/index.astro`
- [ ] Create `src/pages/blog/[slug].astro`
- [ ] Create blog styles in `src/styles/blog/`

**Day 15: Sample Blog Posts**
- [ ] Create 2-3 sample blog posts in `src/content/blog/`
- [ ] Test blog listing page
- [ ] Test individual blog post pages
- [ ] Test navigation between blog and home

**Day 16: Navigation & Routing**
- [ ] Add blog link to main page
- [ ] Add "Back to Home" from blog
- [ ] Test all routes work
- [ ] Create 404 page (optional)

**Day 17-18: Comprehensive Testing**
- [ ] Visual testing (all sections, colors, spacing)
- [ ] Responsive testing (mobile, tablet, desktop, wide)
- [ ] Functional testing (expandables, badges, links)
- [ ] Blog testing (listing, posts, navigation)
- [ ] Browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Build testing (no errors, preview works)

### Week 4: Documentation & Launch (Phase 10)

**Day 19-20: Documentation**
- [ ] Create comprehensive README.md
- [ ] Document how to add blog posts
- [ ] Document how to add research projects
- [ ] Document design tokens and styling approach
- [ ] Create CONTRIBUTING.md (optional)

**Day 21: Final Review**
- [ ] Review all documentation
- [ ] Final visual comparison
- [ ] Final testing pass
- [ ] Performance check (Lighthouse)

## Key Files to Create

### Critical Path Files (Must Create First)

1. `src/layouts/BaseLayout.astro` - Base HTML structure
2. `src/styles/design-tokens.css` - CSS variables
3. `src/styles/global.css` - Global styles and Bulma imports
4. `src/pages/index.astro` - Main page

### Component Files (Create in Order)

Base:
- `src/components/base/Header.astro`
- `src/components/base/Footer.astro`

Sections:
- `src/components/sections/TLDRSection.astro`
- `src/components/sections/ProfileSection.astro`
- `src/components/sections/AboutSection.astro`
- `src/components/sections/CatsSection.astro`
- `src/components/sections/EducationSection.astro`
- `src/components/sections/ContactSection.astro`

Projects:
- `src/components/projects/ProjectBadge.astro`
- `src/components/projects/ProjectCatDecor.astro`
- `src/components/projects/ProjectCard.astro`

Blog:
- `src/layouts/BlogPostLayout.astro`
- `src/components/blog/BlogPostCard.astro`
- `src/components/blog/BlogPostHeader.astro`
- `src/pages/blog/index.astro`
- `src/pages/blog/[slug].astro`

## Testing Checklist

### Visual Testing
```bash
# Run dev server
bun run dev

# Open in browser: http://localhost:4321

# Check:
# - Colors match original
# - Fonts render correctly
# - Images display properly
# - Spacing is correct
# - Hover effects work
# - Animations smooth
```

### Responsive Testing
```bash
# Test in browser DevTools at breakpoints:
# - 375px (mobile)
# - 768px (tablet)
# - 1024px (desktop)
# - 1440px (wide desktop)

# Check:
# - Layout adapts correctly
# - Images scale properly
# - Text remains readable
# - No horizontal scroll
# - Touch targets adequate on mobile
```

### Build Testing
```bash
# Build the site
bun run build

# Preview the build
bun run preview

# Check:
# - No build errors
# - Preview looks identical to dev
# - All routes work
# - Assets load correctly
```

### Performance Testing
```bash
# Use Chrome DevTools Lighthouse
# Run audit on both pages:
# - Homepage
# - Sample blog post

# Target scores:
# - Performance: > 90
# - Accessibility: > 95
# - Best Practices: > 90
# - SEO: > 90
```

## Common Issues & Solutions

### Issue: Styles not applying

**Solution**: Check CSS import order in BaseLayout.astro:
```astro
<!-- Import in this order: -->
<link rel="stylesheet" href="/css/bulma.min.css">
<link rel="stylesheet" href="/css/bulma-carousel.min.css">
<link rel="stylesheet" href="/css/bulma-slider.min.css">
<link rel="stylesheet" href="/css/fontawesome.all.min.css">
<link rel="stylesheet" href={Astro.resolve('../styles/design-tokens.css')}>
<link rel="stylesheet" href={Astro.resolve('../styles/global.css')}>
```

### Issue: Images not loading

**Solution**: Use correct path from public folder:
```astro
<!-- Correct -->
<img src="/images/pic.jpg" alt="Profile">

<!-- Wrong -->
<img src="../public/images/pic.jpg" alt="Profile">
```

### Issue: Expandable sections not working

**Solution**: Make sure script is included and runs after DOM loads:
```astro
<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Your expandable section code here
  });
</script>
```

### Issue: Content collection not found

**Solution**: Make sure config.ts is created and blog folder exists:
```bash
# Check these exist:
ls src/content/config.ts
ls -la src/content/blog/
```

### Issue: Build fails with type errors

**Solution**: Run type check to see specific errors:
```bash
bun run astro check
```

## Deployment

### For GitHub Pages

1. Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build site
        run: bun run build

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

2. Enable GitHub Pages in repository settings:
   - Go to Settings > Pages
   - Source: GitHub Actions

3. Push to main branch to trigger deployment

## Next Steps After Migration

Once the core migration is complete, consider these enhancements:

1. **SEO Improvements**:
   - Add sitemap.xml (Astro generates automatically)
   - Add robots.txt
   - Improve meta descriptions
   - Add Open Graph tags

2. **Blog Enhancements**:
   - RSS feed
   - Tag filtering
   - Search functionality
   - Related posts

3. **Performance Optimizations**:
   - Use Astro Image component for optimized images
   - Add lazy loading
   - Inline critical CSS

4. **Analytics**:
   - Add privacy-friendly analytics (Plausible, Fathom, etc.)

5. **Additional Features**:
   - Dark mode toggle
   - Comment system
   - Newsletter signup

## Resources

- [Astro Documentation](https://docs.astro.build)
- [Bun Documentation](https://bun.sh/docs)
- [Bulma Documentation](https://bulma.io/documentation/)
- [Content Collections Guide](https://docs.astro.build/en/guides/content-collections/)
- [Astro Deployment Guide](https://docs.astro.build/en/guides/deploy/)

## Getting Help

If you encounter issues during migration:

1. Check this guide's "Common Issues & Solutions"
2. Review the MIGRATION_PLAN.md for detailed phase information
3. Check the FOLDER_STRUCTURE.md for organization details
4. Search [Astro Discord](https://astro.build/chat)
5. Check [GitHub Issues](https://github.com/withastro/astro/issues)

---

**Remember**: The goal is to preserve all existing visual design and functionality while adding blog infrastructure and improving maintainability. When in doubt, refer to the original HTML file for the exact implementation.
