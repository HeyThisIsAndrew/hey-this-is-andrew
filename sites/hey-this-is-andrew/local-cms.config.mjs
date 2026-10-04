// The local CMS for this site (@andrew/local-cms): which JSON files it edits
// and their fields. Dev only: `pnpm dev`, open /local-cms, edit, Save, then
// commit and push; Pages deploys. A build never contains the CMS.
// Phase 2 (Goals, Gear, Projects): see docs/local-cms-plan.md.

/** @type {import('@andrew/local-cms/config').LocalCmsConfig} */
export default {
  title: 'HEY_THISISANDREW · Local CMS',
  assetsDir: 'src/assets',
  uploadDir: 'src/assets/uploads',
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
  ],
};
