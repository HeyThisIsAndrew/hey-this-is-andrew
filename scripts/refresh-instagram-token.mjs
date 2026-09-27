#!/usr/bin/env node

/**
 * scripts/refresh-instagram-token.mjs
 * 
 * Standalone utility to refresh the Meta Instagram Graph API user access token.
 * Can be run via:
 *   node scripts/refresh-instagram-token.mjs
 * or in npm scripts:
 *   npm run refresh:token
 * or in a GitHub Actions cron job.
 */

import fs from 'node:fs';
import path from 'node:path';

async function main() {
  console.log('🔄 Checking Instagram access token...');

  let token = process.env.INSTAGRAM_ACCESS_TOKEN;

  // Check /app/.dev.env.json
  if (!token) {
    try {
      const devEnvPath = '/app/.dev.env.json';
      if (fs.existsSync(devEnvPath)) {
        const raw = fs.readFileSync(devEnvPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.INSTAGRAM_ACCESS_TOKEN) token = parsed.INSTAGRAM_ACCESS_TOKEN;
      }
    } catch {}
  }

  // Check src/data/instagram-token.json
  const tokenFile = path.resolve(process.cwd(), 'src/data/instagram-token.json');
  if (!token) {
    try {
      if (fs.existsSync(tokenFile)) {
        const parsed = JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        if (parsed.accessToken) token = parsed.accessToken;
      }
    } catch {}
  }

  if (!token) {
    console.error('❌ Error: No INSTAGRAM_ACCESS_TOKEN found in environment or local files.');
    process.exit(1);
  }

  console.log(`🔑 Current token found (${token.slice(0, 10)}...${token.slice(-6)})`);
  console.log('📡 Calling Meta Instagram token refresh endpoint...');

  const refreshUrl = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(refreshUrl);
    const data = await res.json();

    if (!res.ok || !data.access_token) {
      console.error('❌ Failed to refresh token:', data);
      process.exit(1);
    }

    const expiresIn = data.expires_in || 5184000;
    const days = Math.round(expiresIn / 86400);
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const meta = {
      accessToken: data.access_token,
      refreshedAt: new Date().toISOString(),
      expiresIn,
      expiresAt,
      username: 'capturecreatecaffeinate',
    };

    // Save metadata
    const dir = path.dirname(tokenFile);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(tokenFile, JSON.stringify(meta, null, 2), 'utf8');
    console.log(`✅ Token refreshed successfully!`);
    console.log(`   Expires in: ${expiresIn} seconds (~${days} days)`);
    console.log(`   Expires at: ${expiresAt}`);
    console.log(`   Saved to:   ${tokenFile}`);

    // Update /app/.dev.env.json if writable
    try {
      const devEnvPath = '/app/.dev.env.json';
      if (fs.existsSync(devEnvPath)) {
        const raw = fs.readFileSync(devEnvPath, 'utf8');
        const parsed = JSON.parse(raw);
        parsed.INSTAGRAM_ACCESS_TOKEN = data.access_token;
        fs.writeFileSync(devEnvPath, JSON.stringify(parsed, null, 2), 'utf8');
        console.log(`   Updated:    ${devEnvPath}`);
      }
    } catch {}

    // Verify media access with refreshed token
    console.log('📸 Verifying feed access with new token...');
    const mediaRes = await fetch(
      `https://graph.instagram.com/me/media?fields=id,caption&access_token=${encodeURIComponent(data.access_token)}&limit=5`
    );
    if (mediaRes.ok) {
      const mediaJson = await mediaRes.json();
      console.log(`✨ Feed verification passed: ${mediaJson.data?.length || 0} media items verified.`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Network error during token refresh:', err);
    process.exit(1);
  }
}

main();
