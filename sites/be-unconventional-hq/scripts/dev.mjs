import { spawn } from 'child_process';
import os from 'os';
import qrcode from 'qrcode-terminal';

const PORT = 4321;
const BASE_PATH = '/';

function getNetworkIP() {
  const nets = os.networkInterfaces();

  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (
        net.family === 'IPv4' &&
        !net.internal &&
        net.address.startsWith('192.168.')
      ) {
        return net.address;
      }
    }
  }

  return 'localhost';
}

const ip = getNetworkIP();

const localUrl = `http://localhost:${PORT}${BASE_PATH}`;
const networkUrl = `http://${ip}:${PORT}${BASE_PATH}`;

console.log('\n🚀 Dev server starting...\n');

console.log('📱 Local:');
console.log(localUrl);

console.log('\n📱 Network:');
console.log(networkUrl);

console.log('\n📲 Scan to open:');
qrcode.generate(networkUrl, { small: true });

const astro = spawn('astro', ['dev', '--host', '0.0.0.0', '--port', PORT], {
  stdio: 'inherit',
  shell: true,
});

astro.on('exit', (code) => {
  console.log(`\nAstro exited with code ${code}`);
});
