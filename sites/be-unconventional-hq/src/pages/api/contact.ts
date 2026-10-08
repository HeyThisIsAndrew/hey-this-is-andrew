/**
 * Compatibility shim for the pre-Actions `/api/contact` URL (#203).
 *
 * The logic moved to `src/actions/index.ts`; this route exists only so that
 * anything external still POSTing JSON here keeps working. See the sibling
 * `subscribe.ts` for why `callAction` is the only way to reach an action from
 * server code.
 */
import type { APIRoute } from 'astro';
import { actions } from 'astro:actions';
import { respondToActionResult } from '../../lib/action-http';

// POST-only endpoint, not a page - same on-demand convention as
// live-status.json.ts. Without this the static prerenderer tries (and
// fails) to prerender a GET response for a route with no GET handler.
export const prerender = false;

export const POST: APIRoute = async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Expected a JSON body.' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return respondToActionResult(await context.callAction(actions.contact, body as any));
};
