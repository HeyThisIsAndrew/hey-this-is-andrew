import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';

// One content collection: posts, in src/data/posts.json. Add one in the
// local CMS (`pnpm dev`, then /local-cms) and it appears on the home page.
// The schema checks every entry at build.
const posts = defineCollection({
  loader: file('src/data/posts.json'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    body: z.string().optional(),
  }),
});

export const collections = { posts };
