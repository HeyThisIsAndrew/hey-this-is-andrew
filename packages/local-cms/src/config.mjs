/*
  The CMS is configured, never written for one site: a site lists its
  collections and their fields, and the editor renders forms from that.
*/

/**
 * @typedef {'text' | 'textarea' | 'markdown' | 'url' | 'email' | 'number' | 'date' | 'boolean' | 'select' | 'list' | 'asset' | 'group' | 'array'} FieldType
 * @typedef {{
 *   key: string,
 *   label?: string,
 *   type: FieldType,
 *   required?: boolean,
 *   help?: string,
 *   options?: { value: string, label?: string }[],
 *   fields?: Field[],
 * }} Field
 * @typedef {{
 *   name: string,
 *   label?: string,
 *   file: string,
 *   itemLabel?: string,
 *   idField?: string,
 *   help?: string,
 *   fields: Field[],
 * }} Collection
 * @typedef {{
 *   title?: string,
 *   assetsDir?: string,
 *   uploadDir?: string,
 *   imageHost?: { type: 'repo' } | { type: 'sanity', projectId: string, dataset: string, tokenEnv?: string, apiVersion?: string },
 *   collections: Collection[],
 * }} LocalCmsConfig
 */

/* text, textarea and markdown are strings (markdown is a hint to the editor
   and to the site, which renders it); number and date are typed; list is an
   array of strings; group is one object of `fields`, array is a repeatable
   list of them. */
export const FIELD_TYPES = ['text', 'textarea', 'markdown', 'url', 'email', 'number', 'date', 'boolean', 'select', 'list', 'asset', 'group', 'array'];

/** A path inside the site, relative, with no way out of it. */
function safeRelative(p) {
  return typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.split(/[\\/]/).includes('..');
}

/**
 * Throws with every problem at once, so a bad config fails at `astro dev`
 * startup instead of on the first save.
 * @param {LocalCmsConfig} config
 */
export function validateConfig(config) {
  const problems = [];
  if (!config || !Array.isArray(config.collections) || config.collections.length === 0) {
    throw new Error('local-cms: config.collections must be a non-empty array');
  }
  for (const dir of ['assetsDir', 'uploadDir']) {
    if (config[dir] !== undefined && !safeRelative(config[dir])) problems.push(`${dir} must be a relative path inside the site`);
  }
  const names = new Set();
  const checkFields = (fields, where) => {
    if (!Array.isArray(fields) || fields.length === 0) {
      problems.push(`${where}: fields must be a non-empty array`);
      return;
    }
    const keys = new Set();
    for (const f of fields) {
      if (!f || typeof f.key !== 'string' || !f.key) { problems.push(`${where}: a field has no key`); continue; }
      if (keys.has(f.key)) problems.push(`${where}: duplicate field "${f.key}"`);
      keys.add(f.key);
      if (!FIELD_TYPES.includes(f.type)) problems.push(`${where}.${f.key}: unknown type "${f.type}"`);
      if (f.type === 'select' && (!Array.isArray(f.options) || f.options.length === 0)) problems.push(`${where}.${f.key}: a select needs options`);
      if (f.type === 'group' || f.type === 'array') checkFields(f.fields, `${where}.${f.key}`);
    }
  };
  for (const c of config.collections) {
    if (!c || typeof c.name !== 'string' || !/^[a-z0-9-]+$/.test(c.name)) { problems.push(`a collection name must be lowercase letters, digits and dashes`); continue; }
    if (names.has(c.name)) problems.push(`duplicate collection "${c.name}"`);
    names.add(c.name);
    if (!safeRelative(c.file) || !c.file.endsWith('.json')) problems.push(`${c.name}: file must be a relative .json path inside the site`);
    checkFields(c.fields, c.name);
    if (c.idField && !c.fields?.some((f) => f.key === c.idField)) problems.push(`${c.name}: idField "${c.idField}" is not one of its fields`);
  }
  const host = config.imageHost;
  if (host && !['repo', 'sanity'].includes(host.type)) problems.push(`imageHost.type must be "repo" or "sanity"`);
  if (host?.type === 'sanity' && (!host.projectId || !host.dataset)) problems.push('imageHost (sanity) needs projectId and dataset');
  if (problems.length) throw new Error(`local-cms config:\n  - ${problems.join('\n  - ')}`);
  return config;
}

/** What the editor needs to know (no absolute paths). */
export function publicConfig(config) {
  return {
    title: config.title ?? 'Local CMS',
    uploadDir: config.uploadDir ?? 'src/assets/uploads',
    assetsDir: config.assetsDir ?? 'src/assets',
    imageHost: config.imageHost?.type === 'sanity'
      ? { type: 'sanity', projectId: config.imageHost.projectId, dataset: config.imageHost.dataset }
      : { type: 'repo' },
    collections: config.collections.map(({ name, label, file, itemLabel, idField, help, fields }) => ({ name, label: label ?? name, file, itemLabel, idField, help, fields })),
  };
}
