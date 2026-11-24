import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildArticleRecord,
  demoteHeadings,
  extractInstagramEmbeds,
  extractScore,
  extractSubstackGalleries,
  extractYouTubeEmbeds,
  liftPullQuotes,
  sanitizeArticleHtml,
} from '../src/substack/transform.ts';
import { mergeSnapshot } from '../src/snapshot.ts';

test('demoteHeadings shifts h1->h2, h2->h3, h3->h4, and clamps h4+', () => {
  const input = '<h1>Top</h1><h2>Sub</h2><h3>Deep</h3><h5>Stay</h5>';
  assert.equal(
    demoteHeadings(input),
    '<h2>Top</h2><h3>Sub</h3><h4>Deep</h4><h4>Stay</h4>',
  );
});

test('extractSubstackGalleries converts gallery embeds to <substack-gallery>', () => {
  const attrs = JSON.stringify({
    gallery: {
      images: [
        { src: 'https://example.com/a_1920x1080.jpeg' },
        { src: 'https://example.com/b.webp' },
      ],
    },
  }).replace(/"/g, '&quot;');
  const html = `<div class="image-gallery-embed" data-attrs="${attrs}"><div>collage</div></div>`;
  const out = extractSubstackGalleries(html);
  assert.match(out, /^<substack-gallery>/);
  assert.match(out, /width="1920" height="1080"/);
  assert.match(out, /src="https:\/\/example\.com\/b\.webp"/);
});

test('extractYouTubeEmbeds and extractInstagramEmbeds rewrite embeds cleanly', () => {
  const yt = '<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ?rel=0"></iframe>';
  assert.equal(extractYouTubeEmbeds(yt), '<youtube-embed video-id="dQw4w9WgXcQ"></youtube-embed>');

  const igAttrs = JSON.stringify({
    instagram_id: 'ABC123xyz',
    author_name: 'Andrew',
  }).replace(/"/g, '&quot;');
  const ig = `<div class="instagram-embed-wrap" data-attrs="${igAttrs}"></div>`;
  assert.equal(
    extractInstagramEmbeds(ig),
    '<instagram-embed instagram-id="ABC123xyz" author-name="Andrew"></instagram-embed>',
  );
});

test('liftPullQuotes preserves pullquote class while sanitizeArticleHtml strips disallowed markup', () => {
  const input = `
    <h1>Main</h1>
    <div class="pullquote"><p><strong>Sharp observation.</strong></p></div>
    <script>alert(1)</script>
    <p class="junk" style="color:red"><a href="https://example.org">Read</a></p>
    <p>   </p>
  `;
  const out = sanitizeArticleHtml(input);
  assert.ok(!out.includes('<script'));
  assert.ok(!out.includes('style='));
  assert.ok(out.includes('<h2>Main</h2>'));
  assert.ok(out.includes('<blockquote class="pullquote"><p><strong>Sharp observation.</strong></p></blockquote>'));
  assert.ok(out.includes('rel="noopener noreferrer"'));
  assert.ok(out.includes('target="_blank"'));
});

test('extractScore extracts valid scores and rejects out-of-range', () => {
  assert.deepEqual(extractScore('<p>Final Score: 8.5/10</p>'), { value: 8.5, best: 10 });
  assert.deepEqual(extractScore('<p>Rating 4/5</p>'), { value: 4, best: 5 });
  assert.equal(extractScore('<p>12/10 impossible</p>'), null);
});

test('buildArticleRecord supports custom TransformConfig and mergeSnapshot preserves history and editorial overrides', () => {
  const longPara =
    'This is a long opening paragraph that passes the forty character threshold cleanly and establishes the thesis of the article in detail. '.repeat(
      4,
    );
  const config = {
    categories: ['Design', 'Code'],
    categoryAliases: { Design: ['ux'] },
    timeZone: 'America/Los_Angeles',
  };

  const record1 = buildArticleRecord(
    {
      title: 'Design Systems at Scale',
      link: 'https://pub.substack.com/p/design-systems',
      guid: 'g-1',
      pubDate: '2026-10-15T18:00:00Z',
      categories: ['UX', 'Review'],
      contentEncoded: `<p>${longPara}</p><p>Score: 9/10</p>`,
    },
    new Date('2026-10-16T00:00:00Z'),
    config,
  );

  assert.ok(record1);
  assert.equal(record1.category, 'Design');
  assert.equal(record1.contentType, 'Review');
  assert.deepEqual(record1.score, { value: 9, best: 10 });
  assert.equal(record1.hasBody, true);
  assert.equal(record1.slug, 'design-systems');

  // Existing archive has an older post + an editorial override on g-1
  const existing = [
    {
      ...record1,
      firstSeen: '2026-10-15T19:00:00Z',
      lastUpdated: '2026-10-15T19:00:00Z',
      editorial: { title: 'Custom Editorial Headline' },
    },
    {
      ...record1,
      guid: 'g-old',
      slug: 'older-post',
      title: 'Older Post',
      isoDate: '2025-01-01T00:00:00Z',
    },
  ];

  // Identical incoming record later in time should NOT bump lastUpdated or count as updated
  const record1Later = buildArticleRecord(
    {
      title: 'Design Systems at Scale',
      link: 'https://pub.substack.com/p/design-systems',
      guid: 'g-1',
      pubDate: '2026-10-15T18:00:00Z',
      categories: ['UX', 'Review'],
      contentEncoded: `<p>${longPara}</p><p>Score: 9/10</p>`,
    },
    new Date('2026-10-17T00:00:00Z'),
    config,
  );
  record1Later.firstSeen = existing[0].firstSeen;

  const unchanged = mergeSnapshot(existing, [record1Later]);
  assert.equal(unchanged.merged.length, 2); // never-delete kept g-old
  assert.equal(unchanged.updated, 0);
  assert.equal(unchanged.merged[0].lastUpdated, '2026-10-15T19:00:00Z');
  assert.equal(unchanged.merged[0].editorial?.title, 'Custom Editorial Headline');
});
