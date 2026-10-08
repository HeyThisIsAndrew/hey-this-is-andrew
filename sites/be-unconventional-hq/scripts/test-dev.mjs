process.env.ASTRO_TELEMETRY_DISABLED = '1';

import { dev } from 'astro';

async function main() {
  console.log('Calling astro dev()...');
  try {
    const devServer = await dev({
      root: '.',
      server: { port: 4321, host: 'localhost' }
    });
    console.log('Dev server created successfully!');
    
    const res = await fetch('http://localhost:4321');
    console.log('Response status:', res.status);
    const html = await res.text();
    console.log('HTML snippet:', html.slice(0, 200));

    await devServer.stop();
    console.log('Dev server stopped.');
  } catch (err) {
    console.error('Error starting dev server programmatically:', err);
  }
}

main();
