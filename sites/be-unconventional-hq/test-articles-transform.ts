import { extractSubstackGalleries, extractYouTubeEmbeds } from './src/lib/articles-transform.js';

console.log('Testing extractSubstackGalleries...');

let failed = false;

// 1. Dynamic CDNs & Missing Extensions
{
  const html = `<div class="image-gallery-embed" data-attrs="{&quot;images&quot;:[{&quot;url&quot;:&quot;https://bucketeer-123.s3.amazonaws.com/public/images/abc-def_100x200&quot;}]}"></div>`;
  const result = extractSubstackGalleries(html);
  if (!result.includes('https://bucketeer-123.s3.amazonaws.com/public/images/abc-def_100x200')) {
    console.error('❌ BUG: Dynamic CDN URL should be extracted');
    failed = true;
  }
  if (!result.includes('width="100"')) {
    console.error('❌ BUG: Should extract width even if missing extension');
    failed = true;
  }
}

// 2. Query Parameters interfering with dimension extraction ($ in regex)
{
  const html = `<div class="image-gallery-embed" data-attrs="{&quot;images&quot;:[{&quot;url&quot;:&quot;https://cdn.substack.com/image/fetch/123_800x600.jpg?v=123&quot;}]}"></div>`;
  const result = extractSubstackGalleries(html);
  if (!result.includes('width="800"')) {
    console.error('❌ BUG: Dimension extraction fails with query params.');
    failed = true;
  }
}

// 3. Attribute Order (data-attrs before class)
{
  const html = `<div data-attrs="{&quot;images&quot;:[{&quot;url&quot;:&quot;https://cdn.substack.com/image_800x600.jpg&quot;}]}" class="image-gallery-embed"></div>`;
  const result = extractSubstackGalleries(html);
  if (!result.includes('<substack-gallery>')) {
    console.error('❌ BUG: Fails when data-attrs is before class attribute.');
    failed = true;
  }
}

// 4. Escaped forward slashes in JSON
{
  const html = `<div class="image-gallery-embed" data-attrs="{&quot;images&quot;:[{&quot;url&quot;:&quot;https:\\/\\/cdn.substack.com\\/image_800x600.jpg&quot;}]}"></div>`;
  const result = extractSubstackGalleries(html);
  if (!result.includes('https://cdn.substack.com/image_800x600.jpg')) {
    console.error('❌ BUG: URL extraction fails with escaped slashes (halts at \\).');
    failed = true;
  }
}

// 5. Malformed JSON handling
{
  const html = `<div class="image-gallery-embed" data-attrs="invalid json [] { but has https://cdn.substack.com/image_800x600.jpg"></div>`;
  const result = extractSubstackGalleries(html);
  if (result !== '') {
    console.error('❌ BUG: Does not actually fail gracefully for malformed JSON because it uses regex instead of JSON.parse.');
    failed = true;
  }
}

console.log('\\nTesting extractYouTubeEmbeds...');

// 6. Different iframe structures
{
  const html = `<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="YouTube video player" frameborder="0"></iframe>`;
  const result = extractYouTubeEmbeds(html);
  if (result !== '<youtube-embed video-id="dQw4w9WgXcQ"></youtube-embed>') {
    console.error('❌ BUG: Should correctly extract video ID and replace iframe');
    failed = true;
  }
}

// 7. youtube-nocookie.com
{
  const html = `<iframe src="https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"></iframe>`;
  const result = extractYouTubeEmbeds(html);
  if (result !== '<youtube-embed video-id="dQw4w9WgXcQ"></youtube-embed>') {
    console.error('❌ BUG: Does not match youtube-nocookie.com.');
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log('✅ All tests passed!');
}
