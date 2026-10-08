import { defineType, defineField } from 'sanity';

/**
 * VideoMetrics — a small companion document per video that accumulates a
 * bounded rolling history of view counts and a computed 7-day velocity
 * (epic #34, Mandate 3 / Mandate 5).
 *
 * WHY a separate document (not fields on `video`):
 *   • Isolation — metrics churn daily; keeping it off the editorial `video`
 *     doc keeps that doc's revision history clean and the Sync Lock surface
 *     small.
 *   • Single-writer — only scripts/update-metrics.mjs touches these, so there
 *     are no write races with the YouTube sync.
 *   • Bounded — snapshots are capped (14 days) so documents never bloat.
 *
 * Velocity is derived from view-count DELTAS across snapshots — data we
 * already sync from the YouTube Data API — so v1 needs no Analytics OAuth.
 * Deterministic id `metrics-<videoId>` keeps upserts idempotent.
 *
 * These are internal/computed docs; they are not meant to be edited by hand.
 */
export default defineType({
  name: 'videoMetrics',
  title: 'Video Metrics (computed)',
  type: 'document',
  readOnly: true,
  fields: [
    defineField({
      name: 'youtubeId',
      title: 'YouTube Video ID',
      type: 'string',
      validation: (rule) => rule.required(),
    }),
    defineField({
      name: 'snapshots',
      title: 'View Snapshots',
      type: 'array',
      description: 'Bounded rolling window (≤14) of daily view counts.',
      of: [
        {
          type: 'object',
          name: 'snapshot',
          fields: [
            { name: 'date', title: 'Date', type: 'date' },
            { name: 'viewCount', title: 'View Count', type: 'number' },
          ],
          preview: { select: { title: 'date', subtitle: 'viewCount' } },
        },
      ],
    }),
    defineField({
      name: 'viewVelocity7d',
      title: 'View Velocity (7-day)',
      type: 'number',
      description: 'Views gained over the trailing 7-day window. Powers the Essential-5 shelf.',
    }),
    defineField({
      name: 'lastComputedAt',
      title: 'Last Computed At',
      type: 'datetime',
    }),
  ],
  preview: {
    select: { title: 'youtubeId', velocity: 'viewVelocity7d' },
    prepare({ title, velocity }: any) {
      return { title: `metrics: ${title}`, subtitle: `velocity ${velocity ?? 0}/7d` };
    },
  },
});
