import fs from 'fs';
function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content), 'utf8');
}

replaceFile('sites/hey-this-is-andrew/src/components/LiveBanner.astro', (c) => {
  return c.replace('if(cta) cta.href =', 'if(cta) (cta as HTMLAnchorElement).href =');
});

replaceFile('sites/hey-this-is-andrew/src/components/PhotographyPortfolio.astro', (c) => {
  let r = c;
  r = r.replace(/stage\?\./g, 'stage.');
  r = r.replace('stage.style.transform = `translate(${X}px, ${Y}px) scale(${s})`;', 'if(stage) stage.style.transform = `translate(${X}px, ${Y}px) scale(${s})`;');
  r = r.replace('stage.style.transition = ms ? `transform ${ms}ms ${EASE}` : \'none\';', 'if(stage) stage.style.transition = ms ? `transform ${ms}ms ${EASE}` : \'none\';');
  r = r.replace('stage.style.transform = \'\';', 'if(stage) stage.style.transform = \'\';');
  r = r.replace('stage.style.transition = \'\';', 'if(stage) stage.style.transition = \'\';');
  r = r.replace('const sr = stage.getBoundingClientRect();\n        if (!sr) return;', 'if(!stage) return;\n        const sr = stage.getBoundingClientRect();');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/components/VideoPlayer.astro', (c) => {
  let r = c;
  r = r.replace('openFrom(resolveSource(el as HTMLElement), url, label);', 'openFrom(resolveSource((el as any) as HTMLElement), url, label);');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/lib/spatial.ts', (c) => {
  let r = c;
  r = r.replace('return (Promise.race([', 'return Promise.race([');
  r = r.replace(']) as unknown) as Promise<void>;', ']) as unknown as Promise<void>;');
  return r;
});

