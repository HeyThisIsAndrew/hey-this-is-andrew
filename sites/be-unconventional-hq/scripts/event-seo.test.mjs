/*
  What an event page tells Google and a social card.

  Offline: the builders are exercised directly against the shipped store, and
  the two templates are read as source.

  ─── WHY THIS EXISTS ───────────────────────────────────────────────────────
  None of this shows on the page, which is exactly why all four of these
  shipped broken and stayed broken. A wrong <title> looks fine in a browser
  tab you are not reading; a missing og:image looks fine until somebody pastes
  the link into Slack; a 26-character description looks fine everywhere except
  a search result.
*/
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import assert from 'node:assert/strict';
import {
  buildEventDescription,
  buildEventTitleName,
  buildEventSchema,
  DESCRIPTION_MIN,
  DESCRIPTION_MAX,
  isPlaceholderValue,
} from '../src/lib/event-seo.ts';

const here = dirname(fileURLToPath(import.meta.url));
const readSrc = (...parts) => readFileSync(join(here, '..', ...parts), 'utf8');
const stripComments = (text) =>
  text
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

const events = JSON.parse(readSrc('src', 'data', 'videos.json')).filter((d) => d._type === 'event');

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed += 1;
  } catch (error) {
    console.log(`  ✗ ${name}\n    ${error.message}`);
    failed += 1;
  }
}

console.log('\nevent descriptions');

test('every shipped event lands in the range Google will actually use', () => {
  /*
    The pages shipped with `Coverage of ${event.title}`. For BlizzCon that is
    20 characters: under the floor for every event on the site.
  */
  assert.ok(events.length > 0, 'the event store must not be empty');
  for (const event of events) {
    const d = buildEventDescription(event);
    assert.ok(
      d.length >= DESCRIPTION_MIN && d.length <= DESCRIPTION_MAX,
      `${event.slug?.current}: ${d.length} chars, outside ${DESCRIPTION_MIN}-${DESCRIPTION_MAX}\n      ${d}`,
    );
  }
});

test('it never ends mid-clause', () => {
  /*
    The first version appended one fixed tail and then trimmed to the ceiling,
    which cut it mid-sentence: "News, video coverage and everything we." The
    tail is all-or-nothing now.
  */
  for (const event of events) {
    const d = buildEventDescription(event);
    assert.match(d, /\.$/, `${event.slug?.current}: does not end in a full stop`);
    assert.ok(
      !/\b(we|and|the|a|of|at|in|to|for)\.$/i.test(d),
      `${event.slug?.current}: ends on a dangling word\n      ${d}`,
    );
  }
});

test('no article is glued to a plural event type', () => {
  /*
    "a industry awards", for The Oscars and The Game Awards. Fixing it with an
    a/an rule would still read wrong for the plural, so the clause became its
    own sentence and the article went with the problem.
  */
  for (const event of events) {
    const d = buildEventDescription(event);
    assert.ok(!/\ba industry/i.test(d), `${event.slug?.current}: "a industry awards"\n      ${d}`);
    assert.ok(
      !/\ba [aeiou]/i.test(d),
      `${event.slug?.current}: "a" before a vowel\n      ${d}`,
    );
  }
});

test('a venue takes "at" and a bare city takes "in"', () => {
  const withVenue = buildEventDescription({
    title: 'Test Con',
    eventType: 'convention-expo',
    startDate: '2026-05-01',
    location: { venue: 'Some Hall', city: 'Leeds', country: 'UK' },
  });
  assert.match(withVenue, /at Some Hall/);

  const cityOnly = buildEventDescription({
    title: 'Test Con',
    eventType: 'convention-expo',
    startDate: '2026-05-01',
    location: { city: 'Leeds', country: 'UK' },
  });
  assert.match(cityOnly, /in Leeds/);
});

test('a document missing its place or its dates still reads as a sentence', () => {
  const bare = buildEventDescription({ title: 'Mystery Event' });
  assert.ok(bare.length >= DESCRIPTION_MIN && bare.length <= DESCRIPTION_MAX, `${bare.length}: ${bare}`);
  assert.ok(!/undefined|null|NaN|\s\./.test(bare), `leaked an empty clause: ${bare}`);
  assert.match(bare, /Mystery Event/);
});

