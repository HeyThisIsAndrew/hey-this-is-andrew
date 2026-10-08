export const prerender = false;

import type { APIRoute } from 'astro';
// @ts-ignore
import { env as workerEnv } from 'cloudflare:workers';

export const GET: APIRoute = ({ request }) => {
  const url = new URL(request.url);
  const mode = url.searchParams.get('hub.mode');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && challenge) {
    return new Response(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }

  return new Response('Invalid request', { status: 400 });
};

export const POST: APIRoute = async ({ request }) => {
  const env = (workerEnv ?? {}) as Record<string, string | undefined>;
  const websubSecret = env.WEBSUB_SECRET ?? import.meta.env.WEBSUB_SECRET;
  const githubToken = env.GITHUB_DISPATCH_TOKEN ?? import.meta.env.GITHUB_DISPATCH_TOKEN;

  if (!websubSecret || !githubToken) {
    console.error('Missing required environment variables');
    return new Response('Server configuration error', { status: 500 });
  }

  const signature = request.headers.get('x-hub-signature');
  if (!signature) {
    return new Response('Missing signature', { status: 403 });
  }

  const bodyBuffer = await request.arrayBuffer();

  // Compute HMAC-SHA1
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(websubSecret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, bodyBuffer);
  const signatureArray = Array.from(new Uint8Array(signatureBuffer));
  const signatureHex = signatureArray.map(b => b.toString(16).padStart(2, '0')).join('');
  const expectedSignature = `sha1=${signatureHex}`;

  if (signature !== expectedSignature) {
    console.error('Signature mismatch');
    return new Response('Invalid signature', { status: 403 });
  }

  const textBody = new TextDecoder().decode(bodyBuffer);

  // Check if body contains <yt:videoId> (new/updated video) or <at:deleted-entry (deleted video)
  if (!textBody.includes('<yt:videoId>') && !textBody.includes('<at:deleted-entry')) {
    console.log('Valid signature, but no video update or deletion found. Ignoring.');
    // Return 200 so the hub doesn't retry this irrelevant ping
    return new Response('OK', { status: 200 });
  }

  // Trigger GitHub Action
  try {
    const githubResponse = await fetch(
      'https://api.github.com/repos/HeyThisIsAndrew/BeUnconventionalHQ/actions/workflows/sync-youtube.yml/dispatches',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${githubToken}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'BeUnconventionalHQ-Worker',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ref: 'main' }),
      }
    );

    if (!githubResponse.ok) {
      const errText = await githubResponse.text();
      console.error('GitHub API error:', githubResponse.status, errText);
      // Return 500 to tell YouTube's hub to retry this webhook later! (Self-healing)
      return new Response('GitHub API failed to trigger', { status: 500 });
    }
  } catch (error) {
    console.error('Failed to trigger GitHub Action:', error);
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
};
