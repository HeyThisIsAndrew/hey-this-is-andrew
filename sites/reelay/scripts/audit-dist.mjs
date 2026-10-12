#!/usr/bin/env node
/**
 * audit-dist.mjs: checks the BUILT site against what Google OAuth
 * verification, TikTok for Developers review and Meta App Review look for,
 * and against the app's own truth. Fails the build on any problem.
 *
 *   node scripts/audit-dist.mjs [dist]          normal run
 *   REELAY_RELEASE=1 node scripts/audit-dist.mjs  also fails on {{PLACEHOLDERS}}
 *                                                and missing screenshots
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(process.argv[2] || path.join(root, 'dist'));
const RELEASE = process.env.REELAY_RELEASE === '1';
if (!fs.existsSync(dist)) {
  console.error(`Dist folder not found: ${dist}`);
  process.exit(1);
}
const perms = JSON.parse(fs.readFileSync(path.join(root, 'src/data/permissions.json'), 'utf8'));
const screens = JSON.parse(fs.readFileSync(path.join(root, 'src/data/screens.json'), 'utf8'));
const operatorTs = fs.readFileSync(path.join(root, 'src/data/operator.ts'), 'utf8');
const LIMITED_USE = (operatorTs.match(/LIMITED_USE =\s*'([^']+)'/) || [])[1];

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
  e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);
const files = walk(dist);
const pages = files.filter((f) => f.endsWith('.html'));
const read = (rel) => { const f = path.join(dist, rel); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; };
/* Visible text, plus meta and alt text: tags, scripts and styles removed. */
const textOf = (html) => html
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, ' ')
  .replace(/<meta[^>]*content="([^"]*)"[^>]*>/g, ' $1 ')
  .replace(/<img[^>]*alt="([^"]*)"[^>]*>/g, ' $1 ')
  .replace(/aria-label="([^"]*)"/g, '> $1 <')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '’').replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/\s+/g, ' ');

const failures = [];
const warnings = [];
const fail = (m) => failures.push(m);

// ── 1. Routes ───────────────────────────────────────────────────────────
const requiredRoutes = [
  'index.html', 'features/index.html', 'features/library/index.html', 'features/pipeline/index.html',
  'features/automations/index.html', 'ai/index.html', 'pricing/index.html', 'support/index.html',
  'download/index.html', 'changelog/index.html', 'reviewers/index.html', 'privacy/index.html',
  'terms/index.html', 'data-deletion/index.html', 'copyright/index.html', 'security/index.html',
  'accessibility/index.html', '.well-known/security.txt',
];
console.log(`Auditing Reelay build output (${pages.length} pages)...`);
for (const r of requiredRoutes) if (!fs.existsSync(path.join(dist, r))) fail(`Missing required route: ${r}`);

