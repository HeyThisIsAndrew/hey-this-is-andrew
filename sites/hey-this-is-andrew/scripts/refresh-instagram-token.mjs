#!/usr/bin/env node
/**
 * scripts/refresh-instagram-token.mjs: keep the Instagram tokens alive.
 *
 *   pnpm run refresh:token          (or the monthly refresh-token.yml workflow)
 *
 * A long-lived Instagram token expires 60 days after it was issued or last
 * refreshed. Refreshing it once a month keeps it valid indefinitely.
 *
 * Accounts (each token is a repository secret, never a file):
 *   CCC_INSTAGRAM_ACCESS_TOKEN  Capture Create Caffeinate. Required: the
 *                               "Shot on the Job" photos are synced with it.
 *   HEY_INSTAGRAM_ACCESS_TOKEN  Hey_ThisIsAndrew. Refreshed when set.
 *
 * Nothing is written to disk and no part of a token is printed: a refreshed
 * token is not a registered secret, so GitHub would not mask it in the log.
 * If Meta ever hands back a DIFFERENT token string, the stored secret is no
 * longer the one being kept alive, so the run fails and says which secret to
 * replace.
 */

const ACCOUNTS = [
  { env: 'CCC_INSTAGRAM_ACCESS_TOKEN', name: 'Capture Create Caffeinate', required: true },
  { env: 'HEY_INSTAGRAM_ACCESS_TOKEN', name: 'Hey_ThisIsAndrew', required: false },
];

async function refresh({ env, name, required }) {
  const token = (process.env[env] || '').trim();
  if (!token) {
    if (required) {
      console.error(`::error::${env} is not set. Add it under Settings > Secrets and variables > Actions.`);
      return false;
    }
    console.log(`- ${name}: ${env} not set, skipped.`);
    return true;
  }

  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;
  try {
    const res = await fetch(url);
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) {
      const reason = data?.error?.message || `HTTP ${res.status}`;
      console.error(`::error::${name}: refresh failed (${reason}). Generate a new long-lived token and replace the ${env} secret.`);
      return false;
    }
    const days = Math.round((data.expires_in || 5184000) / 86400);
    const expires = new Date(Date.now() + (data.expires_in || 5184000) * 1000).toISOString().slice(0, 10);
    if (data.access_token !== token) {
      console.error(`::error::${name}: Meta returned a new token string, so the ${env} secret is now stale. Generate a new long-lived token and replace the secret.`);
      return false;
    }
    console.log(`- ${name}: refreshed, valid ~${days} days (until ${expires}).`);
    return true;
  } catch (err) {
    console.error(`::error::${name}: network error during refresh (${err.message}).`);
    return false;
  }
}

let ok = true;
for (const account of ACCOUNTS) ok = (await refresh(account)) && ok;
process.exit(ok ? 0 : 1);
