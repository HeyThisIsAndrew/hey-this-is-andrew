/**
 * Discovery Row selection logic: pick N shorts per category, rotated daily,
 * perfectly stable within a day.
 *
 * Why deterministic: the site is statically built. Math.random() would bake a
 * different shelf into every build (CDN-cache-busting, and a different result
 * from what an editor previewed). Seeding the shuffle with
 * `${category}-${YYYY-MM-DD}` makes any build on the same calendar day emit
 * identical HTML — aggressive CDN caching stays valid all day, and the shelf
 * rotates at midnight (brand timezone) on the next build.
 *
 * Date source is toYMD() (America/Los_Angeles) rather than UTC — "midnight"
 * means the brand's midnight, consistent with every other calendar decision
 * in src/lib/events.ts.
 */
import { toYMD } from './events.ts';

export interface ShortItem {
  id: string;
  title: string;
  thumbnailUrl: string;
  editorialTag?: string;
}

/**
 * xmur3 string hash — mixes every character into 32 bits. Tiny, dependency-
 * free, and plenty for shelf-shuffling (this is layout seeding, not crypto).
 */
export function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — fast 32-bit PRNG with good distribution for its size. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates with an injected seed. Pure: the input array is not mutated. */
export function seededShuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const rng = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The daily pick: shuffle the category's pool with seed
 * `${category}-${YYYY-MM-DD}` and take the first `count`.
 * Empty/missing pools yield [] so callers can render nothing.
 */
export function pickDailyShorts(
  pool: readonly ShortItem[] | undefined | null,
  category: string,
  count = 4,
  date: Date = new Date(),
): ShortItem[] {
  if (!pool || pool.length === 0) return [];
  const seed = hashSeed(`${category}-${toYMD(date)}`);
  return seededShuffle(pool, seed).slice(0, count);
}
