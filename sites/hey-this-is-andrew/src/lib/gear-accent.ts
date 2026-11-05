/**
 * The accent colour of a gear photo, sampled at build time.
 *
 * The /gear deck tints four things per item from the photo on screen: the
 * ambient glow behind the hero, the hero's badge, the item counter and the
 * active thumbnail's border (the HQ /featured pattern). Everything else on
 * the page stays monochrome.
 *
 * Most of the kit is black or grey, so the photo's AVERAGE colour is grey
 * and every item would glow the same. Instead this weighs each pixel by how
 * vivid it is and takes the dominant hue among the vivid ones: the purple of
 * a sensor, the orange G Master badge, a walnut handle. A photo with no
 * vivid colour at all falls back to a cool silver.
 */
import sharp from 'sharp';

export const NEUTRAL_ACCENT = '176, 184, 196';

const cache = new Map<string, string>();

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
  };
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h /= 6;
  return [h, s, l];
}

/** "r, g, b" for a CSS `rgba(var(--accent), a)`. Never throws. */
export async function sampleAccent(file: string): Promise<string> {
  const hit = cache.get(file);
  if (hit) return hit;
  let out = NEUTRAL_ACCENT;
  try {
    const { data, info } = await sharp(file)
      .resize(72, 72, { fit: 'inside' })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const BINS = 18;
    const weight = new Array<number>(BINS).fill(0);
    const sum = Array.from({ length: BINS }, () => [0, 0, 0]);
    const pixels = info.width * info.height;
    // The photo's overall colour cast, for photos with no vivid colour.
    const cast = [0, 0, 0];
    let castN = 0;
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const v = max / 255;
      const s = max === 0 ? 0 : (max - min) / max;
      if (v > 0.2) {
        castN++;
        cast[0] += r;
        cast[1] += g;
        cast[2] += b;
      }
      if (v < 0.14 || s < 0.16) continue;
      const [h] = rgbToHsl(r, g, b);
      const bin = Math.min(BINS - 1, Math.floor(h * BINS));
      const w = s * s * v;
      weight[bin] += w;
      sum[bin][0] += r * w;
      sum[bin][1] += g * w;
      sum[bin][2] += b * w;
    }
    let best = 0;
    for (let k = 1; k < BINS; k++) if (weight[k] > weight[best]) best = k;
    if (weight[best] / pixels > 0.0004) {
      const [r, g, b] = sum[best].map((c) => c / weight[best]);
      const [h, s] = rgbToHsl(r, g, b);
      // Legible on near-black, vivid but not neon.
      const [R, G, B] = hslToRgb(h, Math.min(0.82, Math.max(0.5, s)), 0.62);
      out = `${R}, ${G}, ${B}`;
    } else if (castN > 0) {
      // No vivid colour: amplify the photo's own cast (warm steel, cool
      // graphite) so each item still glows its own way, gently.
      const mean = cast.map((c) => c / castN);
      const avg = (mean[0] + mean[1] + mean[2]) / 3;
      const spread = Math.max(...mean) - Math.min(...mean);
      if (spread >= 1.5) {
        const [h] = rgbToHsl(...(mean.map((c) => 128 + (c - avg) * 8) as [number, number, number]));
        const [R, G, B] = hslToRgb(h, 0.32, 0.66);
        out = `${R}, ${G}, ${B}`;
      }
    }
  } catch {
    out = NEUTRAL_ACCENT;
  }
  cache.set(file, out);
  return out;
}
