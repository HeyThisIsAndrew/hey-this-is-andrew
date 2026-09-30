// Defect 1 guard: a feed title must never print an HTML entity literally.
// Run: node scripts/feed-text.test.mjs (npm test)
import assert from 'node:assert/strict';
import { cleanFeedText, decodeEntities } from '../src/lib/feed-text.ts';

const title = 'How Resident Evil Makes Being in the Theater Feel Like You&apos;re Actually Holding a Controller';
assert.equal(cleanFeedText(title), "How Resident Evil Makes Being in the Theater Feel Like You're Actually Holding a Controller");
assert.equal(cleanFeedText('You&amp;apos;re'), "You're", 'double-encoded entity');
assert.equal(cleanFeedText('<![CDATA[Tom &amp; Jerry]]>'), 'Tom & Jerry');
assert.equal(cleanFeedText('Gunn&#8217;s DCU'), 'Gunn’s DCU');
assert.equal(cleanFeedText('A&#x27;B'), "A'B");
assert.equal(cleanFeedText('<p>Hello <b>world</b></p>'), 'Hello world');
assert.equal(cleanFeedText('one — two'), 'one, two', 'no em dash in visitor copy');
assert.equal(cleanFeedText(null), '');
assert.equal(decodeEntities('&unknown;'), '&unknown;');
console.log('feed-text: ok');
