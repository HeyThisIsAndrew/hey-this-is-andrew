/**
 * ─── INLINE SCRIPTS SHIP MINIFIED ────────────────────────────────────────────
 *
 * An `is:inline` script never goes through the bundler, so it reached every
 * page exactly as written: long explanatory comments, indentation and all.
 * On the homepage that was 55 KB raw of inline script, of which half was
 * comments and whitespace (19.6 KB of the 77 KB brotli'd document). PageSpeed
 * simulates the whole document downloading before anything paints, so those
 * bytes were charged straight to FCP (-150 ms in the lab once removed).
 *
 * The comments stay in the SOURCE, where they belong. This runs after the
 * build (the `minify-inline-scripts` integration in astro.config.mjs) over
 * the emitted HTML and minifies only CLASSIC inline scripts: no `src`, and no
 * `type` other than JavaScript. JSON-LD, Partytown's `text/partytown` blocks
 * and Astro's own module scripts (already minified by Vite) are left alone.
 *
 * Top-level names are NOT renamed (esbuild keeps them in script context),
 * so a function one inline script declares and another calls still matches.
 * A script esbuild cannot parse is left exactly as it was. The CSP allows
 * inline script by 'unsafe-inline', not by hash, so a changed body is fine.
 */

const SCRIPT = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/gi;
const JS_TYPE = /^(|text\/javascript|application\/javascript)$/i;

/**
 * @param {string} html
 * @param {(code: string) => string} minify  returns the minified code, or throws
 * @returns {{ html: string, before: number, after: number, failed: number }}
 */
export function minifyInlineScripts(html, minify) {
  let before = 0;
  let after = 0;
  let failed = 0;
  const out = html.replace(SCRIPT, (whole, attrs = '', body) => {
    if (/\ssrc\s*=/i.test(attrs)) return whole;
    const type = (attrs.match(/\stype\s*=\s*["']?([^"'\s>]*)/i) || [])[1] ?? '';
    if (!JS_TYPE.test(type)) return whole;
    if (!body.trim()) return whole;
    let code;
    try {
      code = minify(body).trim();
    } catch {
      failed++;
      return whole;
    }
    /* Never emit something that would end the element early. */
    if (/<\/script/i.test(code) || code.length >= body.length) return whole;
    before += body.length;
    after += code.length;
    return `<script${attrs}>${code}</script>`;
  });
  return { html: out, before, after, failed };
}
