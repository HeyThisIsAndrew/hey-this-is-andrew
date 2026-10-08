import http from 'http';
import url from 'url';
import dotenv from 'dotenv';

dotenv.config();

const { YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET } = process.env;

if (!YOUTUBE_CLIENT_ID || !YOUTUBE_CLIENT_SECRET) {
  console.error("Missing YOUTUBE_CLIENT_ID or YOUTUBE_CLIENT_SECRET in .env");
  process.exit(1);
}

const REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const SCOPES = 'https://www.googleapis.com/auth/yt-analytics.readonly';

const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${YOUTUBE_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code&scope=${encodeURIComponent(SCOPES)}&access_type=offline&prompt=consent`;

import { exec } from 'child_process';

console.log('================================================================================');
console.log('Action Required: Authorize YouTube Analytics');
console.log('================================================================================\n');
console.log('Opening your default browser to authorize the application...\n');
console.log('If the browser does not open automatically, copy and paste this URL:\n');
console.log(authUrl);
console.log('\nWaiting for callback on port 3000...\n');

// Automatically open the URL on Mac
exec(`open "${authUrl}"`);

const server = http.createServer(async (req, res) => {
  const reqUrl = url.parse(req.url, true);

  if (reqUrl.pathname === '/oauth2callback') {
    const code = reqUrl.query.code;

    if (!code) {
      res.writeHead(400);
      res.end('Failed to get authorization code. Check the console.');
      console.error('Error: No authorization code returned.');
      process.exit(1);
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: YOUTUBE_CLIENT_ID,
          client_secret: YOUTUBE_CLIENT_SECRET,
          code,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        throw new Error(`Token exchange failed: ${JSON.stringify(tokenData)}`);
      }

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>Success!</h1><p>You can close this window and check your terminal for the new token.</p>');

      console.log('================================================================================');
      console.log('🎉 SUCCESS! NEW REFRESH TOKEN GENERATED');
      console.log('================================================================================\n');
      
      if (tokenData.refresh_token) {
        console.log(`YOUTUBE_REFRESH_TOKEN="${tokenData.refresh_token}"\n`);
        console.log('NEXT STEPS:');
        console.log('1. Copy the token above.');
        console.log('2. Paste it into your local .env file.');
        console.log('3. Paste it into GitHub Secrets (Settings > Secrets and variables > Actions).');
      } else {
        console.warn('⚠️ No refresh token returned. This can happen if you previously authorized the app and did not revoke it.');
        console.log('If you need a new refresh token, go to https://myaccount.google.com/permissions, remove the app, and run this script again.');
      }
      console.log('================================================================================');
      
      server.close();
      process.exit(0);
    } catch (err) {
      console.error('Error exchanging code for token:', err.message);
      res.writeHead(500);
      res.end('Failed to exchange code for token. Check the console.');
      server.close();
      process.exit(1);
    }
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  // Server listening
});
