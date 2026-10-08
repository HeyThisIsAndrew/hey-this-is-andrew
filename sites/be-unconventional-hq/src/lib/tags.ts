/**
 * The two-slot metadata line: WHOSE it is, and WHAT it is.
 *
 *     DC  |  REVIEW
 *     ^brand  ^type
 *
 * ─── WHY THIS RETURNS SLOTS AND NOT A LIST ──────────────────────────────────
 * This used to build `[brand, type, extra]` and end with `.filter(Boolean)`.
 * The filter COLLAPSED the array, so when no brand resolved the editorial type
 * slid into the brand's position and every renderer printed it there.
 *
 * Measured across the 41 items on /feed, 5 rendered a collapsed pair:
 *
 *     []          The Monkey - Movie Review
 *     [REVIEW]    Boy Kills World! Out Of Theater Reaction
 *     []          WonderCon Vlog Day 1: What Happened To WonderCon!?
 *     [REVIEW]    Godzilla x Kong: The New Empire First Impression Out Of...
 *     [ANALYSIS]  The Wrong War: Why the Fight for Physical Media Has...
 *
 * It was not only a layout slip. FeedSpotlightHero styles the FIRST chip with
 * `.hero-meta-tag--type`, a 2px brand-coloured left border, so on those items
 * the brand accent was painted onto the editorial type. And two of them are
 * labelled REVIEW while being a reaction and a first impression: the regex
 * below matched a stray `review` tag, and the label is factually wrong on
 * exactly the creator-era pieces the Feed is meant to stop leading with.
 *
 * `getDisplayTagSlots()` is the API renderers should use. Each slot keeps its
 * meaning whether or not it has a value, so an absent brand renders as nothing
 * and the type still renders as the type.
 *
 * ─── THE CMS IS THE SOURCE OF TRUTH, THE REGEX IS THE LAST RESORT ───────────
 * Precedence per slot is: the editor's explicit value, then the classified
 * field, then pattern matching over raw platform tags. The pattern matching is
 * what produced the wrong labels above, and it is kept only so an item nobody
 * has classified yet still says something. It is the floor, not the answer.
 * Correcting a wrong label is a CMS edit, not another regex.
 */

/**
 * The closed set of editorial formats.
 *
 * ORDERED BY EDITORIAL PRIORITY, highest first. This is the order the Feed
 * uses to decide what leads the publication: substantive criticism and
 * reporting ahead of reactions and vlogs. It is deliberately NOT a date order.
 * A 2025 film review outranks a 2024 vlog because of what it IS, not when it
 * went out, and sorting by age would bury the former with the latter.
 *
 * Deliberately small. Everything the archive holds fits one of these eight,
 * and a taxonomy nobody can hold in their head does not get maintained.
 */
export const COVERAGE_TYPES = [
  'REVIEW',
  'ANALYSIS',
  'NEWS',
  'EVENT',
  'INTERVIEW',
  'REACTION',
  'FIRST IMPRESSION',
  'VLOG',
] as const;

export type CoverageType = (typeof COVERAGE_TYPES)[number];

/** Where a coverage type ranks, lowest number first. Unclassified sorts last. */
export function coverageRank(type: string | undefined | null): number {
  const index = (COVERAGE_TYPES as readonly string[]).indexOf(String(type ?? '').toUpperCase());
  return index === -1 ? COVERAGE_TYPES.length : index;
}

/** A stored `coverageType` matched to the closed set, or '' if it names none. */
export function normalizeCoverageType(raw: unknown): CoverageType | '' {
  const value = String(raw ?? '').trim().toUpperCase();
  if (!value) return '';
  const hit = (COVERAGE_TYPES as readonly string[]).find((t) => t === value);
  return (hit as CoverageType) ?? '';
}

export interface DisplayTagSlots {
  /** Studio, franchise or platform. '' when nothing identifies one. */
  brand: string;
  /** Editorial format, from COVERAGE_TYPES. '' when unclassified. */
  type: string;
  /** A third label an editor set by hand. Almost always ''. */
  extra: string;
}

const BRAND_PATTERNS: Array<{ label: string; regex: RegExp }> = [
  { label: 'MARVEL', regex: /MARVEL|WOLVERINE|AVENGERS|SPIDER|XMEN|MCU|DEADPOOL|VENOM/ },
  { label: 'DC', regex: /DC$|DCU|BATMAN|SUPERMAN|WONDERWOMAN|JUSTICELEAGUE|JOKER|LANTERNS/ },
  { label: 'NETFLIX', regex: /NETFLIX/ },
  { label: 'APPLE TV+', regex: /APPLE/ },
  { label: 'DISNEY', regex: /DISNEY/ },
  { label: 'SONY PICTURES', regex: /SONYPICTURES/ },
  { label: 'PLAYSTATION', regex: /\bSONY\b|PLAYSTATION|PS5|PS4/ },
  /* Ahead of WARNER BROS, and never folded into it: Ketchup Entertainment is
     its own distributor. Coyote vs. Acme is tagged both, because its review
     is about Warner writing the film off, and it is Ketchup's film. */
  { label: 'KETCHUP ENTERTAINMENT', regex: /KETCHUPENTERTAINMENT/ },
  { label: 'WARNER BROS', regex: /WARNER|WB/ },
  { label: 'HBO', regex: /HBO|^MAX$|HBOMAX/ },
  { label: 'UNIVERSAL PICTURES', regex: /UNIVERSAL/ },
  { label: '20TH CENTURY', regex: /20TH/ },
  { label: 'ANIMATION', regex: /ANIMATION/ },
  { label: 'PRIME VIDEO', regex: /PRIME|AMAZON|THEBOYS/ },
  { label: 'HULU', regex: /HULU/ },
  { label: 'NINTENDO', regex: /NINTENDO|SWITCH|ZELDA|MARIO/ },
  { label: 'XBOX', regex: /XBOX|HALO|GEARS/ },
  { label: 'STAR WARS', regex: /STARWARS|JEDI/ },
  { label: 'INSOMNIAC', regex: /INSOMNIAC/ },
  { label: 'LIONSGATE', regex: /LIONSGATE/ },
  { label: 'A24', regex: /^A24/ },
  { label: 'PARAMOUNT', regex: /PARAMOUNT/ },
];

