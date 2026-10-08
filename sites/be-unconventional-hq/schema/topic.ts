import { defineType, defineField } from 'sanity';

/**
 * Topic — a site category node in the Taxonomy-as-Code system (epic #34).
 *
 * The four Tier-1 categories (Film / TV / Gaming / Events) plus the special
 * Uncategorized fallback are seeded by scripts/sync-youtube.mjs with
 * deterministic ids (`topic-film`, …, `topic-uncategorized`), so the sync can
 * reference them without lookups. Editors own everything AFTER creation —
 * especially `youtubeSyncKeywords`, the dictionary that maps raw YouTube tags
 * onto this topic.
 *
 * Matching is case- and punctuation-insensitive ("San Diego Comic-Con" ≡
 * "san diego comic con"), and only EXACT dictionary hits count — the rest of a
 * video's SEO tag soup is ignored by design.
 */
export default defineType({
  name: 'topic',
  title: 'Topic',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: { source: 'title' },
      validation: (rule) => rule.required(),
      description: 'Stable id used by the site (film, tv, gaming, events, uncategorized).',
    }),
    defineField({
      name: 'isTier1Category',
      title: 'Tier-1 Site Category',
      type: 'boolean',
      initialValue: false,
      description:
        'The four top-level site categories. Every synced video must match at least one Tier-1 keyword or it is flagged for review.',
    }),
    defineField({
      name: 'youtubeSyncKeywords',
      title: 'YouTube Sync Keywords',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description:
        'YouTube tags that map a video to this topic (case/punctuation-insensitive, exact match after normalization). e.g. "film", "movies".',
    }),
    defineField({
      name: 'emptyStateMessage',
      title: 'Empty-State Message',
      type: 'text',
      rows: 4,
      description:
        'First-person message shown on the site when this category has no content yet (Mandate 4). Written once, reused everywhere.',
    }),
  ],
  preview: {
    select: { title: 'title', tier1: 'isTier1Category', slug: 'slug.current' },
    prepare({ title, tier1, slug }: any) {
      return {
        title: title || slug || 'Untitled topic',
        subtitle: tier1 ? 'Tier-1 category' : 'Topic',
      };
    },
  },
});