// ── 2. Google: privacy policy, Limited Use, YouTube API Services ────────
const privacy = read('privacy/index.html');
const privacyText = textOf(privacy);
if (!LIMITED_USE) fail('LIMITED_USE sentence not found in src/data/operator.ts');
else if (!privacyText.includes(LIMITED_USE.replace(/'/g, '’'))) fail('privacy: the Limited Use sentence is missing or not verbatim');
for (const [needle, why] of [
  ['YouTube API Services', 'must say Reelay uses YouTube API Services'],
  ['https://policies.google.com/privacy', 'must link the Google Privacy Policy'],
  ['https://myaccount.google.com/permissions', 'must explain revoking access at Google'],
  ['https://www.youtube.com/t/terms', 'must link the YouTube Terms of Service'],
  ['https://oauth2.googleapis.com/revoke', 'must name the Google revocation endpoint'],
  ['Google API Services User Data Policy', 'must name the Google API Services User Data Policy'],
  ['RFC 8252', 'must describe loopback sign-in'],
  ['Keychain', 'must say tokens are in the Keychain'],
  ['id="google-limited-use"', 'needs the #google-limited-use anchor'],
  ['id="meta-compliance"', 'needs the #meta-compliance anchor'],
  ['id="tiktok"', 'needs the #tiktok anchor'],
  ['auth.reelay.app', 'must disclose the sign-in server'],
  ['10 minutes', 'must state the sign-in server’s 10-minute limit'],
  ['suggestqueries.google.com', 'must disclose suggestqueries.google.com'],
  ['Meta Platform Terms', 'must state Meta Platform Terms compliance'],
]) if (!privacy.includes(needle)) fail(`privacy ${why}`);
const terms = read('terms/index.html');
if (!terms.includes('https://www.youtube.com/t/terms')) fail('terms must bind YouTube features to the YouTube Terms of Service');
for (const needle of ['13', '18', 'Governing law', 'Limitation of liability', 'Termination', 'AI suggestions']) {
  if (!textOf(terms).includes(needle)) fail(`terms missing "${needle}"`);
}

// ── 3. Meta: data deletion ──────────────────────────────────────────────
const dd = read('data-deletion/index.html');
for (const [needle, why] of [
  ['Reelay does not store your social account data on cloud servers', 'mandatory Meta statement'],
  ['~/Library/Application Support/Reelay', 'local data folder path'],
  ['Disconnect', 'in-app Disconnect step'],
  ['Delete Profile', 'delete-profile step'],
  ['https://www.facebook.com/settings?tab=business_tools', 'Facebook business integrations link'],
  ['Apps and websites', 'Instagram removal step'],
  ['auth.reelay.app', 'sign-in server deletion contact'],
]) if (!dd.includes(needle)) fail(`data-deletion missing ${why}`);

// ── 4. Reviewer page ────────────────────────────────────────────────────
const rev = read('reviewers/index.html');
for (const id of ['google', 'tiktok', 'meta', 'install', 'operator']) if (!rev.includes(`id="${id}"`)) fail(`reviewers missing #${id}`);
if (!/provided in the review submission/.test(textOf(rev))) fail('reviewers must say test credentials are in the submission, not on the site');
for (const p of perms.platforms) for (const s of p.scopes) {
  if (!rev.includes(s.name)) fail(`reviewers page doesn’t list ${s.name}`);
  if (!privacy.includes(s.name)) fail(`privacy doesn’t disclose ${s.name}`);
}
const support = read('support/index.html');
if (!support.includes('id="demo-verification"')) fail('support missing the #demo-verification anchor');

// ── 5. Permissions: nothing on the site outside the table ───────────────
const allowed = new Set(perms.platforms.flatMap((p) => p.scopes.flatMap((s) => [s.name, s.short])));
const PERM_PATTERNS = [
  /https:\/\/www\.googleapis\.com\/auth\/[a-z0-9.\-]+/g,
  /\b(?:youtube|yt-analytics|yt-analytics-monetary)\.(?!com\b)[a-z\-]+(?:\.[a-z\-]+)?\b/g,
  /\buser\.info\.[a-z]+\b/g,
  /\bvideo\.(?:list|upload|publish)\b/g,
  /\binstagram_(?:business_[a-z_]+|basic|content_publish|manage_[a-z_]+|graph_user_[a-z_]+)\b/g,
  /\bthreads_(?:basic|content_publish|manage_[a-z_]+|read_replies|keyword_search|delete|location_tagging|profile_discovery)\b/g,
  /\bpages_(?:show_list|manage_[a-z_]+|read_[a-z_]+|messaging)\b/g,
  /\b(?:read_insights|business_management|publish_video)\b/g,
];
for (const p of pages) {
  const rel = path.relative(dist, p);
  const t = textOf(fs.readFileSync(p, 'utf8'));
  const seen = new Set();
  for (const re of PERM_PATTERNS) for (const m of t.matchAll(re)) {
    const name = m[0].replace(/[.)]+$/, '');
    if (!allowed.has(name) && !seen.has(name)) { seen.add(name); fail(`${rel} names "${name}", which isn’t in src/data/permissions.json`); }
  }
}

// ── 6. Truth guard: retired claims and forbidden wording ────────────────
const FORBIDDEN = [
  [/watermark/i, 'never position importing around watermarks (TikTok review)'],
  [/download any/i, 'importing is for media you own or manage'],
  [/any account['’]?s videos|videos from any account/i, 'importing is for media you own or manage'],
  [/MCP server/i, 'MCP is planned, not shipped'],
  [/\bIntel\b/, 'only Apple silicon is supported'],
  [/Windows download|download (?:for|on) Windows/i, 'there is no Windows build'],
  [/60 ?FPS/i, 'no frame-rate claim'],
  [/Whisper (?:AI|speech|transcri|model|Neural)|offline Whisper/i, 'transcripts come from the original post captions'],
  [/app\.db\b/, 'the database is reelay.db'],
  [/\b4482\b/, 'the Agent API is on port 8471'],
  [/Gatekeeper-verified|Hardened Runtime Configured|Apple Notarized/i, 'builds are not notarized'],
  [/Neural Engine|DirectX|Apple Metal|Metal GPU/i, 'no GPU acceleration is claimed by the app'],
  [/\$79|\$199|money-back|one-time license/i, 'no pricing is set; the beta is free'],
  [/5-stage|five-stage|5 Stages/i, 'the board has four columns'],
  [/posts? (?:automatically )?to (?:TikTok|Instagram)|auto-?posts? to (?:TikTok|Instagram)/i, 'Reelay never posts to TikTok or Instagram'],
];
for (const p of pages) {
  const rel = path.relative(dist, p);
  const t = textOf(fs.readFileSync(p, 'utf8'));
  for (const [re, why] of FORBIDDEN) {
    const m = t.match(re);
    if (m) {
      const at = t.indexOf(m[0]);
      const before = t.slice(Math.max(0, at - 30), at);
      // "never posts to TikTok" / "doesn’t post to Instagram" are the truth, not a claim.
      if (/posts? .*to (TikTok|Instagram)/i.test(m[0]) && /(never|n['’]t|not|no)\s*(\w+\s*){0,2}$/i.test(before)) continue;
      fail(`${rel} contains "${m[0]}" (${why})`);
    }
  }
  // "notarized" only as "not (yet) notarized" until RELEASE.notarized is true.
  for (const m of t.matchAll(/notari[sz]ed/gi)) {
    const before = t.slice(Math.max(0, m.index - 24), m.index);
    if (!/\bnot\b|n['’]t\b/i.test(before)) fail(`${rel} claims "${before.trim()} ${m[0]}" (builds are not notarized)`);
  }
}

// ── 7. Every page: head, footer legal links, no third-party resources ───
for (const p of pages) {
  const rel = path.relative(dist, p);
  const html = fs.readFileSync(p, 'utf8');
  if (!html.includes('<title>')) fail(`${rel} is missing <title>`);
  if (!html.includes('name="description"')) fail(`${rel} is missing meta description`);
  if (!html.includes('id="main-content"')) fail(`${rel} is missing #main-content`);
  if (!html.includes('property="og:image"') || !html.includes('name="twitter:card"')) fail(`${rel} is missing Open Graph or Twitter tags`);
  const og = (html.match(/property="og:image" content="([^"]+)"/) || [])[1] || '';
  const ogFile = og.replace(/^https?:\/\/[^/]+\//, '');
  if (ogFile && !fs.existsSync(path.join(dist, ogFile))) fail(`${rel} points og:image at ${ogFile}, which isn't built (run npm run og)`);
  for (const link of ['href="/privacy"', 'href="/terms"', 'href="/data-deletion"', 'href="/reviewers"']) {
    if (!html.includes(link)) fail(`${rel} footer is missing ${link}`);
  }
  if (!html.includes('TikTok is a trademark of ByteDance Ltd.')) fail(`${rel} footer is missing the trademark line`);
  const thirdParty = html.match(/<(?:script|img|iframe|source|video)[^>]+src="https?:\/\/[^"]+"|<link[^>]+href="https?:\/\/(?!reelay\.app)[^"]+"[^>]*>/g) || [];
  for (const t of thirdParty) {
    if (/rel="canonical"/.test(t)) continue;
    fail(`${rel} loads a third-party resource: ${t.slice(0, 120)}`);
  }
}
for (const f of files.filter((x) => x.endsWith('.css'))) {
  const css = fs.readFileSync(f, 'utf8');
  const ext = css.match(/url\(\s*["']?https?:\/\/[^)]+\)|@import\s+url\(\s*["']?https?:/g);
  if (ext) fail(`${path.relative(dist, f)} loads ${ext[0]}`);
}

// ── 8. Download, structured data, security.txt ──────────────────────────
const home = read('index.html');
for (const [needle, why] of [
  ['id="interactive-workflow"', '#interactive-workflow'],
  ['id="data-topology"', '#data-topology'],
  ['id="download"', '#download'],
  ['id="studio-preview"', '#studio-preview'],
  ['id="works-with"', '#works-with capability matrix'],
  ['25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0', 'the SHA-256 checksum'],
]) if (!home.includes(needle)) fail(`index.html is missing ${why}`);
const download = read('download/index.html');
for (const needle of ['25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0', 'Apple silicon · macOS 12 or later', 'Open Anyway', 'Control-click', 'Keychain Access', '~/Library/Logs/Reelay', 'id="release-notes"']) {
  if (!download.includes(needle)) fail(`download page is missing "${needle}"`);
}
for (const [rel, html] of [['index.html', home], ['download/index.html', download]]) {
  const ld = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
  const app = ld.find((d) => d['@type'] === 'SoftwareApplication');
  if (!app) fail(`${rel} is missing SoftwareApplication structured data`);
  else if (app.offers?.price !== '0' || !app.softwareVersion || !/macOS/.test(app.operatingSystem)) fail(`${rel} SoftwareApplication needs price 0, a version and macOS`);
}
const sec = read('.well-known/security.txt');
const exp = (sec.match(/^Expires:\s*(\S+)/m) || [])[1];
if (!/^Contact:/m.test(sec)) fail('security.txt has no Contact');
if (!exp || new Date(exp) <= new Date()) fail('security.txt Expires is missing or in the past');

// ── 9. Placeholders and screenshot slots (warnings; fatal for a release) ─
const placeholders = new Map();
for (const p of pages) for (const m of fs.readFileSync(p, 'utf8').matchAll(/\{\{([A-Z0-9_]+)\}\}/g)) {
  const set = placeholders.get(m[1]) || new Set();
  set.add(path.relative(dist, path.dirname(p)) || '/');
  placeholders.set(m[1], set);
}
for (const [k, where] of placeholders) warnings.push(`{{${k}}} still on ${[...where].join(', ')}`);
const missing = screens.slots.filter((s) => s.kind === 'image'
  ? !s.themes.every((t) => fs.existsSync(path.join(root, 'public/screens', `${s.id}-${t}@2x.png`)))
  : !fs.existsSync(path.join(root, 'public/screens', `${s.id}.mp4`)));
if (missing.length) warnings.push(`${missing.length} of ${screens.slots.length} screenshot and screencast slots are still empty (see src/data/screens.json)`);
if (RELEASE) for (const w of warnings) fail(`release: ${w}`);

// ── Report ──────────────────────────────────────────────────────────────
if (warnings.length && !RELEASE) {
  console.warn('\nTo do before review:');
  for (const w of warnings) console.warn(` • ${w}`);
}
if (failures.length) {
  console.error('\nAudit failures:');
  for (const f of failures) console.error(` ✗ ${f}`);
  process.exit(1);
}
console.log(`\n✓ All ${requiredRoutes.length} required routes, including /reviewers, /data-deletion and security.txt.`);
console.log('✓ Google: Limited Use sentence verbatim, YouTube API Services, Google Privacy Policy, revocation, YouTube Terms.');
console.log('✓ Meta: data deletion steps, Platform Terms statement. TikTok and Meta permissions disclosed.');
console.log(`✓ Permissions: every name on the site is in permissions.json (${perms.platforms.reduce((n, p) => n + p.scopes.length, 0)} scopes).`);
console.log('✓ Truth guard: no forbidden wording or retired claims on any page.');
console.log('✓ Every page: privacy, terms, data deletion and reviewer links, trademark line, Open Graph, no third-party resources.');
console.log('✓ Download facts, SoftwareApplication data and security.txt.\n');
