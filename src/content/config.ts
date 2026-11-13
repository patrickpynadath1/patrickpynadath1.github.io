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
    // Lets readers highlight text in the post and comment on it (Hypothesis).
    comments: z.boolean().optional(),
  }),
});

export const collections = { blog };
