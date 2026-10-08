export const prerender = false;

export async function GET({ request }) {
  const url = new URL(request.url);
  const targetUrl = url.searchParams.get('url');

  if (!targetUrl) {
    return new Response('Missing target url', { status: 400 });
  }

  // Basic validation to prevent arbitrary proxying
  try {
    const parsedTarget = new URL(targetUrl);
    // Instagram CDN images only (card-images.ts), e.g.
    // scontent-lax3-1.cdninstagram.com. This used to relay the GTM, GA, Meta,
    // TikTok and Clarity scripts for Partytown too. Partytown is gone (GTM
    // comes from Cloudflare's tag gateway, see Layout.astro), and the relay
    // was actively harmful: it kept serving a GTM container Google had
    // already replaced. Do not route tag scripts through here again.
    const isAllowedHost = parsedTarget.hostname.endsWith('.cdninstagram.com');
    
    if (parsedTarget.protocol !== 'https:' || !isAllowedHost) {
      return new Response('Forbidden proxy target', { status: 403 });
    }
  } catch (e) {
    return new Response('Invalid target url', { status: 400 });
  }

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': request.headers.get('User-Agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    });
    
    if (!response.ok) {
      return new Response('Proxy target returned error', { status: response.status });
    }
    
    // We proxy both scripts AND images now, so we must stream the raw body
    // instead of calling .text() which corrupts binary data.
    const origin = url.origin; // Restrict CORS to our own origin
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': response.headers.get('content-type') || 'application/javascript',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': origin,
        'X-Content-Type-Options': 'nosniff',
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
      }
    });
  } catch (error) {
    return new Response('Error proxying script', { status: 500 });
  }
}
