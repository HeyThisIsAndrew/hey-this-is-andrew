import { spawn } from 'node:child_process';
import puppeteer from 'puppeteer';

const PORT = 4321;
const BASE_URL = `http://localhost:${PORT}`;

const ROUTES_TO_TEST = [
  '/',
  '/feed',
  '/events',
  '/featured'
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log('Starting Astro preview server...');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const server = spawn(npmCmd, ['run', 'preview'], {
    stdio: 'pipe',
    shell: false,
  });

  let serverReady = false;

  server.stdout.on('data', (data) => {
    const output = data.toString();
    // console.log(`Server stdout: ${output}`); // uncomment for debug
    if (output.includes(`http://localhost:${PORT}`) || output.includes('ready in') || output.includes('listening on')) {
      serverReady = true;
    }
  });

  server.stderr.on('data', () => {
    // Astro might write info or errors to stderr
    // console.error(`Server stderr: ${data.toString()}`);
  });

  // Give the server up to 15 seconds to start
  let attempts = 0;
  while (!serverReady && attempts < 30) {
    await sleep(500);
    attempts++;
  }

  if (!serverReady) {
    console.error('Server failed to start in a reasonable time.');
    server.kill();
    process.exit(1);
  }

  console.log('Server is ready. Starting Puppeteer...');
  
  let browser;
  let hasErrors = false;

  try {
    browser = await puppeteer.launch({
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    for (const route of ROUTES_TO_TEST) {
      console.log(`\nNavigating to ${route}...`);
      const page = await browser.newPage();
      
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          console.error(`[Console Error on ${route}]: ${msg.text()}`);
          hasErrors = true;
        }
      });

      page.on('pageerror', (err) => {
        console.error(`[Page Error on ${route}]: ${err.message}`);
        hasErrors = true;
      });

      await page.goto(`${BASE_URL}${route}`, { waitUntil: 'networkidle2', timeout: 30000 });
      await sleep(1000); // Wait an extra second for delayed client-side errors
      
      await page.close();
    }

  } catch (err) {
    console.error(`[Script Error]: ${err.message}`);
    hasErrors = true;
  } finally {
    if (browser) {
      await browser.close();
    }
    
    console.log('\nKilling Astro preview server...');
    server.kill();
  }

  if (hasErrors) {
    console.log('\n--- FAIL ---');
    process.exit(1);
  } else {
    console.log('\n--- PASS ---');
    process.exit(0);
  }
}

run();
