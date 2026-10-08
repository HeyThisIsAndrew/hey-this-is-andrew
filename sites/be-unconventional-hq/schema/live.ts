import { defineType, defineField } from 'sanity';

/**
 * Video — a YouTube video ingested into Sanity by scripts/sync-youtube.mjs.
 *
 * THREE field classes (the pipeline contract, epic #34):
 *   • FACTUAL (YouTube fieldset) — synced from the YouTube Data API every run.
 *     readOnly in Studio; the sync writes via token regardless.
 *   • DERIVED (Taxonomy fieldset) — topics/hubs/requiresReview, computed from
 *     the video's YouTube tags against the Sanity keyword dictionary on EVERY
 *     run… unless `manualTaxonomyOverride` is on (the Sync Lock), in which
 *     case the sync leaves all taxonomy alone forever.
 *   • EDITORIAL — owned by humans. Seeded once on creation, never overwritten.
 *     contentStatus special case: a video that cleanly matches a Tier-1
 *     keyword auto-publishes; the sync may also promote needs-review →
 *     published later if better tags arrive and no human has intervened.
 *
 * See scripts/youtube-sync.md for the full pipeline contract.
 */
export default defineType({
  name: 'live',
  title: 'Live Stream',
  type: 'document',
  fieldsets: [
    { name: 'youtube', title: 'YouTube (synced — do not edit)', options: { collapsible: true } },
    {
      name: 'taxonomy',
      title: 'Taxonomy (derived from YouTube tags — locked by Manual Override)',
      options: { collapsible: true, collapsed: false },
    },
    { name: 'editorial', title: 'Editorial (curated by you)', options: { collapsible: true, collapsed: false } },
  ],
  orderings: [
    {
      title: 'Published Date, Newest First',
      name: 'publishedAtDesc',
      by: [{ field: 'publishedAt', direction: 'desc' }],
    },
    {
      title: 'Published Date, Oldest First',
      name: 'publishedAtAsc',
      by: [{ field: 'publishedAt', direction: 'asc' }],
    },
  ],
  fields: [
    // ── Synced from YouTube (overwritten every sync; read-only in Studio) ──
    defineField({
      name: 'youtubeId',
      title: 'YouTube Video ID',
      type: 'string',
      fieldset: 'youtube',
      readOnly: true,
      validation: (rule) => rule.required(),
    }),
    defineField({ name: 'title', title: 'Title', type: 'string', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'description', title: 'Description', type: 'text', rows: 4, fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'thumbnailUrl', title: 'Thumbnail URL', type: 'url', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'durationSeconds', title: 'Duration (seconds)', type: 'number', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'isShort', title: 'Is Short (Network Verified)', type: 'boolean', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'isLive', title: 'Is Live VOD', type: 'boolean', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'isEvent', title: 'Is Event Coverage', type: 'boolean', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'viewCount', title: 'View Count', type: 'number', fieldset: 'youtube', readOnly: true }),
    defineField({ name: 'publishedAt', title: 'Published At', type: 'datetime', fieldset: 'youtube', readOnly: true }),
    defineField({
      name: 'youtubeTags',
      title: 'YouTube Tags',
      type: 'array',
      of: [{ type: 'string' }],
      fieldset: 'youtube',
      readOnly: true,
      description: "YouTube's own tags — factual. Use the editorial fields below for site organization.",
    }),
    defineField({ name: 'platform', title: 'Platform', type: 'string', fieldset: 'youtube', readOnly: true, initialValue: 'youtube' }),
    defineField({ name: 'lastSyncedAt', title: 'Last Synced At', type: 'datetime', fieldset: 'youtube', readOnly: true }),

    // ── Editorial (never overwritten by the sync) ──
    defineField({
      name: 'contentStatus',
      title: 'Content Status',
      type: 'string',
      fieldset: 'editorial',
      options: {
        list: [
          { title: 'Needs Review', value: 'needs-review' },
          { title: 'Published', value: 'published' },
          { title: 'Archived', value: 'archived' },
        ],
        layout: 'radio',
      },
      initialValue: 'needs-review',
      description:
        'AUTO-PUBLISH: videos whose YouTube tags cleanly match a Tier-1 category are created as "Published"; unmatched ones land as "Needs Review". The sync may promote Needs Review → Published when tags are fixed, but never touches a status a human has changed (and never un-publishes or un-archives).',
    }),
    defineField({
      name: 'manualTypeOverride',
      title: 'Manual Type Override (Sync Bypass)',
      type: 'string',
      fieldset: 'editorial',
      options: {
        list: [
          { title: 'Standard Video', value: 'video' },
          { title: 'YouTube Short', value: 'short' },
          { title: 'Live Stream VOD', value: 'live' },
        ],
      },
      description: 'FORCE the document type. If you set this, the sync script will completely bypass the YouTube API HEAD check and instantly move this document to the selected schema type.'
    }),
    defineField({ name: 'featured', title: 'Featured', type: 'boolean', fieldset: 'editorial', initialValue: false }),
    defineField({
      name: 'franchises',
      title: 'Franchises',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      fieldset: 'editorial',
      description: 'e.g. DC, Marvel, Star Wars — powers "all DC coverage" style queries.',
    }),
    defineField({
      name: 'characters',
      title: 'Characters',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      fieldset: 'editorial',
      description: 'e.g. Superman, Deadpool.',
    }),
    defineField({
      name: 'topics',
      title: 'Topics',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'topic' }] }],
      fieldset: 'taxonomy',
      description:
        'DERIVED: recomputed from YouTube tags on every sync unless Manual Taxonomy Override is on. To hand-curate, flip the override first or the sync will reset your edits.',
    }),
    defineField({
      name: 'requiresReview',
      title: 'Requires Review',
      type: 'boolean',
      fieldset: 'taxonomy',
      initialValue: false,
      description:
        'Set by the sync when a video matched no Tier-1 category keyword (it lands in Uncategorized). Fix the tags on YouTube (next sync re-files it) or curate by hand with the override.',
    }),
    defineField({
      name: 'manualTaxonomyOverride',
      title: 'Manual Taxonomy Override (Sync Lock)',
      type: 'boolean',
      fieldset: 'taxonomy',
      initialValue: false,
      description:
        'When ON, the sync stops writing topics/hubs/requiresReview for this video forever — your hand-curation wins. Stats and metadata keep syncing normally.',
    }),
    defineField({
      name: 'coverageType',
      title: 'Coverage Type',
      type: 'string',
      fieldset: 'editorial',
      options: {
        list: [
          { title: 'Review', value: 'review' },
          { title: 'Reaction', value: 'reaction' },
          { title: 'Trailer', value: 'trailer' },
          { title: 'Breakdown', value: 'breakdown' },
          { title: 'Vlog', value: 'vlog' },
          { title: 'Interview', value: 'interview' },
          { title: 'News', value: 'news' },
          { title: 'Other', value: 'other' },
        ],
      },
    }),
    defineField({ name: 'series', title: 'Series', type: 'string', fieldset: 'editorial', description: 'Editorial series this video belongs to.' }),
    defineField({
      name: 'customHeroLogo',
      title: 'Custom Hero Logo (Override)',
      type: 'image',
      fieldset: 'editorial',
      options: { hotspot: true },
      description: 'Optional. Overrides the brand/franchise taxonomy logo in the hero.',
    }),
    defineField({
      name: 'customHeroBrandLabel',
      title: 'Custom Hero Brand Label (Override)',
      type: 'string',
      fieldset: 'editorial',
      description: 'Optional. Manually override the brand/franchise name text in the hero.',
    }),
    defineField({
      name: 'relatedMedia',
      title: 'Related Media',
      type: 'array',
      fieldset: 'editorial',
      description: 'Films, shows, games, etc. this video covers. Broader than "related films" to support future expansion.',
      of: [
        {
          type: 'object',
          name: 'relatedMediaItem',
          fields: [
            { name: 'title', title: 'Title', type: 'string' },
            {
              name: 'mediaType',
              title: 'Type',
              type: 'string',
              options: {
                list: [
                  { title: 'Film', value: 'film' },
                  { title: 'Show', value: 'show' },
                  { title: 'Game', value: 'game' },
                  { title: 'Comic', value: 'comic' },
                  { title: 'Other', value: 'other' },
                ],
              },
            },
          ],
          preview: { select: { title: 'title', subtitle: 'mediaType' } },
        },
      ],
    }),
    defineField({
      name: 'hubs',
      title: 'Hubs',
      type: 'array',
      fieldset: 'taxonomy',
      of: [{ type: 'reference', to: [{ type: 'featuredBrand' }, { type: 'event' }] }],
      description:
        'DERIVED: hub assignments (Featured Brands / Events) recomputed from YouTube tags on every sync unless Manual Taxonomy Override is on. Hub pages pull their coverage from these references.',
    }),
    defineField({ name: 'editorialNotes', title: 'Editorial Notes', type: 'text', rows: 3, fieldset: 'editorial' }),
  ],
  preview: {
    select: { title: 'title', status: 'contentStatus', youtubeId: 'youtubeId' },
    prepare({ title, status, youtubeId }: any) {
      return { title: title || youtubeId || 'Untitled video', subtitle: status ? `● ${status}` : undefined };
    },
  },
});
