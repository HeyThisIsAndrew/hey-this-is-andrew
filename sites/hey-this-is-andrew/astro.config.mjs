import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const isBuild = process.argv.includes('build') || Boolean(process.env.GITHUB_ACTIONS) || Boolean(process.env.CI);
const base = process.env.ASTRO_BASE || (isBuild ? '/hey-this-is-andrew' : '/');

export default defineConfig({
  site: 'https://heythisisandrew.github.io',
  base,
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
