import { defineConfig } from 'astro/config';

// Reelay Studio public site configuration
export default defineConfig({
  site: process.env.SITE_URL || 'https://reelay.app',
  base: process.env.BASE_PATH || '/',
  trailingSlash: 'ignore',
  // /help is the name people guess; the help pages live at /support (linked from platform reviews).
  redirects: { '/help': '/support' },
  compressHTML: false,
  devToolbar: {
    enabled: false,
  },
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
});

