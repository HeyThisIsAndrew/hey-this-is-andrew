/**
 * The tools this site offers an AI agent, defined once for two transports.
 *
 * ─── WHY ONE FILE FOR TWO SURFACES ────────────────────────────────────────
 * The same three tools are published twice:
 *
 *   • In the browser, over WebMCP (src/lib/webmcp.ts), for an agent working
 *     inside the reader's own session.
 *   • Over HTTP, as an MCP server (src/pages/api/mcp.ts), for an agent that
 *     never loads the page at all.
 *
 * A tool's name, description and schema are its public contract, so the two
 * must not drift: an agent that learned `get_upcoming_events` from the server
 * card and then met a differently-shaped one in the page would be right to
 * conclude the site is broken. The descriptions and schemas live here, and so
 * does every piece of logic that does not need a browser. Each transport adds
 * only what is genuinely its own: how it gets the data, and how it turns a
 * relative URL absolute.
 *
 * ─── READ ONLY, AND WHY THERE IS NO SUBSCRIBE TOOL ────────────────────────
 * All three are reads and every one is annotated `readOnlyHint`, so an agent
 * that honours it can call them without stopping to ask.
 *
 * Newsletter signup is the obvious fourth and is deliberately absent. It
 * writes a stranger's email address into KV, which is a consequential action
 * taken against a third party, and not something to do on one tool call with
 * no human in the loop. The failure mode is not an agent misreading a result,
 * it is a real person receiving mail they never asked for, from us.
 *
 * There is a mechanical objection pointing the same way: the action is
 * Turnstile-gated (src/actions/index.ts) and a tool call carries no challenge
 * token, so making it work would mean driving the invisible widget from a tool
 * handler, which is a bot check being satisfied by a bot. If this is ever
 * reconsidered it needs a confirmation step, not just a schema.
 */
import { getEventStatus } from './events.ts';
import type { SearchEntry } from './search-index.ts';

/** Tool metadata, in the shape both MCP and WebMCP accept. */
export interface AgentToolSchema {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: true;
    /**
     * Titles and tags reach us from YouTube and Substack, so they are written
     * by people outside this site. An agent must read them as data and never
     * as instructions. This is the hint that says so.
     */
    untrustedContentHint: true;
  };
}

export const SEARCH_TOOL = 'search_beunconventionalhq';
export const EVENTS_TOOL = 'get_upcoming_events';
export const LIVE_TOOL = 'get_live_status';

export const AGENT_TOOLS: AgentToolSchema[] = [
  {
    name: SEARCH_TOOL,
    title: 'Search BE Unconventional HQ',
    description:
      'Search everything published on BE Unconventional HQ: videos, articles, ' +
      'events and brand hubs. Returns titles with absolute URLs. Use this to ' +
      'answer questions about what the site covers, or to find the page for a ' +
      'specific topic, show, film, game or event.',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'What to search for. Free text, matched fuzzily against titles and tags.',
        },
        type: {
          type: 'string',
          enum: ['video', 'article', 'event', 'hub', 'page'],
          description: 'Optional. Restrict results to one kind of content.',
        },
        limit: {
          type: 'integer',
          description: 'Maximum results to return. Defaults to 10, capped at 50.',
        },
      },
      required: ['query'],
    },
  },
  {
    name: EVENTS_TOOL,
    title: 'Upcoming events',
    description:
      'List the events BE Unconventional HQ is covering that have not finished ' +
      'yet, soonest first, with their dates and status. Use this for questions ' +
      'about where the channel will be, or what is coming up.',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'integer',
          description: 'Maximum events to return. Defaults to 10, capped at 50.',
        },
      },
    },
  },
  {
    name: LIVE_TOOL,
    title: 'Live right now?',
    description:
      'Check whether BE Unconventional HQ is streaming live at this moment, and ' +
      'on which platform. This is the only tool here whose answer changes minute ' +
      'to minute, so prefer it over anything cached when the question is about now.',
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    inputSchema: { type: 'object', properties: {} },
  },
];

/** Clamp an agent-supplied limit into something sane. An agent can send anything. */
export function clampLimit(value: unknown, fallback: number, max: number): number {
  const n = typeof value === 'number' ? Math.floor(value) : Number.NaN;
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, max);
}

/**
 * Events that have not finished, soonest first.
 *
 * Pure, and exported so `scripts/agent-tools.test.mjs` can pin it against
 * fixed dates. The live content store usually holds no upcoming events at all,
 * so an end-to-end assertion on it runs against an empty array and proves
 * nothing about the filter.
 *
 * Status comes from src/lib/events.ts, never from `new Date(startDate)`.
 * Parsing "YYYY-MM-DD" as a Date reads it as UTC midnight, which is the
 * previous day anywhere west of Greenwich, so an event would drop off this
 * list a day early for the audience it is aimed at. Hard rule 1 in CLAUDE.md.
 */
export function selectUpcomingEvents(entries: SearchEntry[], now: Date = new Date(), limit = 10) {
  return entries
    .filter((e) => e.type === 'event' && typeof e.date === 'string')
    .map((e) => ({
      entry: e,
      /* `status` carries the editorial override. Drop it and a CANCELLED event
         whose date is still ahead reads as `upcoming`, and we send a reader to
         something that is not happening. */
      status: getEventStatus(
        { startDate: e.date, endDate: e.endDate ?? undefined, status: e.status },
        now,
      ),
    }))
    .filter(({ status }) => status !== 'completed' && status !== 'cancelled')
    .sort((a, b) => String(a.entry.date).localeCompare(String(b.entry.date)))
    .slice(0, limit)
    .map(({ entry, status }) => ({
      title: entry.title,
      status,
      startDate: entry.date,
      endDate: entry.endDate ?? undefined,
      url: entry.url,
    }));
}

/**
 * Rank entries against a query.
 *
 * Uses the SAME Fuse configuration as the command palette
 * (src/components/CommandPalette.astro). An agent and a reader typing the same
 * words should get the same ranking; two relevance implementations would drift
 * apart and nobody would notice until someone compared them.
 *
 * Fuse is imported dynamically so the browser only pays for it when an agent
 * actually searches, which is also how the palette loads it.
 */
export async function rankEntries(
  entries: SearchEntry[],
  query: string,
  type?: string,
  limit = 10,
) {
  const pool = type ? entries.filter((e) => e.type === type) : entries;
  const { default: Fuse } = await import('fuse.js');
  const fuse = new Fuse(pool, {
    keys: [
      { name: 'title', weight: 2 },
      { name: 'tags', weight: 1 },
      { name: 'type', weight: 0.5 },
    ],
    threshold: 0.4,
    ignoreLocation: true,
  });

  return fuse
    .search(query)
    .slice(0, limit)
    .map(({ item }) => ({
      title: item.title,
      type: item.type,
      url: item.url,
      date: item.date ?? undefined,
      tags: item.tags?.length ? item.tags : undefined,
    }));
}

/**
 * MCP's result envelope: a list of content blocks. JSON inside a text block is
 * the shape agents handle most reliably, and it keeps the payload legible in a
 * transcript.
 */
export function textResult(payload: unknown) {
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
}
