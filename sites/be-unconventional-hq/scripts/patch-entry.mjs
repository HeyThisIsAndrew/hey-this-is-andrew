import fs from 'node:fs';
import path from 'node:path';

const file = path.join(process.cwd(), 'dist/server/entry.mjs');
if (fs.existsSync(file)) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/new URL\(serializedManifest\.[a-zA-Z]*\)/g, 'new URL("http://localhost")');
  fs.writeFileSync(file, content, 'utf-8');
  console.log('Patched entry.mjs for preview mode');
}
