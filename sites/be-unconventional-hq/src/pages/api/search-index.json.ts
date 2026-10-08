import { buildSearchIndex } from '../../lib/search-index';

export const prerender = true;

/**
 * The command palette's index.
 *
 * The builder lives in `src/lib/search-index.ts` because the MCP endpoint at
 * `/api/mcp` needs the same rows on the server, where fetching this URL to get
 * data already in memory would be silly. See that file for the full rationale.
 */
export async function GET() {
  return new Response(JSON.stringify(await buildSearchIndex()), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
