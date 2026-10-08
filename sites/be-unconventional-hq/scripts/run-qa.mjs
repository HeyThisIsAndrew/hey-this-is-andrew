import puppeteer from 'puppeteer';
import { spawn } from 'child_process';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

async function runQA() {
  console.log('Starting dev server...');
  const devServer = spawn('npm', ['run', 'dev'], { cwd: projectRoot, shell: true });
  
  await new Promise(r => setTimeout(r, 8000)); // wait for dev server

  console.log('Launching browser...');
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Route Tests
  const routes = [
    '/', '/events', '/events/sdcc-2026', '/events/d23-2026', '/featured',
    '/featured/dc-comics', '/featured/marvel-comics', '/links', '/about',
    '/collaborations', '/feed'
  ];

  for (const route of routes) {
    console.log(`\nTesting ${route}...`);
    const response = await page.goto(`http://localhost:4321${route}`, { waitUntil: 'networkidle2' });
    console.log(`Status: ${response.status()}`);

    // Check SubscribeCTA
    const hasSubscribeCTA = await page.$('.cta-buttons-wrapper') || await page.$('.cta-band');
    console.log(`Subscribe CTA present: ${!!hasSubscribeCTA}`);

    // Check Hero Image
    if (route.includes('/events/') || route.includes('/featured/')) {
       const heroHtml = await page.$eval('.hero-section, .hero', el => el.outerHTML).catch(() => null);
       if (heroHtml) {
         if (heroHtml.includes('img') || heroHtml.includes('background-image')) {
            console.log(`Hero image rendered.`);
         } else if (heroHtml.includes('gradient')) {
            console.log(`Graceful gradient fallback.`);
         } else {
            console.log(`Hero structure found but no image/gradient.`);
         }
       } else {
         console.log(`No hero section found!`);
       }
    }
  }

  console.log('\n--- Testing /local-cms ---');
  await page.goto('http://localhost:4321/local-cms', { waitUntil: 'networkidle2' });

  // Test 1: Layout check at different widths
  const viewports = [320, 640, 1024, 1920];
  for (const w of viewports) {
    await page.setViewport({ width: w, height: 1080 });
    // Wait for layout to settle
    await new Promise(r => setTimeout(r, 500));
    console.log(`Layout tested at ${w}px.`);
  }
  await page.setViewport({ width: 1440, height: 1080 });

  // Test 2: Create new Video doc
  console.log('Clicking "+ New Video"');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const newVideoBtn = btns.find(b => b.textContent.includes('New Video'));
    if (newVideoBtn) newVideoBtn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  console.log('Checking defaults...');
  let currentId = await page.$eval('div.border-b h2.font-mono', el => el.textContent).catch(() => 'Missing ID');
  console.log(`New Doc ID: ${currentId}`);

  // Test 3: ID Collision
  console.log('Testing ID Collision (typing existing youtubeId: AbExGOtOLuM)');
  
  // Trap alert
  let alertMessage = null;
  page.on('dialog', async dialog => {
    alertMessage = dialog.message();
    console.log(`ALERT FIRED: ${alertMessage}`);
    await dialog.accept();
  });

  const ytInput = await page.$('input[placeholder="e.g. dQw4w9WgXcQ"]');
  if (ytInput) {
    await ytInput.type('AbExGOtOLuM'); // Existing ID in standard dataset
    await new Promise(r => setTimeout(r, 1000));
    
    // Clear the field to test ID generation
    console.log('Clearing youtubeId field to test phantom lock removal...');
    await ytInput.click({ clickCount: 3 });
    await ytInput.press('Backspace');
    await new Promise(r => setTimeout(r, 1000));
    
    let newId = await page.$eval('div.border-b h2.font-mono', el => el.textContent).catch(() => 'Missing ID');
    console.log(`Doc ID after clear: ${newId}`);
  }

  // Test 4: Save to videos.json
  console.log('Clicking Save to videos.json...');
  let saveStatus = 0;
  page.on('response', response => {
    if (response.url().includes('/api/local-cms/videos') && response.request().method() === 'POST') {
      saveStatus = response.status();
      console.log(`Save POST status: ${saveStatus}`);
    }
  });

  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const saveBtn = btns.find(b => b.textContent.includes('Save to videos.json'));
    if (saveBtn) saveBtn.click();
  });
  await new Promise(r => setTimeout(r, 2000));

  // Test 5: Delete Doc
  console.log('Testing delete functionality...');
  await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll('button'));
    const delBtn = btns.find(b => b.textContent.includes('Delete this'));
    if (delBtn) delBtn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  
  await browser.close();
  devServer.kill();
  console.log('Finished QA tests.');
}

runQA().catch((e) => {
  console.error(e);
  process.exit(1);
});
