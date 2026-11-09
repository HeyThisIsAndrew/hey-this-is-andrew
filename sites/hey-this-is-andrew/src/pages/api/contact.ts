import type { APIRoute } from 'astro';

export const prerender = process.env.CF_WORKERS === '1' ? false : true;

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      error: 'not_configured',
      message: 'Contact endpoint is not live yet.',
    }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      error: 'not_configured',
      message: 'Contact endpoint is not live yet.',
    }),
    {
      status: 501,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};
