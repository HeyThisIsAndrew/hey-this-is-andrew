import { defineConfig } from 'astro/config';

// SITE_URL: the site's public origin (e.g. https://yourname.github.io).
// BASE_PATH: the sub-path it is served from ("/" for a custom domain,
// "/<repo-name>/" for a GitHub Pages project site).
export default defineConfig({
  site: process.env.SITE_URL || 'https://example.com',
  base: process.env.BASE_PATH || '/',
});
