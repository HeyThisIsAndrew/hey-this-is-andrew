/**
 * Compatibility shim for the pre-Actions `/api/subscribe` URL (#203).
 *
 * The logic moved to `src/actions/index.ts`; this route exists only so that
 * anything external still POSTing JSON here keeps working. Nothing on this
 * site posts to it any more — `NewsletterForm` calls the action directly.
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

  /*
    `callAction` is the ONLY supported way to invoke an action from server
    code: the action's `this` has to be an action API context, and calling
    `actions.subscribe(body)` bare throws `ActionCalledFromServerError`. It
    returns `{ data, error }` rather than throwing, and any cookie the handler
    sets on `context` rides out on the response below.
  */
  return respondToActionResult(await context.callAction(actions.subscribe, body as any));
};
