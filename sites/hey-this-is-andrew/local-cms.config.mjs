// The local CMS for this site (@andrew/local-cms): which JSON files it edits
// and their fields. Dev only: `pnpm dev`, open /local-cms, edit, Save, then
// commit and push; Pages deploys. A build never contains the CMS.
// Images: in the repo (src/assets/uploads) for now. To host them on Sanity
// (BE Unconventional HQ's system), set imageHost below and put the write
// token in SANITY_WRITE_TOKEN (.env, never committed). docs/local-cms-plan.md.

/** @type {import('@andrew/local-cms/config').LocalCmsConfig} */
export default {
  title: 'HEY_THISISANDREW · Local CMS',
  assetsDir: 'src/assets',
  uploadDir: 'src/assets/uploads',
  imageHost: { type: 'repo' },
  // imageHost: { type: 'sanity', projectId: '<id>', dataset: 'production' },
  collections: [
    {
      name: 'now',
      label: 'Now',
      file: 'src/data/now.json',
      itemLabel: 'label',
      help: 'The Now line (Meet The Creator, /now, the Now band). The month is the build month, set automatically.',
      fields: [
        { key: 'label', label: 'Label', type: 'text', required: true, help: 'e.g. Building, Shooting' },
        { key: 'value', label: 'Value', type: 'text', required: true },
      ],
    },
    {
      name: 'brands',
      label: 'Brands',
      file: 'src/data/brands.json',
      itemLabel: 'name',
      idField: 'id',
      help: 'The brand panels on the homepage, in order. Images: pick a file under src/assets/brand-logos, hero-media or uploads, or upload one.',
      fields: [
        { key: 'id', label: 'ID (slug)', type: 'text', required: true, help: 'Lowercase, used in #brand-<id> links. Change with care.' },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'kicker', label: 'Kicker (tag)', type: 'text', required: true },
        { key: 'headline', label: 'Headline', type: 'text', required: true },
        { key: 'deck', label: 'Deck (one line)', type: 'textarea', required: true },
        { key: 'cta', label: 'CTA label', type: 'text', help: 'Empty: no button.' },
        { key: 'url', label: 'Brand site URL', type: 'url', help: 'Empty: no link.' },
        { key: 'logo', label: 'Logo', type: 'asset' },
        { key: 'wordmark', label: 'Wordmark (shown when there is no logo)', type: 'text', required: true },
        { key: 'media', label: 'Photo', type: 'asset', help: 'Empty: the teaser card shows.' },
        { key: 'teaserArt', label: 'Teaser art (no photo yet)', type: 'select', options: [{ value: '', label: '(none)' }, { value: 'cup', label: 'Cup (Sip the Magic)' }] },
        { key: 'accent', label: 'Accent', type: 'select', options: [{ value: '', label: 'Monochrome (default)' }, { value: 'be-red', label: 'BE red (BE Unconventional HQ only)' }] },
        { key: 'ctaFillOnPanelHover', label: 'CTA fills when the panel is hovered (HQ behaviour)', type: 'boolean' },
        {
          key: 'inquiry',
          label: 'Inquiry link (quiet, under the CTA)',
          type: 'group',
          fields: [
            { key: 'email', label: 'Email', type: 'email', required: true },
            { key: 'subject', label: 'Subject', type: 'text', required: true },
            { key: 'label', label: 'Label', type: 'text', required: true },
          ],
        },
        { key: 'comingSoon', label: 'Coming soon (no CTA, teaser tag instead)', type: 'boolean' },
        { key: 'teaserTag', label: 'Teaser tag', type: 'text' },
      ],
    },
      {
      name: 'projects',
      label: 'Projects',
      file: 'src/data/projects.json',
      itemLabel: 'title',
      idField: 'id',
      help: 'Selected work (homepage) and /work. The two newest featured projects lead the homepage.',
      fields: [
        { key: 'id', label: 'ID (slug)', type: 'text', required: true },
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'description', label: 'Description', type: 'textarea', required: true },
        { key: 'role', label: 'Role', type: 'text' },
        { key: 'brand', label: 'Brand', type: 'select', options: [{ value: 'htia', label: 'Hey This Is Andrew' }, { value: 'be', label: 'BE Unconventional HQ' }, { value: 'ccc', label: 'Capture Create Caffeinate' }] },
        { key: 'tools', label: 'Tools', type: 'list' },
        { key: 'featured', label: 'Featured', type: 'boolean' },
        { key: 'image', label: 'Image', type: 'asset' },
        { key: 'link', label: 'Link', type: 'url' },
        { key: 'body', label: 'Write-up (Markdown)', type: 'markdown' },
      ],
    },
    {
      name: 'goals',
      label: 'Goals',
      file: 'src/data/goals.json',
      itemLabel: 'title',
      idField: 'id',
      help: 'The goal groups (homepage snapshot, /goals, /about). Lower order first.',
      fields: [
        { key: 'id', label: 'ID (slug)', type: 'text', required: true, help: 'Used in #goals-<id> links.' },
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'order', label: 'Order', type: 'number' },
        {
          key: 'items',
          label: 'Goals',
          type: 'array',
          required: true,
          fields: [
            { key: 'label', label: 'Goal', type: 'text', required: true },
            { key: 'status', label: 'Status', type: 'select', required: true, options: [{ value: 'done', label: 'Done' }, { value: 'in-progress', label: 'In progress' }, { value: 'next', label: 'Next' }] },
            { key: 'note', label: 'Note', type: 'text' },
          ],
        },
      ],
    },
    {
      name: 'gear',
      label: 'Gear',
      file: 'src/data/gear.json',
      itemLabel: 'category',
      idField: 'id',
      help: 'The kit, by category (/gear and the homepage Gear preview). Lower order first.',
      fields: [
        { key: 'id', label: 'ID (slug)', type: 'text', required: true },
        { key: 'category', label: 'Category', type: 'text', required: true },
        { key: 'order', label: 'Order', type: 'number' },
        { key: 'brand', label: 'Brands', type: 'text' },
        { key: 'subtitle', label: 'Subtitle', type: 'text' },
        {
          key: 'items',
          label: 'Items',
          type: 'array',
          required: true,
          fields: [
            { key: 'name', label: 'Name', type: 'text', required: true },
            { key: 'spec', label: 'Spec', type: 'textarea', required: true },
            { key: 'brand', label: 'Brand', type: 'text' },
            { key: 'affiliateUrl', label: 'Store link', type: 'url' },
            { key: 'tag', label: 'Tag', type: 'text' },
          ],
        },
      ],
    },
  
    {
      name: 'services',
      label: 'Services',
      file: 'src/data/services.json',
      itemLabel: 'title',
      help: 'What I do / services.',
      fields: [
        { key: 'lede', label: 'Lede', type: 'text' },
        {
          key: 'items',
          label: 'Service Items',
          type: 'array',
          fields: [
            { key: 'title', label: 'Title', type: 'text' },
            { key: 'desc', label: 'Description', type: 'textarea' }
          ]
        }
      ]
    },
    {
      name: 'events',
      label: 'Events',
      file: 'src/data/events.json',
      itemLabel: 'name',
      help: 'Upcoming and past events coverage.',
      fields: [
        {
          key: 'upcoming',
          label: 'Upcoming Events',
          type: 'array',
          fields: [
            { key: 'name', label: 'Event Name', type: 'text' },
            { key: 'location', label: 'Location', type: 'text' },
            { key: 'dates', label: 'Dates', type: 'text' },
            { key: 'blurb', label: 'Blurb', type: 'textarea' },
            { key: 'url', label: 'URL', type: 'url' }
          ]
        },
        {
          key: 'past',
          label: 'Past Coverage',
          type: 'array',
          fields: [
            { key: 'name', label: 'Event Name', type: 'text' },
            { key: 'location', label: 'Location', type: 'text' },
            { key: 'dates', label: 'Dates', type: 'text' },
            { key: 'blurb', label: 'Blurb', type: 'textarea' },
            { key: 'url', label: 'URL', type: 'url' }
          ]
        }
      ]
    },
    {
      name: 'press',
      label: 'Press Kit',
      file: 'src/data/press.json',
      itemLabel: 'label',
      help: 'Press kit information.',
      fields: [
        { key: 'email', label: 'Contact Email', type: 'email' },
        { key: 'bio', label: 'Bio Paragraphs', type: 'list' },
        {
          key: 'stats',
          label: 'Audience Stats',
          type: 'array',
          fields: [
            { key: 'label', label: 'Label', type: 'text' },
            { key: 'note', label: 'Note', type: 'text' }
          ]
        },
        {
          key: 'assets',
          label: 'Brand Assets',
          type: 'array',
          fields: [
            { key: 'name', label: 'Asset Name', type: 'text' },
            { key: 'desc', label: 'Description', type: 'textarea' },
            { key: 'href', label: 'File URL', type: 'text' },
            { key: 'filename', label: 'Download Filename', type: 'text' }
          ]
        }
      ]
    },
    {
      name: 'site',
      label: 'Site Config',
      file: 'src/data/site.json',
      itemLabel: 'title',
      help: 'Global site configuration.',
      fields: [
        { key: 'title', label: 'Site Title', type: 'text' },
        { key: 'description', label: 'Site Description', type: 'textarea' },
        { key: 'url', label: 'Site URL', type: 'url' }
      ]
    }

  ],
};
