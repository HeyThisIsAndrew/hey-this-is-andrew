/**
 * The timezone every published date is displayed in.
 *
 * ─── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * Content dates used to be formatted with `timeZone: 'UTC'`. That was chosen
 * for a good reason — a static build must not depend on the build machine's
 * clock, or the same commit renders different dates on different runners —
 * but UTC solves determinism by picking a timezone the channel does not live
 * in, and for evening uploads that is simply the wrong day.
 *
 * Measured against real records in src/data/videos.json:
 *
 *   "Marvel Just Announced EVERYTHING for SDCC 2026"
 *     stored   2026-07-10T01:31:16Z
 *     actual   9 July, 6:31pm Pacific   <- when it was published
 *     shown    "July 10, 2026"          <- what the site said
 *
 * Anything posted after ~5pm Pacific was dated a day into the future. That is
 * most of a channel's evening uploads.
 *
 * A NAMED timezone keeps the determinism that mattered: it is fixed data, not
 * the runner's locale, so every build produces the same string. It just picks
 * the right fixed timezone instead of an arbitrary one. DST is handled by the
 * IANA database rather than a hardcoded offset.
 *
 * NOTE this is display only. It does not touch calendar-date strings
 * (`YYYY-MM-DD` on events), which are timezone-free by design and must keep
 * going through src/lib/events.ts — see hard rule 1 in CLAUDE.md.
 *
 * TO CHANGE WHERE THE CHANNEL PUBLISHES FROM: edit this one value.
 */
export const PUBLISH_TIME_ZONE = 'America/Los_Angeles';
