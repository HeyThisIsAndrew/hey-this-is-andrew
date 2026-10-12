import { chromium } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import http from 'http';

const outDir = path.resolve('verification/visual-audit-2026-10-11');
fs.mkdirSync(outDir, { recursive: true });

const distDir = path.resolve('sites/reelay/dist');
const mimeTypes = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

async function capture() {
  console.log('Serving production build from sites/reelay/dist on port 4322...');
  const server = http.createServer((req, res) => {
    let filePath = path.join(distDir, req.url.split('?')[0]);
    if (filePath.endsWith('/') || !path.extname(filePath)) {
      filePath = path.join(filePath, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  await new Promise((resolve) => server.listen(4322, '127.0.0.1', resolve));

  console.log('Launching browser for visual audit...');
  const browser = await chromium.launch();
  const baseUrl = 'http://127.0.0.1:4322';

  const viewports = [
    { width: 1440, height: 1000, name: '1440x1000' },
    { width: 1280, height: 800, name: '1280x800' },
    { width: 390, height: 844, name: '390x844' },
  ];

  // 1. Homepage captures across viewports
  for (const vp of viewports) {
    console.log(`Capturing homepage viewport ${vp.name}...`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle' });

    await page.screenshot({ path: path.join(outDir, `homepage-full-${vp.name}.png`), fullPage: true });
    await page.screenshot({ path: path.join(outDir, `homepage-fold-${vp.name}.png`) });

    if (vp.width === 1440) {
      const sections = [
        { sel: '.hero-section', name: '01-hero' },
        { sel: '.metrics-strip-section', name: '02-metrics' },
        { sel: '#interactive-workflow', name: '03-workflow' },
        { sel: '#studio-preview', name: '04-mockup' },
        { sel: '#four-pillars', name: '05-accordion' },
        { sel: '#data-topology', name: '06-topology' },
        { sel: '.silicon-specs-section', name: '07-silicon' },
        { sel: '#download', name: '08-download' },
      ];

      for (const s of sections) {
        try {
          const el = await page.$(s.sel);
          if (el) {
            await el.screenshot({ path: path.join(outDir, `section-${s.name}.png`) });
            console.log(`Saved screenshot: section-${s.name}.png`);
          }
        } catch (e) {
          console.log(`Failed to screenshot ${s.name}:`, e.message);
        }
      }
    }

    await context.close();
  }

  // 2. Subpage captures at 1440x1000 and 390x844
  const subpages = [
    { route: '/features/', name: 'features-index' },
    { route: '/features/pipeline/', name: 'features-pipeline' },
    { route: '/features/library/', name: 'features-library' },
    { route: '/features/automations/', name: 'features-automations' },
    { route: '/ai/', name: 'ai-mcp' },
    { route: '/pricing/', name: 'pricing' },
    { route: '/support/', name: 'support' },
    { route: '/privacy/', name: 'privacy' },
    { route: '/data-deletion/', name: 'data-deletion' },
  ];

  for (const sp of subpages) {
    console.log(`Capturing subpage ${sp.name}...`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const page = await context.newPage();
    const errors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(`${baseUrl}${sp.route}`, { waitUntil: 'networkidle' });

    if (errors.length > 0) {
      console.warn(`[WARN] Console errors on ${sp.route}:`, errors);
    }

    // Check horizontal overflow
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (overflow) {
      console.error(`[ERROR] Horizontal overflow on ${sp.route} at 1440px!`);
    }

    await page.screenshot({ path: path.join(outDir, `page-${sp.name}-1440.png`), fullPage: true });

    // Also check mobile 390px
    await page.setViewportSize({ width: 390, height: 844 });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (mobileOverflow) {
      console.error(`[ERROR] Horizontal overflow on ${sp.route} at 390px!`);
    }
    await page.screenshot({ path: path.join(outDir, `page-${sp.name}-390.png`), fullPage: true });

    await context.close();
  }

  await browser.close();
  server.close();
  console.log('✅ All screenshots saved successfully to:', outDir);
}

capture().catch((e) => {
  console.error(e);
  process.exit(1);
});
