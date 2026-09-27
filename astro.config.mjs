import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://heythisisandrew.github.io',
  base: '/hey-this-is-andrew',
  redirects: {
    '/about': '/hey-this-is-andrew/about',
    '/feed': '/hey-this-is-andrew/feed',
    '/links': '/hey-this-is-andrew/links',
    '/press': '/hey-this-is-andrew/press',
    '/sitemap': '/hey-this-is-andrew/sitemap',
    '/privacy': '/hey-this-is-andrew/privacy',
    '/events': '/hey-this-is-andrew/events',
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
  integrations: [sitemap()],
});
