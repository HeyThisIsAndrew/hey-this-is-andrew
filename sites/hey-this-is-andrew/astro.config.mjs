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
    '/feed': withBase('/#latest'),
    '/work': withBase('/#work'),
    '/latest': withBase('/#latest'),
    '/goals': withBase('/build/#goals'),
    '/services': withBase('/#services'),
    '/gear': withBase('/#gear'),
    '/now': withBase('/#about'),
    '/now/': withBase('/#about'),
    '/cafe': withBase('/#brew'),
    '/cafe/': withBase('/#brew'),
    '/brands/hey-this-is-andrew': withBase('/#about'),
    '/brands/hey-this-is-andrew/': withBase('/#about'),
    '/brands/be-unconventional-hq': withBase('/#about'),
    '/brands/be-unconventional-hq/': withBase('/#about'),
    '/brands/capture-create-caffeinate': withBase('/#about'),
    '/brands/capture-create-caffeinate/': withBase('/#about'),
    
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
  // Images hosted on Sanity (imageHost in local-cms.config.mjs) are optimised too.
  image: { domains: ['cdn.sanity.io'] },
  integrations: [
    // Dev only: /local-cms and its API exist while `astro dev` runs, never
    // in a build (docs/local-cms-plan.md).
    localCms(localCmsConfig),
    sitemap({
      // Hero concept previews and the 404 are not pages to index.
      // /events/ is hidden until there is a real event (the page is kept).
      filter: (page) => !page.includes('/preview/') && !page.includes('/404') && !page.includes('/kit/') && !page.includes('/events/') && !page.includes('/work/') && !page.includes('/latest/') && !page.includes('/goals/') && !page.includes('/services/') && !page.includes('/gear/'),
    }),
  ],
});
