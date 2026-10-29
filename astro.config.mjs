// @ts-check
import { existsSync, readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import rehypeCitation from 'rehype-citation';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

// src/content/bibliography.bib is auto-exported from Zotero (Better BibTeX, "Keep updated", collection "Blog").
// It is only used once it has entries: the citation parser rejects an empty file.
// rehype-citation rewrites the list it is given in place, so hand it a fresh one on every read.
const ZOTERO_BIB = './src/content/bibliography.bib';
function bibliographies() {
  const files = ['./src/content/blog/dlm_bibliography.bib'];
  if (existsSync(ZOTERO_BIB) && /@\w+\s*\{/.test(readFileSync(ZOTERO_BIB, 'utf8'))) files.push(ZOTERO_BIB);
  return files;
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    mdx({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeKatex,
        [
          rehypeCitation,
          {
            get bibliography() { return bibliographies(); },
            linkCitations: true,
            csl: 'https://raw.githubusercontent.com/citation-style-language/styles/master/ieee.csl',
            lang: 'en-US',
            suppressBibliography: false,
          },
        ],
      ],
    }),
    react(),
  ],
  site: 'https://patrickpynadath1.github.io',
});
