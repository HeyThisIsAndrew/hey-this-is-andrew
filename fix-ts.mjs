import fs from 'fs';
function replaceFile(path, replacer) {
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, replacer(content), 'utf8');
}

replaceFile('sites/hey-this-is-andrew/src/components/SiteSearch.astro', (c) => {
  return c.replace('this.clearBtn.hidden = true;', 'if (this.clearBtn) this.clearBtn.hidden = true;');
});

replaceFile('sites/hey-this-is-andrew/src/components/VideoPlayer.astro', (c) => {
  let result = c;
  result = result.replace('let closeZoom = null;', 'let closeZoom: (() => void) | null = null;');
  result = result.replace('let unlock = null;', 'let unlock: (() => void) | null = null;');
  result = result.replace('let untrap = null;', 'let untrap: (() => void) | null = null;');
  
  result = result.replace('if (player.hidden) return;', 'if (!player || player.hidden) return;');
  result = result.replace('player.hidden = false;', 'if (!player) return;\n      player.hidden = false;');
  
  result = result.replace('function resolveSource(trigger) {', 'function resolveSource(trigger: HTMLElement) {');
  result = result.replace('function triggerVideo(el) {', 'function triggerVideo(el: HTMLElement) {');
  
  result = result.replace("const el = e.target.closest('[data-video-player]');", "if (!(e.target instanceof Element)) return;\n      const el = e.target.closest('[data-video-player]');");
  result = result.replace("const el = e.target.closest?.('[data-video-player][role=\"button\"]');", "if (!(e.target instanceof Element)) return;\n      const el = e.target.closest?.('[data-video-player][role=\"button\"]');");
  result = result.replace("if (e.target.closest('[data-vp-close]')) close();", "if (e.target instanceof Element && e.target.closest('[data-vp-close]')) close();");

  return result;
});

replaceFile('sites/hey-this-is-andrew/src/lib/network.ts', (c) => {
  let result = c;
  result = result.replace('const live = items.filter((i): i is NetworkItem => i !== null);', 'const live = items.filter((i) => i !== null) as NetworkItem[];');
  return result;
});

replaceFile('sites/hey-this-is-andrew/src/lib/spatial.ts', (c) => {
  let result = c;
  result = result.replace('return Promise.race([', 'return Promise.race([');
  // Actually we need to add `.then(() => {})` or cast.
  result = result.replace(/return Promise\.race\(\[\s*animation\.finished,\s*new Promise\(\(resolve\) => setTimeout\(resolve, timeoutMs\)\)\s*\]\);/s, 'return Promise.race([\n      animation.finished,\n      new Promise((resolve) => setTimeout(resolve, timeoutMs))\n    ]).then(() => {});');
  return result;
});
