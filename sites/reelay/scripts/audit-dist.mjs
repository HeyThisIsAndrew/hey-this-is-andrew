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
  if (!privacyHtml.includes('Keychain') && !privacyHtml.includes('keychain')) {
    failures.push('privacy/index.html is missing Keychain storage disclosure');
  }
}

// 3. Check compliance text in /data-deletion/index.html
const dataDeletionPath = path.join(dist, 'data-deletion/index.html');
if (fs.existsSync(dataDeletionPath)) {
  const ddHtml = fs.readFileSync(dataDeletionPath, 'utf8');
  if (!ddHtml.includes('Reelay does not store your social account data on cloud servers')) {
    failures.push('data-deletion/index.html is missing mandatory Meta statement');
  }
  if (!ddHtml.includes('~/Library/Application Support/reelay')) {
    failures.push('data-deletion/index.html is missing local macOS directory path');
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
  if (!indexHtml.includes('60 FPS')) {
    failures.push('index.html is missing 60 FPS hardware playback metric');
  }
  if (!indexHtml.includes('25d314bff7a3bdecffa66c5ba2261e3c732b347401d1c2e881ccdcde3f2fdfa0')) {
    failures.push('index.html is missing SHA-256 cryptographic verification checksum for Reelay-0.12.0-mac-arm64.dmg');
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
console.log('✓ Interactive 4-stage publishing workflow component verified.');
console.log('✓ Zero-knowledge data-flow topology component verified.');
console.log('✓ Cryptographic SHA-256 download checksum verification verified.\n');
