import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  await page.goto('http://localhost:4321/admin#/structure/event;5b2a55c2-169f-4cbf-ba60-359969100b4f', { waitUntil: 'networkidle0' });
  
  await new Promise(r => setTimeout(r, 3000));
  
  const text = await page.evaluate(() => document.body.innerText);
  console.log('--- EXTRACTED TEXT ---');
  console.log(text);
  console.log('----------------------');

  await browser.close();
})();
