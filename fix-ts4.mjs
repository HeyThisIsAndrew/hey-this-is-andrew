import fs from 'fs';
function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content), 'utf8');
}

replaceFile('sites/hey-this-is-andrew/src/components/PhotographyPortfolio.astro', (c) => {
  let r = c;
  r = r.replace('stage.classList.add(\'is-zoomed\');', 'if(stage) stage.classList.add(\'is-zoomed\');');
  r = r.replace('stage.classList.remove(\'is-zoomed\');', 'if(stage) stage.classList.remove(\'is-zoomed\');');
  r = r.replace('const sr = stage.getBoundingClientRect();', 'if(!stage) return;\n      const sr = stage.getBoundingClientRect();');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/components/VideoPlayer.astro', (c) => {
  let r = c;
  r = r.replace('openFrom(resolveSource((el as any) as HTMLElement), url, label);', 'openFrom(resolveSource(el as HTMLElement) as HTMLElement, url, label);');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/lib/spatial.ts', (c) => {
  let r = c;
  r = r.replace('return Promise.race([', 'return Promise.race([');
  r = r.replace(']) as unknown as Promise<void>;', ']) as any;');
  return r;
});
