import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * YouTube WebSub webhook endpoint for real-time video upload notifications.
 *
 * GET: Handles WebSub hub handshake / challenge verification (echoes hub.challenge).
 * POST: Handles video publish notifications and dispatches repository_dispatch
 *       event 'content-published' if GITHUB_DISPATCH_TOKEN is configured.
 */
export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const challenge = url.searchParams.get('hub.challenge');
  const mode = url.searchParams.get('hub.mode');

  if (mode === 'subscribe' || mode === 'unsubscribe') {
    if (challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
};

export const POST: APIRoute = async ({ request }) => {
  try {
    await request.text();

    // Trigger repository dispatch if token exists in environment
    const dispatchToken = typeof process !== 'undefined' ? process.env?.GITHUB_DISPATCH_TOKEN : undefined;
    if (dispatchToken) {
      const dispatchUrl = 'https://api.github.com/repos/heythisisandrew/hey-this-is-andrew/dispatches';
      await fetch(dispatchUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${dispatchToken}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'HeyThisIsAndrew-WebSub/1.0',
        },
        body: JSON.stringify({
          event_type: 'content-published',
          client_payload: {
            source: 'youtube-websub',
            timestamp: new Date().toISOString(),
          },
        }),
      });
    }

    return new Response('Notification received', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err: any) {
    return new Response(`Error: ${err?.message || 'Unknown'}`, {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
};
