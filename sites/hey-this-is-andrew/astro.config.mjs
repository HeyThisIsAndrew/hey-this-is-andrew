import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';
import { localCms } from '@andrew/local-cms';
import localCmsConfig from './local-cms.config.mjs';

const isBuild = process.argv.includes('build') || Boolean(process.env.GITHUB_ACTIONS) || Boolean(process.env.CI);
const isCloudflare = process.env.CF_WORKERS === '1';
// SITE_URL / BASE_PATH, the names every site in the repo reads (ASTRO_SITE /
// ASTRO_BASE still work, for older scripts). Canonical origin: GitHub Pages by
// default; the Cloudflare build is its own origin (scripts/cloudflare.mjs sets
// SITE_URL to the Worker's address, or the preview's).
const site = process.env.SITE_URL || process.env.ASTRO_SITE
  || (isCloudflare ? 'https://hey-this-is-andrew.heythisisandrewb.workers.dev' : 'https://heythisisandrew.github.io');
const base = process.env.BASE_PATH || process.env.ASTRO_BASE || (isBuild ? '/hey-this-is-andrew' : '/');

const withBase = (path) => `${base.replace(/\/$/, '')}${path}`;

export default defineConfig({
  adapter: isCloudflare ? cloudflare({ imageService: 'passthrough' }) : undefined,
  site,
  base,
  // Keep legacy paths connected to their current pages or sections.
  redirects: {
    '/feed': withBase('/latest/'),
    '/work': withBase('/#work'),
    '/goals': withBase('/build/#goals'),
    '/services': withBase('/#services'),
    '/now': withBase('/about/'),
    '/cafe': withBase('/gear/#brew'),
    '/brands/hey-this-is-andrew': withBase('/about/'),
    '/brands/capture-create-caffeinate': withBase('/ccc/'),
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
      // Hero concept previews, unlisted dev pages, and the 404 are not pages to index.
      filter: (page) => !page.includes('/preview/') && !page.includes('/404') && !page.includes('/kit/') && !page.includes('/work/') && !page.includes('/goals/') && !page.includes('/services/') && !page.includes('/press/') && !page.includes('/brands/sip-the-magic'),
    }),
    {
      name: 'cloudflare-prep',
      hooks: {
        'astro:route:setup': ({ route }) => {
          if (route.component.includes('src/pages/api/contact.ts')) {
            route.prerender = !isCloudflare;
          }
        },
        'astro:build:done': async ({ dir }) => {
          const fs = await import('node:fs');
          const targetDirs = [dir, new URL('client/', dir)].filter((d) => fs.existsSync(d));
          for (const d of targetDirs) {
            const sIdx = new URL('sitemap-index.xml', d);
            const sOut = new URL('sitemap.xml', d);
            if (fs.existsSync(sIdx)) {
              fs.copyFileSync(sIdx, sOut);
            }
          }
          // public/robots.txt names the GitHub Pages sitemap; the Cloudflare
          // build points at its own. (Preview builds: scripts/cloudflare.mjs
          // then replaces it with Disallow: /.)
          if (isCloudflare) {
            const origin = site.replace(/\/$/, '');
            for (const d of targetDirs) {
              const robots = new URL('robots.txt', d);
              if (fs.existsSync(robots)) {
                fs.writeFileSync(robots, `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\nSitemap: ${origin}/sitemap-index.xml\n`);
              }
            }
          }
        },
      },
    },
  ],
});
