/**
 * Turning an Astro Action result back into a plain JSON HTTP response.
 *
 * Used by the `/api/subscribe` and `/api/contact` compatibility shims, which
 * have to keep answering in the shape their old hand-written selves did:
 * `{ success, message }` on 200, `{ error }` with a real status otherwise.
 *
 * ─── NO `astro:actions` IMPORT, ON PURPOSE ────────────────────────────────
 * The two checks below duplicate `isActionError` / `isInputError` rather than
 * importing them, so this module stays importable by plain `node` and
 * `scripts/action-http.test.mjs` can exercise it offline. Both are documented
 * discriminants on the serialized error (`type`), not internals.
 */

/** The `{ data, error }` pair `Astro.callAction()` resolves with. */
export interface ActionResultLike {
  data?: unknown;
  error?: unknown;
}

interface ActionErrorLike {
  type?: string;
  code?: string;
  status?: number;
  message?: string;
  /** Present only on an input error: field name → messages. */
  fields?: Record<string, string[] | undefined>;
}

/** A Zod validation failure, as opposed to one the handler threw itself. */
function isInputError(error: ActionErrorLike): boolean {
  return error?.type === 'AstroActionInputError';
}

/**
 * The message a visitor should actually read.
 *
 * An `ActionInputError` carries `message` = `Failed to validate: [ …raw JSON
 * issue objects… ]`. Rendering that straight into the subscribe band puts a
 * JSON dump where "Please enter a valid email address." belongs, so input
 * errors are read out of `fields` instead — those are the per-field messages
 * the Zod schema was written with.
 */
export function actionErrorMessage(
  error: ActionErrorLike | null | undefined,
  fallback = 'Something went wrong. Please try again.',
): string {
  if (!error) return fallback;

  if (isInputError(error)) {
    const first = Object.values(error.fields ?? {})
      .flatMap((messages) => messages ?? [])
      .find((message) => typeof message === 'string' && message.length > 0);
    return first ?? fallback;
  }

  /*
    A 500 is ours, not theirs. The handler's own 500 messages are written for
    visitors ("Failed to send email…"), but an UNEXPECTED throw arrives here
    with whatever the exception said — a stack frame, a binding name, a URL
    with a token in it. Never relay that.
  */
  if ((error.status ?? 500) >= 500 && error.code === 'INTERNAL_SERVER_ERROR') {
    return error.message && error.type === 'AstroActionError'
      ? error.message
      : 'An unexpected error occurred.';
  }

  return error.message || fallback;
}

/** The status to answer with, defaulting to 500 for anything unrecognised. */
export function actionErrorStatus(error: ActionErrorLike | null | undefined): number {
  const status = error?.status;
  return typeof status === 'number' && status >= 400 && status <= 599 ? status : 500;
}

/**
 * `{ data, error }` → `Response`.
 *
 * Preserves the action's own status rather than flattening every failure to
 * 400: a Resend outage stays a 500, a bad token stays a 400, and an unreachable
 * siteverify stays a 503, so a caller's retry logic still means something.
 */
export function respondToActionResult(result: ActionResultLike): Response {
  const error = result?.error as ActionErrorLike | undefined;

  if (error) {
    return new Response(JSON.stringify({ error: actionErrorMessage(error) }), {
      status: actionErrorStatus(error),
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify(result?.data ?? {}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