/*
  Pattern fallbacks for the type slot, mapped ONTO the closed set above.

  The old table had thirteen labels of its own — COMMENTARY, TRAILER,
  BREAKDOWN, PODCAST, PREMIERE, ANNOUNCEMENT, DISPATCH, EVENT COVERAGE — which
  is how a metadata system meant to be part of the visual language ended up
  with more formats than the publication has. They fold into the eight:
  a breakdown is ANALYSIS, a premiere is an EVENT, a trailer piece is NEWS
  unless its own tags say otherwise.

  Order matters: the first match wins, so the more specific patterns lead.
*/
const TYPE_PATTERNS: Array<{ label: CoverageType; regex: RegExp }> = [
  { label: 'FIRST IMPRESSION', regex: /FIRSTIMPRESSION|FIRSTLOOK/ },
  { label: 'INTERVIEW', regex: /INTERVIEW/ },
  { label: 'REACTION', regex: /REACTION/ },
  { label: 'VLOG', regex: /VLOG/ },
  { label: 'ANALYSIS', regex: /ANALYSIS|DEEPDIVE|BREAKDOWN|COMMENTARY/ },
  { label: 'REVIEW', regex: /REVIEW/ },
  { label: 'EVENT', regex: /PREMIERE|EVENTCOVERAGE|REDCARPET/ },
  { label: 'NEWS', regex: /NEWS|ANNOUNCEMENT|TRAILER|DISPATCH/ },
];

/** Raw platform tags, punctuation closed up, uppercased, de-duplicated. */
function tagTokens(item: any): string[] {
  const raw: string[] = [];
  if (Array.isArray(item?.youtubeTags)) raw.push(...item.youtubeTags);
  if (Array.isArray(item?.tags)) raw.push(...item.tags);
  const cleaned = raw.map((t) =>
    typeof t === 'string' ? t.replace(/[#@\s]/g, '').toUpperCase() : '',
  );
  return [...new Set(cleaned.filter(Boolean))];
}

/**
 * The metadata pair for an item, each value in its own slot.
 *
 * An empty slot stays empty. Nothing is promoted into a position it did not
 * earn, which is the whole point of this function existing.
 */
export function getDisplayTagSlots(item: any): DisplayTagSlots {
  if (!item) return { brand: '', type: '', extra: '' };

  const tokens = tagTokens(item);

  /* BRAND: the editor's word, then the pattern table. */
  let brand = String(item.badge1 ?? '').trim();
  if (!brand) {
    brand = BRAND_PATTERNS.find((b) => tokens.some((t) => b.regex.test(t)))?.label ?? '';
  }

  /*
    TYPE: the editor's word, then the classified field, then the pattern table,
    then the item's own category as a floor.

    `coverageType` sits ABOVE the patterns deliberately. It is the field that
    makes "Boy Kills World! Out Of Theater Reaction" stop calling itself a
    REVIEW, and it does that by an editor saying so once rather than by another
    pattern trying to outguess the last one.
  */
  let type = String(item.badge2 ?? '').trim();
  if (!type) type = normalizeCoverageType(item.coverageType);
  if (!type) {
    type = TYPE_PATTERNS.find((p) => tokens.some((t) => p.regex.test(t)))?.label ?? '';
  }
  if (!type && String(item.contentType ?? '').trim()) {
    const ct = String(item.contentType).toUpperCase();
    type = TYPE_PATTERNS.find((p) => p.regex.test(ct))?.label ?? '';
  }
  /*
    An Events-category item with no format of its own is EVENT coverage.

    This used to set the BRAND slot to "EVENT", which is the same slot
    confusion this file exists to fix: a convention is not a studio. It is a
    floor rather than an override so an event piece that declares itself an
    INTERVIEW or a REVIEW keeps that.
  */
  if (!type && String(item.category ?? '').toUpperCase() === 'EVENTS') type = 'EVENT';

  return { brand, type, extra: String(item.badge3 ?? '').trim() };
}

/**
 * The slots as a plain list of the labels that are present.
 *
 * For callers that render a joined string and have no per-slot styling, and
 * for `entity-resolver`, which only tests set membership. **Do not use this
 * where the position carries meaning** — that is what collapsed the slots in
 * the first place. Use `getDisplayTagSlots()` there.
 */
export function getDisplayTags(item: any): string[] {
  const { brand, type, extra } = getDisplayTagSlots(item);
  return [brand, type, extra].filter(Boolean);
}
