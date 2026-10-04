/*
  The Astro integration. In `astro dev` it adds the /local-cms page and the
  API; in `astro build` it does nothing at all, so the CMS can never reach a
  deployed site (HQ's rule, kept: the route is injected only when
  command === 'dev').
*/
import { fileURLToPath } from 'node:url';
import { validateConfig } from './config.mjs';
import { localCmsVitePlugin } from './middleware.mjs';

/**
 * @param {import('./config.mjs').LocalCmsConfig} config
 * @returns {import('astro').AstroIntegration}
 */
export function localCms(config) {
  validateConfig(config);
  return {
    name: '@andrew/local-cms',
    hooks: {
      'astro:config:setup': ({ command, config: astroConfig, injectRoute, updateConfig, logger }) => {
        if (command !== 'dev') return;
        const root = fileURLToPath(astroConfig.root);
        injectRoute({ pattern: '/local-cms', entrypoint: '@andrew/local-cms/route.astro' });
        updateConfig({ vite: { plugins: [localCmsVitePlugin({ root, config })] } });
        logger.info('Local CMS at /local-cms (dev only)');
      },
    },
  };
}
