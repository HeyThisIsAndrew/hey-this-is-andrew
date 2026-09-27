import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Astro 7 content layer: each collection gets a loader pointing at its
// markdown directory. Schemas stay the same; only the wiring changed.

// Projects: recent video work plus the process behind each one.
const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    role: z.string().optional(),
    brand: z.enum(['htia', 'be', 'ccc']).default('htia'),
    tools: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    image: z.string().optional(),
    link: z.string().url().optional(),
  }),
});

const statusEnum = z.enum(['done', 'in-progress', 'next']);

// Goals: milestone groups rendered as the transparent progress checklist.
const goals = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/goals' }),
  schema: z.object({
    title: z.string(),
    items: z.array(
      z.object({
        label: z.string(),
        status: statusEnum,
        note: z.string().optional(),
      })
    ),
  }),
});

// Gear: equipment inventory, grouped by category.
const gear = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/gear' }),
  schema: z.object({
    category: z.string(),
    order: z.number().default(0),
    brand: z.string().optional(),
    subtitle: z.string().optional(),
    items: z.array(
      z.object({
        name: z.string(),
        spec: z.string(),
        brand: z.string().optional(),
        affiliateUrl: z.string().optional(),
        tag: z.string().optional(),
      })
    ),
  }),
});

export const collections = { projects, goals, gear };
