import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildToc,
  createArticleStore,
  labelImageLinks,
  lookupRendition,
  parseImageDimensions,
  rewriteBodyImages,
  stripCoverImageFromBody,
} from '../src/index.ts';

test('stripCoverImageFromBody removes matching figure by asset fingerprint', () => {
  const cover =
    'https://substackcdn.com/image/fetch/$s_!abc!,f_auto/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fphoto1_1920x1080.jpeg';
  const body =
    '<figure><img src="https://substackcdn.com/image/fetch/$s_!abc!,w_1456,c_limit/https%3A%2F%2Fsubstack-post-media.s3.amazonaws.com%2Fpublic%2Fimages%2Fphoto1_1920x1080.jpeg"><figcaption>Hero</figcaption></figure><p>Keep me.</p>';

  assert.equal(stripCoverImageFromBody(body, cover), '<p>Keep me.</p>');
});

test('buildToc normalizes heading levels from h2 and deduplicates IDs', () => {
  const onlyH4 = '<h4>First</h4><h4>First</h4>';
  const res1 = buildToc(onlyH4);
  assert.deepEqual(res1.entries, [
    { id: 'first', text: 'First', level: 2 },
    { id: 'first-2', text: 'First', level: 2 },
  ]);
  assert.equal(res1.html, '<h2 id="first">First</h2><h2 id="first-2">First</h2>');

  const skipped = '<h2>Top</h2><h4>Nested</h4>';
  const res2 = buildToc(skipped);
  assert.deepEqual(res2.entries, [
    { id: 'top', text: 'Top', level: 2 },
    { id: 'nested', text: 'Nested', level: 3 },
  ]);
  assert.equal(res2.html, '<h2 id="top">Top</h2><h3 id="nested">Nested</h3>');
});

test('lookupRendition, rewriteBodyImages, parseImageDimensions, and labelImageLinks', () => {
  const rawUrl = 'https://substack-post-media.s3.amazonaws.com/public/images/hero_1600x900.png';
  const cdnUrl = 'https://substackcdn.com/image/fetch/w_1456/https%3A%2F%2Fexample.com%2Fx_800x600.jpg';
  const manifest = {
    [rawUrl]: {
      src: '/article-images/abc-720.webp',
      srcset: '/article-images/abc-480.webp 480w, /article-images/abc-720.webp 720w',
    },
    [cdnUrl]: {
      src: '/should-never-hit',
      srcset: '',
    },
  };

  assert.deepEqual(lookupRendition(manifest, rawUrl), {
    src: '/article-images/abc-720.webp',
    srcset: '/article-images/abc-480.webp 480w, /article-images/abc-720.webp 720w',
  });
  assert.equal(lookupRendition(manifest, cdnUrl), null);

  const body = `<a href="${rawUrl}" target="_blank"><img src="${rawUrl}"></a>`;
  const rewritten = labelImageLinks(rewriteBodyImages(body, (u) => lookupRendition(manifest, u)));
  assert.match(rewritten, /<button type="button" class="article-image-zoom" data-lightbox-image/);
  assert.match(rewritten, /src="\/article-images\/abc-720\.webp"/);
  assert.match(rewritten, /loading="lazy"/);
  assert.match(rewritten, /decoding="async"/);
  assert.match(rewritten, /alt=""/);

  assert.deepEqual(parseImageDimensions(rawUrl), { width: 1600, height: 900 });
  assert.deepEqual(parseImageDimensions(cdnUrl), { width: 800, height: 600 });
  assert.equal(parseImageDimensions('https://example.com/no-dims.jpg'), null);
});

test('createArticleStore routes, editorial overrides, categories, and adjacency', () => {
  const store = createArticleStore(
    [
      {
        guid: '1',
        slug: 'newest',
        title: 'Newest',
        link: 'https://pub.substack.com/p/newest',
        date: 'Oct 3, 2026',
        isoDate: '2026-10-03T00:00:00Z',
        excerpt: 'Short',
        preview: ['Para 1', 'Para 2'],
        image: '',
        category: 'Notes',
        tags: [],
        bodyHtml: '<p>Body</p>',
        hasBody: true,
      },
      {
        guid: '2',
        slug: 'external-stub',
        title: 'Stub',
        link: 'https://pub.substack.com/p/external-stub',
        date: 'Oct 2, 2026',
        isoDate: '2026-10-02T00:00:00Z',
        excerpt: 'Stub excerpt',
        preview: [],
        image: '',
        category: 'Essays',
        tags: [],
        bodyHtml: '',
        hasBody: false,
      },
      {
        guid: '3',
        slug: 'hidden-post',
        title: 'Hidden',
        link: 'https://pub.substack.com/p/hidden',
        date: 'Oct 4, 2026',
        isoDate: '2026-10-04T00:00:00Z',
        excerpt: '',
        preview: [],
        image: '',
        category: 'Essays',
        tags: [],
        bodyHtml: '<p>Hidden</p>',
        hasBody: true,
        editorial: { hidden: true },
      },
    ],
    { basePath: '/journal', categories: ['Essays', 'Notes'] },
  );

  assert.equal(store.getAllArticles().length, 2);
  assert.equal(store.getPublishedArticles().length, 1);
  assert.deepEqual(store.getArticleCategories(), ['Essays', 'Notes']);
  assert.equal(store.topicPath('Essays'), '/journal/topic/essays');

  const [first, second] = store.getArticleFeedItems();
  assert.equal(first.link, '/journal/newest');
  assert.equal(first.isExternal, false);
  assert.equal(second.link, 'https://pub.substack.com/p/external-stub');
  assert.equal(second.isExternal, true);
  assert.deepEqual(store.articlePreview(second), ['Stub excerpt']);
});
