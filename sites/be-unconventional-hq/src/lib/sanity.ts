/*
  The standalone replacement for the `sanity:client` virtual module.

  `sanity:client` came from @sanity/astro, which is now a devDependency loaded
  only outside production (see astro.config.mjs), so the two pages that still
  read from Sanity at build time - UpcomingEventsList and /media-kit - need a
  client that does not depend on that integration being mounted.

  useCdn MIRRORS WHAT THE INTEGRATION USED TO DO, rather than being pinned on.
  The config it replaced carried the note "false in dev for fresh data, true in
  prod for CDN cache", and hardcoding `true` quietly took the dev half of that
  away: every edit in the Studio then had to wait out the CDN before it showed
  up locally. `astro build` sets NODE_ENV=production itself, so a production
  build still gets the cache.
*/
import { createClient } from '@sanity/client';

export const sanityClient = createClient({
  projectId: '38nhxsib',
  dataset: 'production',
  useCdn: process.env.NODE_ENV === 'production',
  apiVersion: '2024-03-01',
});
