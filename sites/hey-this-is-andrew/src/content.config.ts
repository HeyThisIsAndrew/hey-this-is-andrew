import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';
import { file } from 'astro/loaders';

// Astro 7 content layer. Each collection is a JSON file in src/data (an
// array of entries, each with an `id`), edited by hand or in the local CMS
// (`pnpm dev`, then /local-cms; fields in local-cms.config.mjs). The schemas
// still validate every entry at build, so a bad edit fails the build, not
// the page. They were Markdown files until 2026-10-04; same ids, same data.

// Projects: recent video work plus the process behind each one.
const projects = defineCollection({
  loader: file('src/data/projects.json'),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string(),
    role: z.string().optional(),
    brand: z.enum(['htia', 'be', 'ccc']).default('htia'),
    tools: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    /** An image field (a path under src/assets, or a Sanity asset id). */
    image: z.string().optional(),
    link: z.string().optional(),
    /** The write-up (Markdown): Process, What I learned. */
    body: z.string().optional(),
  }),
});

const statusEnum = z.enum(['done', 'in-progress', 'queued', 'next']);

// Goals: milestone groups rendered as the transparent progress checklist.
const goals = defineCollection({
  loader: file('src/data/goals.json'),
  schema: z.object({
    title: z.string(),
    /** Display order: lower first. The Big Goals lead. */
    order: z.number().default(99),
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
  loader: file('src/data/gear.json'),
  schema: z.object({
    category: z.string(),
    order: z.number().default(0),
    kicker: z.string().optional(),
    subtitle: z.string().optional(),
    /** The section's Amazon collection page (the header's list link). */
    collectionUrl: z.string().url().optional(),
    collectionLabel: z.string().optional(),
    items: z.array(
      z.object({
        name: z.string(),
        /** Short label for spines and thumbnails; defaults to `name`. */
        shortName: z.string().optional(),
        spec: z.string(),
        brand: z.string().optional(),
        tag: z.string().optional(),
        /** A file in public/gear/. Missing or absent: a typographic card. */
        image: z.string().optional(),
        /**
         * Where to buy it, primary first. Add a store by adding a row; the
         * picker appears by itself once there are two. An item with NO
         * stores is owned but not shown (hidden until it is linked).
         */
        stores: z
          .array(
            z.object({
              store: z.string(),
              url: z.string().url(),
              /** A non-Amazon affiliate program (disclosed on the page). */
              affiliate: z.boolean().optional(),
            })
          )
          .default([]),
        /**
         * A catalog pick rather than part of the owned kit: the card, its
         * thumbnail and its grid card carry a "Recommended" badge.
         */
        recommended: z.boolean().optional(),
        /** Andrew's own video of the item, linked beside the store CTA. */
        video: z.object({ label: z.string(), url: z.string().url() }).optional(),
      })
    ),
  }),
});

export const collections = { projects, goals, gear };
