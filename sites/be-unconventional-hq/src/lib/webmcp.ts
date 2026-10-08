/**
 * WebMCP — the browser half of the agent tools (#192, task 3).
 *
 * Hands the browser a set of callable tools so an agent working inside the
 * reader's session can use the site directly instead of scraping the DOM. The
 * tools themselves are defined in src/lib/agent-tools.ts and shared with the
 * HTTP MCP endpoint at `/api/mcp`; this file is only the browser adapter.
 *
 * ─── THE API IS NOT WHAT #192 SAYS ────────────────────────────────────────
 * The ticket asks for `navigator.modelContext.provideContext()`. Every part of
 * that has since changed, which is why this file does not match it:
 *
 *   • `provideContext()` was REMOVED from the spec on 2026-03-05. Tools are
 *     registered one at a time with `registerTool()`.
 *   • `unregisterTool()` was removed in April 2026 in favour of passing an
 *     AbortSignal to `registerTool(tool, { signal })`.
 *   • The object hangs off `document`. (`navigator.modelContext` is the same
 *     object in Chrome 150, so the old spelling still resolves, but `document`
 *     is the spec surface.)
 *
 * Read directly off Chrome 150.0.7871.24, whose `ModelContext` prototype is
 * exactly `ontoolchange, executeTool, getTools, registerTool`, and
 * cross-checked against `@mcp-b/webmcp-types@5.1.0`. `scripts/e2e-webmcp.test.mjs`
 * asserts the two removed methods stay absent, so nobody reintroduces a call
 * to them from a stale document.
 *
 * ─── COST WHEN NOBODY IS LOOKING ──────────────────────────────────────────
 * `document.modelContext` ships only in Chrome behind a flag, so this has to
 * be free for everyone else. Layout.astro inlines the feature test and imports
 * this module dynamically, so a browser without the API never downloads it at
 * all. Nothing is fetched until an agent calls a tool.
 */
import {
  AGENT_TOOLS,
  EVENTS_TOOL,
  LIVE_TOOL,
  SEARCH_TOOL,
  clampLimit,
  rankEntries,
  selectUpcomingEvents,
  textResult,
} from './agent-tools.ts';
import type { SearchEntry } from './search-index.ts';

/* ─── The slice of the WebMCP surface this file uses ─────────────────────── */

interface WebMcpTool {
  name: string;
  title?: string;
  description: string;
  inputSchema?: Record<string, unknown>;
  annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
  execute: (input: any) => Promise<unknown> | unknown;
}

interface ModelContext {
  registerTool: (
    tool: WebMcpTool,
    options?: { signal?: AbortSignal; exposedTo?: string[] },
  ) => Promise<void>;
}

declare global {
  interface Document {
    modelContext?: ModelContext;
  }
}

const SEARCH_INDEX_URL = '/api/search-index.json';
const LIVE_STATUS_URL = '/api/live-status.json';

let indexPromise: Promise<SearchEntry[]> | null = null;

/**
 * The search index, fetched on first use and reused after.
 *
 * A failed fetch nulls the promise so a later call retries rather than caching
 * the failure for the life of the page.
 */
function loadIndex(): Promise<SearchEntry[]> {
  if (!indexPromise) {
    indexPromise = fetch(SEARCH_INDEX_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`search index responded ${res.status}`);
        return res.json();
      })
      .then((data) => (Array.isArray(data) ? (data as SearchEntry[]) : []))
      .catch((error) => {
        indexPromise = null;
        throw error;
      });
  }
  return indexPromise;
}

/** An absolute URL, so an agent can follow a result without guessing the host. */
function absolute(url: string): string {
  try {
    return new URL(url, window.location.origin).toString();
  } catch {
    return url;
  }
}

/** The shared schema for `name`, plus the browser's way of fulfilling it. */
function browserTool(name: string, execute: WebMcpTool['execute']): WebMcpTool {
  const schema = AGENT_TOOLS.find((t) => t.name === name);
  if (!schema) throw new Error(`no schema for tool ${name}`);
  return { ...schema, execute };
}

const TOOLS: WebMcpTool[] = [
  browserTool(SEARCH_TOOL, async (input: { query?: string; type?: string; limit?: number }) => {
    const query = typeof input?.query === 'string' ? input.query.trim() : '';
    if (!query) return textResult({ error: 'A non-empty `query` is required.', results: [] });

    const results = (
      await rankEntries(await loadIndex(), query, input?.type, clampLimit(input?.limit, 10, 50))
    ).map((r) => ({ ...r, url: absolute(r.url) }));

    return textResult({ query, count: results.length, results });
  }),

  browserTool(EVENTS_TOOL, async (input: { limit?: number }) => {
    const events = selectUpcomingEvents(
      await loadIndex(),
      new Date(),
      clampLimit(input?.limit, 10, 50),
    ).map((e) => ({ ...e, url: absolute(e.url) }));

    return textResult({ count: events.length, events });
  }),

  browserTool(LIVE_TOOL, async () => {
    /*
      Quota-gated: YouTube's search.list costs 100 units of a 10,000/day budget,
      and the CDN cache in front of this endpoint is what keeps the origin under
      roughly 96 calls a day. Agent traffic lands on that same cache, so it
      cannot spend the quota faster than readers can. Do not add a cache-buster.
    */
    try {
      const res = await fetch(LIVE_STATUS_URL);
      if (!res.ok) throw new Error(`live status responded ${res.status}`);
      const data = await res.json();
      return textResult({
        isLive: Boolean(data?.isLive),
        streams: Array.isArray(data?.streams)
          ? data.streams.map((s: any) => ({ platform: s?.platform, title: s?.title, url: s?.url }))
          : [],
      });
    } catch {
      /* Dormant is the honest answer when we cannot tell, and it matches what
         the on-page billboard shows in the same situation. */
      return textResult({ isLive: false, streams: [], note: 'Live status is unavailable right now.' });
    }
  }),
];

/**
 * Register the tools, once per document.
 *
 * ClientRouter swaps the body on navigation but the document — and therefore
 * `document.modelContext` — survives, so unlike the Turnstile widgets these
 * must NOT be re-registered on `astro:page-load`. Doing so would either throw
 * on the duplicate name or leave an agent looking at three copies of each tool.
 */
export function initWebMcp(): void {
  if (typeof document === 'undefined') return;

  const modelContext = document.modelContext;
  if (!modelContext || typeof modelContext.registerTool !== 'function') return;

  const w = window as any;
  if (w.__hqWebMcpRegistered) return;
  w.__hqWebMcpRegistered = true;

  for (const tool of TOOLS) {
    /* Registration is per tool and can reject on its own (a duplicate name, a
       schema the browser rejects). One bad tool must not take the others with
       it, so each is caught separately.

       The warning is a dev-time aid only: the build drops every `console.*`
       call, so this is silent in production. Catching still matters there — it
       is what stops one rejected registration becoming an unhandled rejection
       and taking the other two tools with it. */
    Promise.resolve(modelContext.registerTool(tool)).catch((error) => {
      console.warn(`[webmcp] could not register "${tool.name}":`, error);
    });
  }
}
