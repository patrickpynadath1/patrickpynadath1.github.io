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
    // Shows a comment box under the post (GitHub sign-in, stored as issues on the site repo).
    comments: z.boolean().optional(),
  }),
});

export const collections = { blog };
