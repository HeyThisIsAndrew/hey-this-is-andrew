/**
 * Generates the downloadable one-sheet PDFs (media kit and press kit) via
 * headless Chromium instead of relying on a visitor's own browser/OS print
 * pipeline.
 *
 * window.print() hands rendering off to whatever print engine the visiting
 * device has, and that turned out to vary in ways CSS can't reconcile:
 * iOS Safari's AirPrint pipeline reserves its own margin and stamps a URL/
 * date/page-count footer onto every page (not controllable from web page
 * code at all), while desktop Chrome's print-to-PDF has a togglable
 * "headers and footers" *dialog* setting - a human choice made once, not a
 * permanent fix, and not exposed to the user at all on iOS's Share Sheet.
 * No single @media print stylesheet satisfies every device's print engine.
 *
 * This generates the PDFs directly instead: same Chromium print pipeline
 * Puppeteer already uses for this project's e2e tests, driven by code with
 * zero margins and headers/footers explicitly off, every time. The output
 * is committed to public/downloads/ and each page's "Download PDF" button
 * (there is only one per page, shared between desktop/mobile via responsive
 * CSS) just links to that static file - no print action, on either
 * platform, ever again.
 *
 * Both one-sheets are rendered in a single run because they share the whole
 * expensive part of the job (one `astro build`, one preview server, one
 * browser). /media-kit is data-driven and needs regenerating whenever the
 * stats change; /collaborations/press-kit is fully static editorial copy and only
 * changes when the page does. Regenerating both every time is cheap and
 * keeps the two documents from drifting out of sync visually.
 *
 * Run after `npm run refresh-analytics` (or whenever either one-sheet's
 * design changes) and commit the regenerated PDFs alongside it.
 */
import puppeteer from 'puppeteer';
import { spawn } from 'child_process';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DOWNLOADS_DIR = path.join(__dirname, '../public/downloads');

/**
 * Chromium stamps /CreationDate and /ModDate with the moment of the run, so
 * two renders of a byte-identical page produced two different files. That made
 * every scheduled run commit both PDFs whether or not anything had actually
 * changed, and made "did this PDF change?" impossible to answer from a diff.
 *
 * Both dates are rewritten to a fixed timestamp of exactly the same length, so
 * the byte offsets in the xref table stay valid - a shorter or longer
 * replacement would corrupt the file. Content is untouched; identical input now
 * yields an identical file, and a diff means the sheet really did change.
 */
const FIXED_PDF_DATE = "D:19700101000000+00'00'";
async function normalisePdfTimestamps(file) {
  const buf = await fs.readFile(file);
  let out = buf.toString('latin1');
  for (const key of ['CreationDate', 'ModDate']) {
    out = out.replace(new RegExp(`/${key} \\(D:[^)]*\\)`, 'g'), (match) => {
      const replacement = `/${key} (${FIXED_PDF_DATE})`;
      // Only rewrite when the lengths line up, otherwise leave it alone rather
      // than shift every offset after it.
      return replacement.length === match.length ? replacement : match;
    });
  }
  await fs.writeFile(file, Buffer.from(out, 'latin1'));
}

const SHEETS = [
  { route: '/media-kit/', outFile: path.join(DOWNLOADS_DIR, 'be-unconventional-hq-media-kit.pdf') },
  { route: '/collaborations/press-kit/', outFile: path.join(DOWNLOADS_DIR, 'be-unconventional-hq-press-kit.pdf') },
];

console.log('[media-kit-pdf] Building the site...');
execSync('npx astro build', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

console.log('[media-kit-pdf] Starting preview server...');
const server = spawn('npm', ['run', 'preview'], { cwd: path.join(__dirname, '..'), stdio: 'pipe' });

const baseUrl = await new Promise((resolve, reject) => {
  let output = '';
  const onData = (data) => {
    output += data.toString();
    const match = output.match(/(https?:\/\/localhost:\d+)/);
    if (match) resolve(match[1]);
  };
  server.stdout.on('data', onData);
  server.stderr.on('data', onData);
  server.on('error', reject);
  server.on('exit', (code) => {
    if (code !== 0) reject(new Error(`Preview server exited with code ${code}`));
  });
  setTimeout(() => reject(new Error('Preview server start timed out')), 30000);
});

let exitCode = 0;
try {
  // --no-sandbox: needed when this runs as root (CI containers, some local
  // dev setups) - Chromium's sandbox refuses to start otherwise. Puppeteer's
  // own docs list this as the standard workaround for that specific case.
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    await fs.mkdir(DOWNLOADS_DIR, { recursive: true });

    for (const { route, outFile } of SHEETS) {
      console.log(`[media-kit-pdf] Rendering ${baseUrl}${route} to PDF...`);
      const page = await browser.newPage();
      try {
        await page.setViewport({ width: 1000, height: 1300 });
        await page.goto(`${baseUrl}${route}`, { waitUntil: 'networkidle0', timeout: 30000 });
        await page.evaluate(() => document.fonts.ready);
        await page.emulateMediaType('print');

        await page.pdf({
          path: outFile,
          printBackground: true,
          displayHeaderFooter: false,
          width: '8.5in',
          height: '11in',
          margin: { top: 0, bottom: 0, left: 0, right: 0 },
        });
      } finally {
        await page.close();
      }
      await normalisePdfTimestamps(outFile);
      console.log(`[media-kit-pdf] Saved to ${outFile}`);
    }
  } finally {
    await browser.close();
  }
} catch (err) {
  console.error(`[media-kit-pdf] Failed: ${err.message}`);
  exitCode = 1;
} finally {
  server.kill();
}

process.exit(exitCode);
