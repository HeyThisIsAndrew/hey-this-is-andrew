import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYouTubeAtomFeed, mergeVideos, probeThumbnailVariants } from './sync-youtube.mjs';

test('parseYouTubeAtomFeed correctly extracts long-form video entries', () => {
  const sampleXml = `<?xml version="1.0" encoding="UTF-8"?>
  <feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
   <entry>
    <id>yt:video:uyTtp7sUYGU</id>
    <yt:videoId>uyTtp7sUYGU</yt:videoId>
    <yt:channelId>UCNn5badDO7pbspeS6noInCw</yt:channelId>
    <title>One Data Set, Fewer Hallucinations: My Day at Google HQ</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=uyTtp7sUYGU"/>
    <published>2026-11-26T05:44:09+00:00</published>
    <media:group>
     <media:title>One Data Set, Fewer Hallucinations: My Day at Google HQ</media:title>
     <media:thumbnail url="https://i2.ytimg.com/vi/uyTtp7sUYGU/hqdefault.jpg" width="480" height="360"/>
     <media:description>Walked out of Google in Playa Vista &amp; loved it.</media:description>
    </media:group>
   </entry>
  </feed>`;

  const items = parseYouTubeAtomFeed(sampleXml);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'uyTtp7sUYGU');
  assert.equal(items[0].title, 'One Data Set, Fewer Hallucinations: My Day at Google HQ');
  assert.equal(items[0].published_at, '2026-11-26T05:44:09+00:00');
  assert.equal(items[0].url, 'https://www.youtube.com/watch?v=uyTtp7sUYGU');
  assert.equal(items[0].thumbnail, 'https://i2.ytimg.com/vi/uyTtp7sUYGU/hqdefault.jpg');
  assert.equal(items[0].description, 'Walked out of Google in Playa Vista & loved it.');
});

test('mergeVideos preserves existing videos and sorts newest first', () => {
  const existing = [
    { id: 'old1', title: 'Old Video', published_at: '2026-08-01T00:00:00Z' },
    { id: 'mid1', title: 'Mid Video', published_at: '2026-09-01T00:00:00Z' },
  ];
  const newVids = [
    { id: 'new1', title: 'Newest Video', published_at: '2026-11-26T05:44:09Z' },
    { id: 'mid1', title: 'Mid Video Updated', published_at: '2026-09-01T00:00:00Z', thumbnail: 'https://img.jpg' },
  ];

  const merged = mergeVideos(existing, newVids);
  assert.equal(merged.length, 3);
  assert.equal(merged[0].id, 'new1');
  assert.equal(merged[1].id, 'mid1');
  assert.equal(merged[1].thumbnail, 'https://img.jpg');
  assert.equal(merged[2].id, 'old1');
});

test('probeThumbnailVariants handles missing maxres and picks valid sizes', async () => {
  const fakeFetch = async (url) => {
    if (url.includes('maxresdefault')) {
      return { ok: true, headers: new Map([['content-length', '1097']]) }; // placeholder
    }
    if (url.includes('sddefault')) {
      return { ok: true, headers: new Map([['content-length', '45000']]) }; // real HD
    }
    return { ok: true, headers: new Map([['content-length', '25000']]) };
  };

  const res = await probeThumbnailVariants('testId', fakeFetch);
  assert.equal(res.thumbnail, 'https://i.ytimg.com/vi/testId/sddefault.jpg');
  assert.ok(res.imageSrcset.includes('sddefault.jpg 640w'));
  assert.ok(!res.imageSrcset.includes('maxresdefault.jpg'));
});
