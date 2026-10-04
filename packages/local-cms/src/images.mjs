/*
  One function a site uses to turn an image field into something Astro's
  <Image> can render, whichever host it came from:

    "src/assets/brand-logos/be-logo.png"  -> the imported ImageMetadata
                                             (Astro optimises it at build)
    "image-<hash>-1600x900-jpg"           -> { src, width, height } on
                                             Sanity's CDN (remote image)

  Local images come from an import.meta.glob the SITE makes (a glob has to
  be written in the file that uses it), passed in as `images` with the
  glob's key prefix.
*/
import { isSanityRef, parseImageRef, sanityImageUrl } from './sanity.mjs';

/**
 * @param {string | undefined | null} value         the field's value
 * @param {{
 *   images: Record<string, any>,    // import.meta.glob(..., { eager: true, import: 'default' })
 *   prefix: string,                 // how the glob's keys start for the site's assetsDir, e.g. '../assets/'
 *   assetsDir?: string,             // the field values' prefix, default 'src/assets/'
 *   sanity?: { projectId: string, dataset: string },
 *   where?: string,                 // for the error message
 * }} opts
 */
export function resolveImage(value, opts) {
  if (!value) return undefined;
  if (isSanityRef(value)) {
    if (!opts.sanity) throw new Error(`${opts.where ?? 'image'}: "${value}" is a Sanity image, but no Sanity project is configured`);
    const { width, height } = /** @type {{ width: number, height: number }} */ (parseImageRef(value));
    return { src: sanityImageUrl(value, opts.sanity), width, height, remote: true };
  }
  const dir = (opts.assetsDir ?? 'src/assets/').replace(/\/?$/, '/');
  const key = value.startsWith(dir) ? `${opts.prefix}${value.slice(dir.length)}` : null;
  const img = key ? opts.images[key] : undefined;
  if (!img) throw new Error(`${opts.where ?? 'image'}: "${value}" is not an image under ${dir} that this site loads`);
  return img;
}