test('an editor\'s "not filled in yet" never reaches Google', () => {
  /*
    ─── THE ONE PLACEHOLDER THAT WAS ACTUALLY LEAKING ──────────────────────

    The Doomsday premiere has `venue: "TBD"`, which is honest ON the page:
    it tells a reader the venue is genuinely unannounced, which is different
    from the site not knowing. In a meta description it is neither useful nor
    true, and it is the version that gets crawled and cached:

      "Premiere at TBD, Los Angeles, CA."

    Filtered out of the METADATA only. The page still says TBD.
  */
  for (const v of ['TBD', 'tba', ' TBC ', 'N/A', 'na', 'To Be Announced', 'coming soon', 'Unknown', 'none']) {
    assert.ok(isPlaceholderValue(v), `"${v}" should count as a placeholder`);
  }
  for (const v of ['Dolby Theatre', 'Javits Center', '', undefined, 'Tokyo Big Sight', 'NA Convention Hall']) {
    assert.ok(!isPlaceholderValue(v), `"${v}" is a real value and must survive`);
  }

  const tbd = {
    title: 'A Premiere',
    eventType: 'premiere',
    startDate: '2026-12-14',
    location: { venue: 'TBD', city: 'Los Angeles', region: 'CA', country: 'USA' },
  };
  const d = buildEventDescription(tbd);
  assert.ok(!/\bTBD\b/i.test(d), `TBD leaked into the description:\n      ${d}`);
  assert.match(d, /in Los Angeles, CA/, 'and it must fall back to the city, not drop the place');

  const schema = buildEventSchema(tbd, {});
  assert.ok(!JSON.stringify(schema).includes('TBD'), 'TBD leaked into the Event schema');
  assert.equal(schema.location.address.addressLocality, 'Los Angeles',
    'the real address parts must survive the filter');

  /* And a genuine venue is untouched. */
  const real = { ...tbd, location: { ...tbd.location, venue: 'Dolby Theatre' } };
  assert.match(buildEventDescription(real), /at Dolby Theatre/);
  assert.equal(buildEventSchema(real, {}).location.name, 'Dolby Theatre');
});

test('no shipped event leaks a placeholder into its metadata', () => {
  for (const event of events) {
    const d = buildEventDescription(event);
    const schema = JSON.stringify(buildEventSchema(event, { description: d }) ?? {});
    for (const marker of ['TBD', 'TBA', 'To Be Announced', 'Coming Soon']) {
      assert.ok(!new RegExp(`\\b${marker}\\b`, 'i').test(d),
        `${event.slug?.current}: "${marker}" in the description\n      ${d}`);
      assert.ok(!new RegExp(`\\b${marker}\\b`, 'i').test(schema),
        `${event.slug?.current}: "${marker}" in the Event schema`);
    }
  }
});

console.log('\nevent titles');

