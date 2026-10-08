import puppeteer from 'puppeteer';
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  await page.goto('http://localhost:4321', { waitUntil: 'networkidle2' });
  await page.waitForTimeout(3000); // Wait for autoplay fade in
  await page.screenshot({ path: 'screenshot.png' });
  await browser.close();
})();
