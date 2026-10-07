import { chromium } from 'playwright';
import path from 'path';
import fs from 'fs';

const dateStr = '2026-10-07';
const baseDir = path.resolve(`verification/screenshots/${dateStr}-nav/before`);
fs.mkdirSync(baseDir, { recursive: true });

const routes = [
  '/', '/about/', '/build/', '/cafe/', '/events/', '/gear/', '/goals/',
  '/latest/', '/links/', '/now/', '/press/', '/privacy/', '/services/', '/work/',
  '/brands/be-unconventional-hq/', '/brands/hey-this-is-andrew/', '/brands/capture-create-caffeinate/'
];

async function run() {
  const browser = await chromium.launch();
  const baseUrl = 'http://127.0.0.1:8080/hey-this-is-andrew';
  
  for (const route of routes) {
    const url = baseUrl + route;
    console.log(`Shooting ${url}`);
    
    // 390x844
    let context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    let page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    const name = route === '/' ? 'home' : route.replace(/\//g, '-').replace(/^-|-$/g, '');
    await page.screenshot({ path: path.join(baseDir, `${name}-390.png`), fullPage: true });
    await context.close();
    
    // 1440x900
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    page = await context.newPage();
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.screenshot({ path: path.join(baseDir, `${name}-1440.png`), fullPage: true });
    
    // Open dropdown at 85% scroll on homepage
    if (route === '/') {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.85));
      await page.waitForTimeout(500);
      
      const dropdowns = ['Home', 'Build in Public', 'Gear', 'The Cafe', 'About'];
      for (const dd of dropdowns) {
        try {
          await page.locator('.nav-item').filter({ hasText: dd }).first().hover();
          await page.waitForTimeout(500);
          await page.screenshot({ path: path.join(baseDir, `home-1440-dropdown-${dd.replace(/\s+/g, '-')}.png`) });
        } catch (e) {
          console.log('Could not hover', dd);
        }
      }
    }
    
    await context.close();
  }
  
  await browser.close();
}

run().catch(err => { console.error(err); process.exit(1); });
