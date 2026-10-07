import fs from 'fs';
function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content), 'utf8');
}

replaceFile('sites/hey-this-is-andrew/src/components/GoalsChecklist.astro', (c) => {
  return c.replace('group.slug || ', '(group as any).slug || ');
});

replaceFile('sites/hey-this-is-andrew/src/components/LiveBanner.astro', (c) => {
  let r = c.replace('const cta = banner.querySelector(\'.live-cta\');', 'const cta = banner.querySelector<HTMLAnchorElement>(\'.live-cta\');');
  r = r.replace('function show(videoId) {', 'function show(videoId: string) {');
  r = r.replace('function writeCache(data) {', 'function writeCache(data: any) {');
  r = r.replace('cta.href', 'if(cta) cta.href');
  r = r.replace('banner.hidden = false;', 'if(banner) banner.hidden = false;');
  r = r.replace('banner.hidden = true;', 'if(banner) banner.hidden = true;');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/components/PhotographyPortfolio.astro', (c) => {
  let r = c;
  r = r.replace('reel.anim.currentTime = cur +', 'reel.anim.currentTime = (cur as number) +');
  r = r.replace(/stage\./g, 'stage?.');
  r = r.replace(/stage\.style/g, 'stage?.style'); // in case it missed
  r = r.replace('const sr = stage.getBoundingClientRect();', 'const sr = stage?.getBoundingClientRect();\n        if (!sr) return;');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/components/VideoPlayer.astro', (c) => {
  let r = c;
  r = r.replace('triggerVideo(el);', 'triggerVideo(el as HTMLElement);');
  r = r.replace('triggerVideo(el);', 'triggerVideo(el as HTMLElement);');
  r = r.replace('openFrom(resolveSource(el), url, label);', 'openFrom(resolveSource(el as HTMLElement), url, label);');
  return r;
});

replaceFile('sites/hey-this-is-andrew/src/lib/spatial.ts', (c) => {
  let r = c;
  r = r.replace('return Promise.race([', 'return (Promise.race([');
  r = r.replace(']).then(() => {});', ']) as unknown) as Promise<void>;');
  return r;
});

