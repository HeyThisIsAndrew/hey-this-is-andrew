import { chromium } from 'playwright';
import path from 'path';

const dateStr = '2026-10-07';
const baseDir = path.resolve(`verification/screenshots/${dateStr}-nav/before`);

async function run() {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:8080/hey-this-is-andrew/', { waitUntil: 'networkidle' });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.85));
  await page.waitForTimeout(500);
  
  const buttons = await page.locator('nav button').all();
  for (let i = 0; i < buttons.length; i++) {
    const text = await buttons[i].textContent();
    if (text.trim()) {
      await buttons[i].hover();
      await page.waitForTimeout(500);
      await page.screenshot({ path: path.join(baseDir, `home-1440-dropdown-${text.trim().replace(/\s+/g, '-')}.png`) });
    }
  }
  await context.close();
  await browser.close();
}
run().catch(console.error);
