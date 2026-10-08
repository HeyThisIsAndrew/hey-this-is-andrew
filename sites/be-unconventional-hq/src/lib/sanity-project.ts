/**
 * WHICH SANITY PROJECT THIS SITE TALKS TO.
 *
 * Its own module, with no imports of its own, because two very different
 * callers need it: the site (through local-content.ts, which reads images
 * back out) and standalone `node` scripts (which upload them in). Anything
 * that pulls in videos.json cannot be imported from bare Node without an
 * import attribute, so the constant lives apart from all of that.
 *
 * A wrong project id here is not a loud failure. The token authenticates
 * perfectly and every single upload is refused with "Unauthorized - Session
 * does not match project host", which reads like a credentials problem and
 * is not one. scripts/sanity-project.test.mjs keeps every copy in the repo
 * agreeing with this one.
 */
export const SANITY_PROJECT = { projectId: '38nhxsib', dataset: 'production' };
