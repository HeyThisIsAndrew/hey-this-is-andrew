/*
  Sanity as the image host: BE Unconventional HQ's system, made generic.
  Content stays in JSON files in the repo; only images live in Sanity's asset
  store (free tier, served from its CDN with on-the-fly resizing). An image
  field then holds Sanity's asset id, e.g.
    image-0b1c...e2-1600x900-jpg
  which carries the image's own size, so a site can lay it out without a
  lookup (HQ's trick: no GROQ dereference needed).

  Plain HTTP, no Sanity SDK: one upload call and a URL builder.
*/

const REF = /^image-([a-f0-9]+)-(\d+)x(\d+)-([a-z0-9]+)$/i;

/** Is this value a Sanity image asset id? */
export function isSanityRef(value) {
  return typeof value === 'string' && REF.test(value);
}

/** { id, width, height, ext } of an asset id, or null. */
export function parseImageRef(ref) {
  const m = REF.exec(String(ref ?? ''));
  return m ? { id: m[1], width: Number(m[2]), height: Number(m[3]), ext: m[4].toLowerCase() } : null;
}

/**
 * The CDN URL of an asset id, optionally resized (Sanity's image API:
 * w, h, fit, auto=format, q).
 * @param {string} ref
 * @param {{ projectId: string, dataset: string }} sanity
 * @param {Record<string, string | number>} [params]
 */
export function sanityImageUrl(ref, sanity, params = {}) {
  const p = parseImageRef(ref);
  if (!p) throw new Error(`Not a Sanity image ref: ${ref}`);
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();
  return `https://cdn.sanity.io/images/${sanity.projectId}/${sanity.dataset}/${p.id}-${p.width}x${p.height}.${p.ext}${qs ? `?${qs}` : ''}`;
}

/**
 * Upload an image to the dataset's asset store; resolves to its asset id.
 * Needs a token with write access (an environment variable, never the repo).
 * @param {Buffer} buffer
 * @param {string} filename
 * @param {{ projectId: string, dataset: string, token: string, apiVersion?: string }} opts
 * @param {typeof fetch} [fetchImpl]
 */
export async function uploadToSanity(buffer, filename, opts, fetchImpl = fetch) {
  if (!opts.token) throw new Error('No Sanity write token: set it in the environment (see the site README).');
  const v = opts.apiVersion ?? '2024-03-01';
  const url = `https://${opts.projectId}.api.sanity.io/v${v}/assets/images/${opts.dataset}?filename=${encodeURIComponent(filename)}`;
  const ext = filename.split('.').pop()?.toLowerCase();
  const type = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const res = await fetchImpl(url, { method: 'POST', headers: { Authorization: `Bearer ${opts.token}`, 'Content-Type': type }, body: buffer });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Sanity upload failed (${res.status}): ${body?.message ?? body?.error ?? 'unknown error'}`);
  const id = body?.document?._id;
  if (!isSanityRef(id)) throw new Error('Sanity upload returned no image id');
  return id;
}
