import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { localCms } from '@andrew/local-cms';
import localCmsConfig from './local-cms.config.mjs';

const isBuild = process.argv.includes('build') || Boolean(process.env.GITHUB_ACTIONS) || Boolean(process.env.CI);
const base = process.env.ASTRO_BASE || (isBuild ? '/hey-this-is-andrew' : '/');

const withBase = (path) => `${base.replace(/\/$/, '')}${path}`;

export default defineConfig({
  site: 'https://heythisisandrew.github.io',
  base,
  // /feed was a second archive of the same videos and articles; /latest is
  // the one archive now (Prompt 2). Kept as a redirect so old links work.
  redirects: {
    '/feed': withBase('/latest/'),
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  preview: {
    host: '0.0.0.0',
    port: process.env.PORT ? parseInt(process.env.PORT, 10) : 3000,
  },
  vite: {
    server: {
      allowedHosts: true,
    },
    preview: {
      allowedHosts: true,
    },
  },
  integrations: [
    // Dev only: /local-cms and its API exist while `astro dev` runs, never
    // in a build (docs/local-cms-plan.md).
    localCms(localCmsConfig),
    sitemap({
      // Hero concept previews and the 404 are not pages to index.
      // /events/ is hidden until there is a real event (the page is kept).
      filter: (page) => !page.includes('/preview/') && !page.includes('/404') && !page.includes('/events/'),
    }),
  ],
});
