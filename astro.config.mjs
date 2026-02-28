// @ts-check
import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import react from '@astrojs/react';
import rehypeCitation from 'rehype-citation';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';

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
            bibliography: './src/content/blog/dlm_bibliography.bib',
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
  vite: {
    server: {
      watch: {
        include: ['src/**/*.bib']
      }
    }
  },
});
