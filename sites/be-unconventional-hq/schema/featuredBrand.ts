import { defineType, defineField } from 'sanity';

export default defineType({
  name: 'featuredBrand',
  title: 'Featured Brand',
  type: 'document',
  fields: [
    defineField({
      name: 'title',
      title: 'Brand / Feature Title',
      type: 'string',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      options: {
        source: 'title',
        maxLength: 96,
      },
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'description',
      title: 'Description',
      type: 'text',
      description: 'A short description of this brand or topic to appear on the Featured Index card.',
    }),
    defineField({
      name: 'heroImage',
      title: 'Hero Image (Cinematic)',
      type: 'image',
      options: {
        hotspot: true,
      },
      description: 'Used for the background of the hub and the index card. Must be high resolution (1920x1080).',
    }),
    defineField({
      name: 'logo',
      title: 'Brand Logo',
      type: 'image',
      options: {
        hotspot: true,
      },
      description: 'A transparent PNG logo to overlay on the cinematic header.',
    }),
    defineField({
      name: 'heroLogo',
      title: 'Hero Logo (optional)',
      type: 'image',
      options: { hotspot: true },
      description:
        'Overrides ONLY the small mark at the top left of the hub page. Empty falls back to Brand Logo. The hub hero shows a mark three times (small left, blurred ghost, large in the trailer frame) and this is the one slot that can differ.',
    }),
    defineField({
      name: 'stageLogo',
      title: 'Stage Logo (optional)',
      type: 'image',
      options: { hotspot: true },
      description:
        'The third mark. Overrides ONLY the large mark in the trailer frame, and only while "Show a logo on the stage" is on. Empty falls back to Brand Logo.',
    }),
    defineField({
      name: 'stageShowMark',
      title: 'Show a logo on the stage',
      type: 'boolean',
      initialValue: false,
      description:
        'Off (the default) fills the frame where the trailer plays with the hub art, from Backdrops if set and Hero Image otherwise. On puts a mark there instead. The hero already shows a mark at the top left, so a mark here states the same identity twice on one screen: turn this on only where the stage logo is a different thing from the hero one.',
    }),

    defineField({
      name: 'trailerUrl',
      title: 'YouTube Trailer URL',
      type: 'url',
      description: 'A YouTube video link to loop quietly in the background of the cinematic header.',
    }),
    defineField({
      name: 'youtubeSyncKeywords',
      title: 'YouTube Sync Keywords (Tier 2)',
      type: 'array',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description:
        'YouTube tags that auto-assign a video to this brand hub (case/punctuation-insensitive exact match), e.g. "marvel". Set once — epic #34.',
    }),

    defineField({
      name: 'excludeCoverage',
      title: 'Exclude From Coverage',
      type: 'array',
      fieldset: 'details',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description:
        'Article slugs, article guids, YouTube ids or document _ids to drop from this hub no matter what the tags say. The override for a retrospective: a post about SDCC published in 2027 might be about either edition, and nothing in the data says which, so the edition comes from the tag and anything a loose tag wrongly pulls in gets named here.',
    }),

    defineField({
      name: 'pinnedCoverage',
      title: 'Pin To This Hub',
      type: 'array',
      fieldset: 'details',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description:
        'Article slugs, article guids, YouTube ids or document _ids this hub owns whatever the tags say. A pin beats tag matching outright, so it both adds the item to this hub\u2019s coverage and makes an article page show THIS hub on its card. Use it when the tags point somewhere defensible but wrong, e.g. a GTA piece that mentions Netflix in passing. An item named in Exclude From Coverage stays excluded even if it is pinned.',
    }),

  ],
});
