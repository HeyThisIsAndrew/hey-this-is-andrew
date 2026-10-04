// The local CMS (@andrew/local-cms): `pnpm dev`, open /local-cms, edit, Save,
// then commit and push. Dev only: a build never contains it. Add a
// collection here for any JSON file the site reads (fields: text, textarea,
// markdown, url, email, number, date, boolean, select, list, asset, group,
// array). Images live in src/assets/uploads until imageHost is Sanity.

/** @type {import('@andrew/local-cms/config').LocalCmsConfig} */
export default {
  title: 'Local CMS',
  assetsDir: 'src/assets',
  uploadDir: 'src/assets/uploads',
  imageHost: { type: 'repo' },
  // imageHost: { type: 'sanity', projectId: '<id>', dataset: 'production' },
  collections: [
    {
      name: 'panels',
      label: 'Panels',
      file: 'src/data/panels.json',
      itemLabel: 'name',
      idField: 'id',
      help: 'The brand accordion on the home page, in order.',
      fields: [
        { key: 'id', label: 'ID (slug)', type: 'text', required: true },
        { key: 'name', label: 'Name', type: 'text', required: true },
        { key: 'kicker', label: 'Kicker (tag)', type: 'text', required: true },
        { key: 'headline', label: 'Headline', type: 'text', required: true },
        { key: 'deck', label: 'Deck (one line)', type: 'textarea', required: true },
        { key: 'cta', label: 'CTA label', type: 'text' },
        { key: 'url', label: 'URL', type: 'url' },
        { key: 'logo', label: 'Logo', type: 'asset' },
        { key: 'wordmark', label: 'Wordmark (shown when there is no logo)', type: 'text', required: true },
        { key: 'media', label: 'Photo', type: 'asset' },
        { key: 'accent', label: 'Accent', type: 'select', options: [{ value: '', label: 'Base' }, { value: 'brand', label: 'Brand colour' }] },
        { key: 'comingSoon', label: 'Coming soon', type: 'boolean' },
        { key: 'teaserTag', label: 'Teaser tag', type: 'text' },
      ],
    },
    {
      name: 'posts',
      label: 'Posts',
      file: 'src/data/posts.json',
      itemLabel: 'title',
      idField: 'id',
      fields: [
        { key: 'id', label: 'ID (slug)', type: 'text', required: true },
        { key: 'title', label: 'Title', type: 'text', required: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'summary', label: 'Summary', type: 'textarea', required: true },
        { key: 'body', label: 'Body (Markdown)', type: 'markdown' },
      ],
    },
  ],
};
