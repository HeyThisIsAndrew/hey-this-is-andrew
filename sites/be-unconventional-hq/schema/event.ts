import { defineType, defineField } from 'sanity';

/**
 * Event — the master document that powers every coverage hub at
 * /events-new/[slug] (soon /events/[slug]). One template, many events.
 *
 * Two modelling decisions worth remembering:
 *
 *  1. Dates are `date`, NOT `datetime`. A convention "happens on July 22",
 *     it is not an instant in time. Storing a time-of-day + timezone on a
 *     calendar date is what caused the one-day-shift bug. As plain
 *     "YYYY-MM-DD" strings they also sort chronologically by string
 *     comparison, so the render layer needs no Date objects at all.
 *
 *  2. `status` only stores the EDITORIAL states (cancelled / postponed).
 *     upcoming / live / completed are DERIVED from the dates at render time
 *     (see the getEventStatus helper added in the lifecycle milestone), so
 *     nobody has to hand-flip an event from "upcoming" to "live" as time
 *     passes. Store what you can't compute; compute the rest.
 */
export default defineType({
  name: 'event',
  title: 'Event',
  type: 'document',
  // Fieldsets only group fields in the Studio UI — they have no effect on the
  // stored document shape or on GROQ queries.
  fieldsets: [
    { name: 'core', title: 'Core' },
    { name: 'recurring', title: 'Recurring Series', options: { collapsible: true } },
    { name: 'details', title: 'Details & Links', options: { collapsible: true } },
    { name: 'media', title: 'Media', options: { collapsible: true } },
    { name: 'lifecycle', title: 'Lifecycle', options: { collapsible: true } },
  ],
  fields: [
    // ── Core ────────────────────────────────────────────────────────────
    defineField({
      name: 'layoutMode',
      title: 'Layout Mode',
      type: 'string',
      fieldset: 'core',
      description: 'Choose "Announcement" for early coverage (70/30 split) or "Featured" for a full editorial hub takeover.',
      options: {
        list: [
          { title: 'Announcement', value: 'announcement' },
          { title: 'Featured', value: 'featured' },
        ],
        layout: 'radio',
      },
      initialValue: 'announcement',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'title',
      title: 'Title',
      type: 'string',
      fieldset: 'core',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'slug',
      title: 'Slug',
      type: 'slug',
      fieldset: 'core',
      options: { source: 'title', maxLength: 96 },
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'eventType',
      title: 'Event Type',
      type: 'string',
      fieldset: 'core',
      /*
        PRESS-GRADE TERMINOLOGY, AND ONE TERM PER THING.

        `convention` and `expo` were two options for a distinction no event on
        this site actually makes — Anime Expo is a convention, PAX is an expo,
        and an editor picking between them was guessing. They are one
        `convention-expo` now, and the site owner independently arriving at
        "I don't even know what an expo is" is the best evidence the merge was
        right: a label an editor cannot choose confidently carries no
        information to a reader either.

        It DISPLAYS as plain "Convention". Naming both halves was the merge
        apologising for itself, and the pair was long enough to wrap on a
        phone. The value is unchanged — it is stored on fourteen documents and
        renaming it would be a migration for no gain. `award_show` became `industry-awards`, and
        `brand-activation` is genuinely new.

        `showcase` covers the streamed-presentation format — a Nintendo
        Direct, a State of Play, an Xbox Games Showcase, Summer Game Fest.
        It was added because three of the featured hubs run one on a
        schedule, so it is a recurring beat rather than an accommodation for
        a single event. Without it those all land on `festival`, which should
        keep meaning SXSW and film festivals: things with a venue, a badge
        and attendees.

        VALUES ARE THE STORED DATA. Changing one is a migration, not an edit:
        the fourteen events on `convention` were rewritten in the same commit
        that introduced this list, and EVENT_TYPE_LABELS in src/lib/events.ts
        plus the dropdown in LocalCmsApp.tsx carry the identical set. All three
        must move together or the local CMS offers a value the renderer has no
        label for, and getEventTypeLabel() falls through to its title-casing
        fallback instead of the curated wording. scripts/events.test.mjs reads
        all three files and fails if they drift.

        Kebab-case throughout. The retired `award_show` was the only snake_case
        value here and it is gone with it.
      */
      options: {
        list: [
          { title: 'Convention', value: 'convention-expo' },
          { title: 'Premiere', value: 'premiere' },
          { title: 'Screening', value: 'screening' },
          { title: 'Showcase', value: 'showcase' },
          { title: 'Festival', value: 'festival' },
          { title: 'Industry Awards', value: 'industry-awards' },
          { title: 'Brand Activation', value: 'brand-activation' },
          { title: 'Other', value: 'other' },
        ],
        layout: 'dropdown',
      },
    }),
    defineField({
      name: 'organizer',
      title: 'Organizer',
      type: 'string',
      fieldset: 'core',
      description: 'e.g. San Diego Comic Convention',
    }),
    defineField({
      name: 'startDate',
      title: 'Start Date',
      type: 'date',
      fieldset: 'core',
      options: { dateFormat: 'YYYY-MM-DD' },
      description:
        'Calendar date only — no time, no timezone. Stored as YYYY-MM-DD. ' +
        'Optional on a recurring TEMPLATE, which describes a series rather than one occurrence.',
      /*
        Conditionally required. A template ("PAX West") has no date of its
        own — dates belong to its editions — so making this unconditionally
        required would mean every template needed a fake one, and a fake date
        is a date the front end will sort and display.
      */
      validation: (rule) =>
        rule.custom((startDate: string | undefined, context: any) => {
          if (context?.document?.isRecurringTemplate) return true;
          return startDate ? true : 'Start date is required for a dated event';
        }),
    }),
    defineField({
      name: 'endDate',
      title: 'End Date',
      type: 'date',
      fieldset: 'core',
      options: { dateFormat: 'YYYY-MM-DD' },
      description: 'Leave empty for single-day events.',
      // Cross-field validation: because both are "YYYY-MM-DD" strings, a plain
      // string comparison is a correct chronological comparison.
      validation: (rule) =>
        rule.custom((endDate: string | undefined, context: any) => {
          const start = context?.document?.startDate;
          if (!endDate || !start) return true;
          return endDate >= start ? true : 'End date must be on or after the start date';
        }),
    }),

    // ── Recurring series ────────────────────────────────────────────────
    /*
      ═══════════════════════════════════════════════════════════════════════
       RECURRING EVENTS: ONE PROFILE, MANY EDITIONS
      ═══════════════════════════════════════════════════════════════════════

      PAX West, D23 and SDCC come round every year, and almost nothing about
      them changes between editions: the logo, the key art, the brand colour,
      the venue, the organizer, the official site and the YouTube sync
      keywords are all the same. Only the dates, the ticket link and the
      edition label move.

      Before this, a new edition meant a blank document and rebuilding all of
      it by hand — which is how you get "PAX West 2026" with last year's
      keywords missing and a slightly different brand red.

      THE MODEL IS TEMPLATE + EDITIONS, NOT A REPEAT RULE.

      A repeating-date rule (RRULE, "every September") was the other option
      and it is wrong for this domain: these dates are announced, not
      computed. SDCC is not "the third weekend in July" — it is whatever the
      organizer says it is, and it moves. So the schema stores a reusable
      PROFILE and each real occurrence is its own document pointing back at
      it. Every edition keeps its own page, its own coverage and its own
      archive entry, which is exactly what /events/archive is for.

      WHAT EACH FIELD IS FOR:

        isRecurringTemplate  Marks this document as the profile, not an
                             occurrence. Templates are filtered out of every
                             public surface in getEventsLocal() — they have no
                             page, no calendar row and no archive card.
        seriesTemplate       An edition's pointer back to its template. This
                             is the "single source of truth" link: the
                             template is where shared detail is corrected
                             once.
        editionLabel         What distinguishes this occurrence in a list —
                             "2026", "Winter 2027". Not derived from the
                             start date, because an edition is often
                             announced and named long before it is dated.
        recurrenceCadence    How often the series comes round. Editorial
                             planning information; nothing renders from it
                             yet, and nothing computes a date from it.
        recurrenceMonth      The month it usually lands in, for the same
                             reason. "Usually" is the operative word.
    */
    defineField({
      name: 'isRecurringTemplate',
      title: 'This is a recurring series template',
      type: 'boolean',
      fieldset: 'recurring',
      description:
        'Turn on for a reusable profile such as "PAX West" or "SDCC". A template never appears on the site: it exists so each new edition can be duplicated from it instead of rebuilt. Leave off for a real, dated event.',
      initialValue: false,
    }),
    defineField({
      name: 'seriesTemplate',
      title: 'Part of series',
      type: 'reference',
      fieldset: 'recurring',
      to: [{ type: 'event' }],
      /*
        Only templates are offered, and a template cannot be filed under
        another template — that would be a series of series, which this model
        has no meaning for.
      */
      options: {
        filter: 'isRecurringTemplate == true && _id != $self',
        filterParams: { self: '' },
      },
      description:
        'The template this edition was duplicated from. Shared detail (artwork, venue, keywords) is corrected on the template.',
      hidden: ({ document }: any) => Boolean(document?.isRecurringTemplate),
    }),
    defineField({
      name: 'editionLabel',
      title: 'Edition',
      type: 'string',
      fieldset: 'recurring',
      description: 'What names this occurrence within the series, e.g. "2026" or "Winter 2027".',
      hidden: ({ document }: any) => Boolean(document?.isRecurringTemplate),
    }),
    defineField({
      name: 'recurrenceCadence',
      title: 'Cadence',
      type: 'string',
      fieldset: 'recurring',
      description: 'Planning information only. No date is ever computed from this.',
      options: {
        list: [
          { title: 'Annual', value: 'annual' },
          { title: 'Twice a year', value: 'biannual' },
          { title: 'Quarterly', value: 'quarterly' },
          { title: 'Irregular', value: 'irregular' },
        ],
        layout: 'dropdown',
      },
      hidden: ({ document }: any) => !document?.isRecurringTemplate,
    }),
    defineField({
      name: 'recurrenceMonth',
      title: 'Usual month',
      type: 'string',
      fieldset: 'recurring',
      description: 'The month this series normally lands in. "Normally" — announced dates always win.',
      options: {
        list: [
          { title: 'January', value: '01' },
          { title: 'February', value: '02' },
          { title: 'March', value: '03' },
          { title: 'April', value: '04' },
          { title: 'May', value: '05' },
          { title: 'June', value: '06' },
          { title: 'July', value: '07' },
          { title: 'August', value: '08' },
          { title: 'September', value: '09' },
          { title: 'October', value: '10' },
          { title: 'November', value: '11' },
          { title: 'December', value: '12' },
        ],
        layout: 'dropdown',
      },
      hidden: ({ document }: any) => !document?.isRecurringTemplate,
    }),

    // ── Details & Links ─────────────────────────────────────────────────
    /*
      TWO PIECES OF PROSE, AND THEY ARE NOT INTERCHANGEABLE.

      `tagline` is the ONE LINE under the logo in the hero. `description` is
      the ABOUT paragraph in the article body below it. They used to be the
      same field: the hero rendered `description` clamped to five lines with a
      "Read more" beside it, so the hero cut a sentence off mid-word and the
      full paragraph sat a screen below anyway. On an event page the toggle
      never even appeared — the script that drives it lives in
      featured/[slug].astro, not in the event components — so the copy was
      simply truncated with no way to finish it.

      Keeping them separate means neither has to compromise: the tagline can
      be written for the hero, and the About copy can be as long as it needs.
    */
    defineField({
      name: 'tagline',
      title: 'Short Description (Bio)',
      type: 'string',
      fieldset: 'details',
      description:
        'One short line under the logo in the hero. Aim for a handful of words. Leave it empty and the event name is used instead. This is NOT the About copy below, which is the next field.',
      validation: (rule) =>
        rule.max(120).warning('A hero line over 120 characters will wrap and stop reading as a tagline.'),
    }),
    defineField({
      name: 'description',
      title: 'About (Full Description)',
      type: 'text',
      rows: 4,
      fieldset: 'details',
      description:
        'The ABOUT section in the body of the event page. Write as much as it needs. It is no longer shown in the hero, so nothing here gets truncated.',
    }),
    defineField({
      name: 'location',
      title: 'Location',
      type: 'object',
      fieldset: 'details',
      options: { collapsible: false },
      fields: [
        defineField({ name: 'venue', title: 'Venue', type: 'string' }),
        defineField({ name: 'city', title: 'City', type: 'string' }),
        defineField({ name: 'region', title: 'State / Region', type: 'string' }),
        defineField({ name: 'country', title: 'Country', type: 'string' }),
      ],
    }),
    defineField({
      name: 'officialWebsite',
      title: 'Official Website',
      type: 'url',
      fieldset: 'details',
      description: "The event's own homepage.",
    }),
    defineField({
      name: 'signUpLink',
      title: 'Sign Up / RSVP / Tickets Link',
      type: 'url',
      fieldset: 'details',
      description: 'Where attendees register or buy tickets (distinct from the official website).',
    }),
    defineField({
      name: 'brandColor',
      title: 'Brand Color (Hex Code)',
      type: 'string',
      fieldset: 'details',
      description: 'e.g. #FF0000',
      validation: (rule) =>
        rule.regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/, {
          name: 'hex color',
          invert: false,
        }),
    }),
    defineField({
      name: 'socialLinks',
      title: 'Social Links',
      type: 'array',
      fieldset: 'details',
      description: 'Official social accounts for this event.',
      of: [
        {
          type: 'object',
          name: 'socialLink',
          fields: [
            {
              name: 'platform',
              title: 'Platform',
              type: 'string',
              options: {
                list: [
                  { title: 'Instagram', value: 'instagram' },
                  { title: 'X / Twitter', value: 'x' },
                  { title: 'TikTok', value: 'tiktok' },
                  { title: 'YouTube', value: 'youtube' },
                  { title: 'Facebook', value: 'facebook' },
                  { title: 'Website', value: 'website' },
                ],
              },
            },
            { name: 'url', title: 'URL', type: 'url' },
          ],
          preview: { select: { title: 'platform', subtitle: 'url' } },
        },
      ],
    }),

    // ── Media ───────────────────────────────────────────────────────────
    defineField({
      name: 'heroImage',
      title: 'Hero Background Image',
      type: 'image',
      fieldset: 'media',
      options: { hotspot: true },
    }),
    defineField({
      name: 'logo',
      title: 'Event Logo',
      type: 'image',
      fieldset: 'media',
      options: { hotspot: true },
      description: 'Transparent PNG. Becomes the visible identity element in the hero.',
    }),
    defineField({
      name: 'heroLogo',
      title: 'Hero Logo (optional)',
      type: 'image',
      fieldset: 'media',
      options: { hotspot: true },
      description:
        'Overrides ONLY the small mark at the top left of the hero. Empty falls back to Logo. The hero shows a mark three times (small left, blurred ghost, large right) and the last two are deliberately one asset. Set this where the brand mark is not edition-specific: PAX West, East, Aus and Unplugged share one PAX wordmark, so without it their heroes are indistinguishable.',
    }),

    defineField({
      name: 'stageLogo',
      title: 'Stage Logo (optional)',
      type: 'image',
      fieldset: 'media',
      options: { hotspot: true },
      description:
        'The third mark. Overrides ONLY the large mark on the hero stage, and only when "Show a logo on the stage" is on. Empty falls back to Logo.',
    }),
    defineField({
      name: 'stageShowMark',
      title: 'Show a logo on the stage',
      type: 'boolean',
      fieldset: 'media',
      initialValue: false,
      description:
        'Off (the default) fills the frame where the trailer plays with the key art, blurred. On puts a mark there instead. The hero already shows a mark at the top left, so a mark here states the same identity twice on one screen: turn this on only where the stage logo is a different thing from the hero one.',
    }),

    defineField({
      name: 'trailerUrl',
      title: 'Hero Trailer URL',
      type: 'url',
      fieldset: 'media',
      description: 'A YouTube URL embedded as the trailer in the hero banner.',
    }),
    defineField({
      name: 'customHeroLogo',
      title: 'Custom Hero Logo (Override)',
      type: 'image',
      fieldset: 'media',
      options: { hotspot: true },
      description: 'Optional. Overrides the brand/franchise taxonomy logo in the hero.',
    }),
    defineField({
      name: 'customHeroBrandLabel',
      title: 'Custom Hero Brand Label (Override)',
      type: 'string',
      fieldset: 'media',
      description: 'Optional. Manually override the brand/franchise name text in the hero.',
    }),
    defineField({
      name: 'videoAssets',
      title: 'Additional Videos',
      type: 'array',
      fieldset: 'media',
      description: 'Supplementary trailers or clips beyond the hero trailer.',
      of: [
        {
          type: 'object',
          name: 'videoAsset',
          fields: [
            { name: 'title', title: 'Title', type: 'string' },
            { name: 'url', title: 'YouTube URL', type: 'url' },
          ],
          preview: { select: { title: 'title', subtitle: 'url' } },
        },
      ],
    }),
    defineField({
      name: 'gallery',
      title: 'Image Gallery',
      type: 'array',
      fieldset: 'media',
      of: [
        {
          type: 'image',
          options: { hotspot: true },
          fields: [{ name: 'alt', title: 'Alt text', type: 'string' }],
        },
      ],
    }),
    defineField({
      name: 'sponsors',
      title: 'Sponsor Logos',
      type: 'array',
      fieldset: 'media',
      of: [
        {
          type: 'object',
          name: 'sponsor',
          fields: [
            { name: 'name', title: 'Name', type: 'string' },
            { name: 'logo', title: 'Logo', type: 'image', options: { hotspot: true } },
            { name: 'url', title: 'Website', type: 'url' },
          ],
          preview: { select: { title: 'name', media: 'logo' } },
        },
      ],
    }),
    defineField({
      name: 'pressAssets',
      title: 'Downloadable Press Assets',
      type: 'array',
      fieldset: 'media',
      description: 'One-sheets, logo packs, fact sheets — anything a partner can download.',
      of: [
        {
          type: 'object',
          name: 'pressAsset',
          fields: [
            { name: 'label', title: 'Label', type: 'string' },
            { name: 'file', title: 'File', type: 'file' },
          ],
          preview: { select: { title: 'label' } },
        },
      ],
    }),

    // ── Lifecycle ───────────────────────────────────────────────────────
    defineField({
      name: 'status',
      title: 'Status Override',
      type: 'string',
      fieldset: 'lifecycle',
      description:
        'Upcoming / Live / Completed are derived automatically from the dates — leave this on "Scheduled". Only change it to Cancelled or Postponed to override.',
      options: {
        list: [
          { title: 'Scheduled (auto by date)', value: 'scheduled' },
          { title: 'Cancelled', value: 'cancelled' },
          { title: 'Postponed', value: 'postponed' },
        ],
        layout: 'radio',
      },
      initialValue: 'scheduled',
      validation: (rule) => rule.required(),
    }),

    // ── Content matching ────────────────────────────────────────────────
    defineField({
      name: 'youtubeSyncKeywords',
      title: 'Tags',
      type: 'array',
      fieldset: 'details',
      of: [{ type: 'string' }],
      options: { layout: 'tags' },
      description:
        'ONE tag list, read by everything: the YouTube sync\u2019s hub dictionary, the site\u2019s article and video matching, search, and the Instagram topic filter. Was split into sync keywords and coverage tags; in practice a video and a post about the same event carry the same words, so the split only meant typing the list twice. Case and punctuation are ignored ("SDCC 2026" = "sdcc-2026"), the YEAR is not.',
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

    // Legacy fields — retained so existing documents aren't orphaned. Content is
    // now pulled via `tags` matching against the global feed, so these are no
    // longer the primary mechanism. Safe to remove once no document uses them.
    defineField({
      name: 'videoIds',
      title: 'Related YouTube Video IDs (legacy)',
      type: 'array',
      fieldset: 'details',
      of: [{ type: 'string' }],
      initialValue: [],
    }),
    defineField({
      name: 'articleUrls',
      title: 'Related Substack URLs (legacy)',
      type: 'array',
      fieldset: 'details',
      of: [{ type: 'url' }],
      initialValue: [],
    }),
  ],
  preview: {
    select: {
      title: 'title',
      media: 'logo',
      start: 'startDate',
      isTemplate: 'isRecurringTemplate',
      edition: 'editionLabel',
    },
    prepare({ title, media, start, isTemplate, edition }: any) {
      /* A template and its editions share a name, so the list has to say
         which is which — otherwise "PAX West" appears five times. */
      if (isTemplate) {
        return { title: `${title} (series template)`, subtitle: 'Reusable profile — not published', media };
      }
      const subtitle = [edition, start || 'No date set'].filter(Boolean).join(' · ');
      return { title, subtitle, media };
    },
  },
});
