import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// One content collection: posts. Add a Markdown file to src/content/posts/
// and it appears on the home page. No code changes.
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
  }),
});

export const collections = { posts };
