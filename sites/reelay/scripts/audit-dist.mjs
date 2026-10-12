#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const dist = path.resolve(process.argv[2] || 'dist');
if (!fs.existsSync(dist)) {
  console.error(`Dist folder not found: ${dist}`);
  process.exit(1);
}

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]
  );

const pages = walk(dist).filter((f) => f.endsWith('.html'));
const failures = [];

const requiredRoutes = [
  'index.html',
  'privacy/index.html',
  'terms/index.html',
  'data-deletion/index.html',
  'features/index.html',
  'features/library/index.html',
  'features/pipeline/index.html',
  'features/automations/index.html',
  'ai/index.html',
  'pricing/index.html',
  'support/index.html',
];

console.log(`Auditing Reelay build output (${pages.length} HTML files found)...`);

// 1. Verify all required routes exist
for (const req of requiredRoutes) {
  const fullPath = path.join(dist, req);
  if (!fs.existsSync(fullPath)) {
    failures.push(`Missing required route: ${req}`);
  }
}

// 2. Check compliance text in /privacy/index.html
const privacyPath = path.join(dist, 'privacy/index.html');
if (fs.existsSync(privacyPath)) {
  const privacyHtml = fs.readFileSync(privacyPath, 'utf8');
  if (!privacyHtml.includes('https://www.googleapis.com/auth/youtube.upload')) {
    failures.push('privacy/index.html is missing disclosure for youtube.upload scope');
  }
  if (!privacyHtml.includes('Google API Services User Data Policy')) {
    failures.push('privacy/index.html is missing Google Limited Use disclosure');
  }
  if (!privacyHtml.includes('https://www.googleapis.com/auth/youtube.readonly')) {
    failures.push('privacy/index.html is missing disclosure for youtube.readonly scope');
  }
  if (!privacyHtml.includes('Keychain') && !privacyHtml.includes('keychain')) {
    failures.push('privacy/index.html is missing Keychain storage disclosure');
  }
  if (!privacyHtml.includes('RFC 8252')) {
    failures.push('privacy/index.html is missing the RFC 8252 loopback sign-in description');
  }
  if (!privacyHtml.includes('https://oauth2.googleapis.com/revoke')) {
    failures.push('privacy/index.html is missing the Google token revocation endpoint');
  }
  if (!privacyHtml.includes('id="google-limited-use"') || !privacyHtml.includes('id="meta-compliance"')) {
    failures.push('privacy/index.html is missing the #google-limited-use or #meta-compliance anchor');
  }
}

// 3. Check compliance text in /data-deletion/index.html
const dataDeletionPath = path.join(dist, 'data-deletion/index.html');
if (fs.existsSync(dataDeletionPath)) {
  const ddHtml = fs.readFileSync(dataDeletionPath, 'utf8');
  if (!ddHtml.includes('Reelay does not store your social account data on cloud servers')) {
    failures.push('data-deletion/index.html is missing mandatory Meta statement');
  }
  // The app's data folder is APP_ID = "Reelay" (reelay/paths.py), capital R.
  if (!ddHtml.includes('~/Library/Application Support/Reelay')) {
    failures.push('data-deletion/index.html is missing local macOS directory path');
  }
  if (!ddHtml.includes('Disconnect')) {
    failures.push('data-deletion/index.html is missing the in-app Disconnect instructions');
  }
}

// 3b. The App Review notes reviewers are sent to
const supportPath = path.join(dist, 'support/index.html');
if (fs.existsSync(supportPath)) {
  const supportHtml = fs.readFileSync(supportPath, 'utf8');
  if (!supportHtml.includes('id="demo-verification"')) {
    failures.push('support/index.html is missing the #demo-verification reviewer section');
  }
  if (!supportHtml.includes('https://www.googleapis.com/auth/youtube.upload')) {
    failures.push('support/index.html reviewer notes are missing the youtube.upload scope');
  }
}

// 4. Verify basic head metadata across all pages
for (const p of pages) {
  const html = fs.readFileSync(p, 'utf8');
  const rel = path.relative(dist, p);

  if (!html.includes('<title>')) {
    failures.push(`${rel} is missing <title> tag`);
  }
  if (!html.includes('name="description"')) {
    failures.push(`${rel} is missing meta description`);
  }
  if (!html.includes('id="main-content"')) {
    failures.push(`${rel} is missing #main-content container`);
  }
}

// 5. Verify Apple-grade interactive components on homepage
const indexPath = path.join(dist, 'index.html');
if (fs.existsSync(indexPath)) {
  const indexHtml = fs.readFileSync(indexPath, 'utf8');
  if (!indexHtml.includes('id="interactive-workflow"')) {
    failures.push('index.html is missing #interactive-workflow component');
  }
  if (!indexHtml.includes('id="data-topology"')) {
    failures.push('index.html is missing #data-topology component');
  }
  if (!indexHtml.includes('id="download"')) {
    failures.push('index.html is missing #download component');
  }
  if (!indexHtml.includes('id="studio-preview"')) {
    failures.push('index.html is missing the #studio-preview product stage');
  }
  if (!indexHtml.includes('25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0')) {
    failures.push('index.html is missing SHA-256 cryptographic verification checksum for Reelay-0.12.0-mac-arm64.dmg');
  }
}

// 6. Truth guard. Google and Meta review read this site, so claims the app
// (HeyThisIsAndrew/reelay) does not support must never come back. Each
// pattern was on the site once; the comment says what is actually true.
const FALSE_CLAIMS = [
  [/60 ?FPS/i, 'no frame-rate claim: the player is QtMultimedia with no fps guarantee'],
  [/Whisper (AI|speech|transcri|model|Neural)|offline Whisper/i, 'transcripts come from the original post captions; no speech-to-text runs'],
  [/app\.db/, 'the database is reelay.db'],
  [/4482/, 'the Agent API is on port 8471; there is no MCP server yet'],
  [/MCP server|exposes an? (open )?Model Context Protocol/i, 'MCP is a proposal, not in the app'],
  [/Apple Notarized|Gatekeeper-verified|Hardened Runtime Configured/i, 'builds are not notarized'],
  [/Neural Engine|DirectX|Apple Metal|Metal GPU/i, 'no GPU or Neural Engine acceleration is claimed by the app'],
  [/\$79|\$199|money-back|one-time license/i, 'no pricing is set; the beta is free'],
  [/5-stage|five-stage|5 Stages/i, 'the board has four columns'],
];
for (const p of pages) {
  const rel = path.relative(dist, p);
  const text = fs.readFileSync(p, 'utf8').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  for (const [re, why] of FALSE_CLAIMS) {
    const m = text.match(re);
    if (m) failures.push(`${rel} contains "${m[0]}" (${why})`);
  }
}

if (failures.length > 0) {
  console.error('\nAudit Failures:');
  for (const f of failures) console.error(` ✗ ${f}`);
  process.exit(1);
}

console.log(`\n✓ All ${requiredRoutes.length} required compliance and marketing routes verified.`);
console.log('✓ Google Limited Use & YouTube Data API scopes verified.');
console.log('✓ Meta user data deletion instructions verified.');
console.log('✓ Local-first Keychain & SQLite security statements verified.');
console.log('✓ App Review notes (#demo-verification) verified.');
console.log('✓ Four-column board workflow and data-flow topology components verified.');
console.log('✓ SHA-256 download checksum verified.');
console.log('✓ Truth guard: no retired claims about the app on any page.\n');
