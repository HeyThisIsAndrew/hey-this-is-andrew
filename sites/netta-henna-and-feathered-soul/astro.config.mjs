import { defineConfig } from 'astro/config';
import { localCms } from '@andrew/local-cms';
import localCmsConfig from './local-cms.config.mjs';

// SITE_URL: the site's public origin (e.g. https://nettahennaandfeatheredsoul.com or https://heythisisandrew.github.io).
// BASE_PATH: the sub-path it is served from ("/" for Cloudflare or a custom domain,
// "/hey-this-is-andrew/netta/" for GitHub Pages project preview).
const siteUrl = process.env.SITE_URL || 'https://netta-henna-and-feathered-soul.heythisisandrewb.workers.dev';
const basePath = process.env.BASE_PATH || '/';

export default defineConfig({
  site: siteUrl,
  base: basePath,
  // Dev only: /local-cms (edit the site's JSON), never in a build.
  integrations: [localCms(localCmsConfig)],
  // Images hosted on Sanity (imageHost in local-cms.config.mjs) are optimised too.
  image: { domains: ['cdn.sanity.io'] },
});