test('the title carries the real brand, and says it once', () => {
  /*
    Layout renders <title> verbatim and appends nothing, so the pages shipped
    with no brand at all. The suggested literal for this fix was
    "| Be Unconventional", which is the WRONG name: it is Be Unconventional
    HQ. pageTitle() is the site-wide helper precisely so nobody has to
    remember that.
  */
  assert.equal(buildEventTitleName({ title: 'San Diego Comic Con' }), 'San Diego Comic Con Coverage');
  assert.equal(buildEventTitleName({ title: 'SDCC Coverage' }), 'SDCC Coverage',
    'must not produce "Coverage Coverage"');
  assert.equal(buildEventTitleName({}), 'Event Coverage');

  for (const rel of ['EventAnnouncement.astro', 'EventFeatured.astro']) {
    const code = stripComments(readSrc('src', 'components', rel));
    assert.match(code, /pageTitle\(buildEventTitleName\(event\)\)/,
      `${rel} must build its title through the shared helper`);
    assert.ok(
      !/\|\s*Be Unconventional['"`\s]/.test(code),
      `${rel} hardcodes a brand suffix. pageTitle() owns that, and the hand-written version ` +
        'had the name wrong.',
    );
  }
});

console.log('\nschema.org/Event');

test('dates go in as the strings they are stored as', () => {
  /*
    HARD RULE 1. schema.org takes a plain "YYYY-MM-DD", which is exactly what
    the document holds. Round-tripping through `new Date()` to "normalise" it
    is the UTC shift that moves a convention to the day before, west of
    Greenwich.
  */
  const schema = buildEventSchema({ title: 'T', startDate: '2026-07-22', endDate: '2026-07-26' });
  assert.equal(schema.startDate, '2026-07-22');
  assert.equal(schema.endDate, '2026-07-26');

  const lib = readSrc('src', 'lib', 'event-seo.ts');
  assert.ok(!/new Date\(/.test(stripComments(lib)), 'event-seo.ts constructs a Date from a calendar string');
});

test('an incomplete event emits no node rather than a broken one', () => {
  /*
    Search Console reports a partial Event as an error against the page, which
    is worse than having no Event node at all.
  */
  assert.equal(buildEventSchema({ startDate: '2026-01-01' }), null, 'no name');
  assert.equal(buildEventSchema({ title: 'T' }), null, 'no start date');
  assert.equal(buildEventSchema({}), null);
  assert.equal(buildEventSchema(null), null);
});

test('editorial status maps to the schema.org vocabulary', () => {
  const at = (status) => buildEventSchema({ title: 'T', startDate: '2026-01-01', status }).eventStatus;
  assert.equal(at('cancelled'), 'https://schema.org/EventCancelled');
  assert.equal(at('postponed'), 'https://schema.org/EventPostponed');
  assert.equal(at(undefined), 'https://schema.org/EventScheduled');
  /* upcoming/live/completed are DERIVED from dates, not stored, and are not
     schema.org statuses. They must not leak through as one. */
  assert.equal(at('completed'), 'https://schema.org/EventScheduled');
});

test('a location becomes a Place with a postal address', () => {
  const schema = buildEventSchema({
    title: 'T',
    startDate: '2026-01-01',
    location: { venue: 'Javits Center', city: 'New York', region: 'NY', country: 'USA' },
  });
  assert.equal(schema.location['@type'], 'Place');
  assert.equal(schema.location.name, 'Javits Center');
  assert.deepEqual(schema.location.address, {
    '@type': 'PostalAddress',
    addressLocality: 'New York',
    addressRegion: 'NY',
    addressCountry: 'USA',
  });

  /* A legacy string location is still in the store shape, and must not crash. */
  const legacy = buildEventSchema({ title: 'T', startDate: '2026-01-01', location: 'Somewhere' });
  assert.equal(legacy.location.name, 'Somewhere');

  assert.equal(buildEventSchema({ title: 'T', startDate: '2026-01-01' }).location, undefined,
    'no location field rather than an empty Place');
});

test('every shipped event produces a schema node with the required fields', () => {
  for (const event of events) {
    const schema = buildEventSchema(event, {
      url: `https://beunconventionalhq.com/events/${event.slug?.current}`,
      imageUrl: 'https://cdn.example/og.jpg',
      description: buildEventDescription(event),
    });
    assert.ok(schema, `${event.slug?.current}: no schema emitted`);
    assert.equal(schema['@type'], 'Event');
    assert.ok(schema.name, `${event.slug?.current}: no name`);
    assert.match(schema.startDate, /^\d{4}-\d{2}-\d{2}$/, `${event.slug?.current}: bad startDate`);
    assert.ok(schema.url.startsWith('https://'), `${event.slug?.current}: url must be absolute`);
  }
});

console.log('\nthe templates are wired to all of it');

test('both templates pass the image, the type and the schema', () => {
  for (const rel of ['EventAnnouncement.astro', 'EventFeatured.astro']) {
    const code = stripComments(readSrc('src', 'components', rel));

    assert.match(code, /image=\{ogImage\}/,
      `${rel} does not pass an og:image, so every event shares the site default card`);
    assert.match(code, /urlFor\(event\.heroImage\)\.width\(1200\)\.height\(630\)/,
      `${rel} must request a 1200x630 crop: that is the social card ratio`);
    assert.match(code, /description=\{seoDescription\}/, `${rel} must use the built description`);
    assert.ok(
      !/description=\{`Coverage of/.test(code),
      `${rel} is back on the 26-character description`,
    );
    assert.match(code, /slot="head"[\s\S]{0,80}application\/ld\+json/,
      `${rel} must inject the Event schema into Layout's head slot`);
    assert.match(code, /replace\(\/<\/g, '\\\\u003c'\)/,
      `${rel} must escape "<" in the JSON-LD, or a string containing one closes the script early`);
  }
});

console.log(`\n${failed === 0 ? '✅' : '❌'} ${passed} passed, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
