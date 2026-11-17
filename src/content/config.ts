import { defineCollection, z } from 'astro:content';

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    pubDate: z.coerce.date(),
    author: z.string(),
    tags: z.array(z.string()).optional(),
    heroImage: z.string().optional(),
    draft: z.boolean().optional(),
    wip: z.boolean().optional(),
    // Local-only posts exist on the dev server and are never built for the live site.
    local: z.boolean().optional(),
    // Lets readers highlight text in the post and comment on it (Hypothesis).
    comments: z.boolean().optional(),
    // Adds a toggle that swaps the prose for the bullet summaries in <div className="spark"> blocks.
    sparknotes: z.boolean().optional(),
  }),
});

export const collections = { blog };
