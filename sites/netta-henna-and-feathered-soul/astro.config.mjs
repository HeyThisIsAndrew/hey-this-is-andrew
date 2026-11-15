import { defineConfig } from 'astro/config';
import { localCms } from '@andrew/local-cms';
import localCmsConfig from './local-cms.config.mjs';

// SITE_URL: the site's public origin (e.g. https://yourname.github.io).
// BASE_PATH: the sub-path it is served from ("/" for a custom domain,
// "/<repo-name>/" for a GitHub Pages project site).
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  base: process.env.BASE_PATH || '/',
  // Dev only: /local-cms (edit the site's JSON), never in a build.
  integrations: [localCms(localCmsConfig)],
  // Images hosted on Sanity (imageHost in local-cms.config.mjs) are optimised too.
  image: { domains: ['cdn.sanity.io'] },
});
