import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  let errors = 0;
  
  // Track console logs
  page.on('console', msg => {
    if (msg.type() === 'error' || msg.type() === 'warning') {
      console.log(`[Console ${msg.type()}] ${msg.text()}`);
      if (msg.type() === 'error') {
         errors++;
      }
    }
  });

  page.on('pageerror', error => {
     console.error(`[Page Error] ${error.message}`);
     errors++;
  });

  // Check network requests for /api/feed.json
  let foundFeedJson = false;
  page.on('response', response => {
    if (response.url().includes('/api/feed.json')) {
      foundFeedJson = true;
      console.log(`[Network] /api/feed.json returned ${response.status()}`);
      if (!response.ok()) {
        console.error(`[Network Error] /api/feed.json failed with status ${response.status()}`);
        errors++;
      }
    }
  });

  console.log('Navigating to http://localhost:4321/feed...');
  await page.goto('http://localhost:4321/feed', { waitUntil: 'networkidle0' });

  // Check SEO tags
  const title = await page.title();
  console.log(`[SEO] Title: ${title}`);
  
  const metaDesc = await page.$eval('meta[name="description"]', el => el.content).catch(() => null);
  console.log(`[SEO] Meta Description: ${metaDesc ? 'Found' : 'Missing'}`);
  
  const ogTitle = await page.$eval('meta[property="og:title"]', el => el.content).catch(() => null);
  console.log(`[SEO] OG Title: ${ogTitle ? 'Found' : 'Missing'}`);
  
  if (!title || !metaDesc || !ogTitle) {
      console.error('[SEO Error] Missing critical SEO tags.');
      errors++;
  }
  
  if (!foundFeedJson) {
      console.log('[Network] /api/feed.json was not requested by the feed page during initial load. This might be fine if it loads on interaction.');
  }

  await browser.close();

  if (errors > 0) {
    console.error(`Health check failed with ${errors} errors.`);
    process.exit(1);
  } else {
    console.log('Health check passed flawlessly.');
    process.exit(0);
  }
})();
