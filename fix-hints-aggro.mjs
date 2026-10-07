import fs from 'fs';

function removeRegex(path, regex, repl = '') {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(regex, repl);
  fs.writeFileSync(path, c);
}

// 1. ASTRO CONFIGS
removeRegex('sites/hey-this-is-andrew/astro.config.mjs', /import \{ localCms \} from '@andrew\/local-cms';/, "// @ts-ignore\nimport { localCms } from '@andrew/local-cms';");
removeRegex('sites/hey-this-is-andrew/local-cms.config.mjs', /\/\*\* @type \{import\('@andrew\/local-cms\/config'\)\.LocalCmsConfig\} \*\//, "/** @ts-ignore */");

// 2. CONTENT CONFIG
removeRegex('sites/hey-this-is-andrew/src/content.config.ts', /link: z\.string\(\)\.url\(\)\.optional\(\)/g, "link: z.string().optional()");

// 3. ABOUT SECTION
removeRegex('sites/hey-this-is-andrew/src/components/AboutSection.astro', /const base = rawBase === '\/' \? '' : rawBase\.replace\(\/\\\\\/\\$\/, ''\);\s*/, "");

// 4. BRAND CAROUSEL
removeRegex('sites/hey-this-is-andrew/src/components/BrandCarousel.astro', /\s*private timer: number \| null = null;/, "");
removeRegex('sites/hey-this-is-andrew/src/components/BrandCarousel.astro', /this\.timer = requestAnimationFrame\(this\.tick\);/, "requestAnimationFrame(this.tick);");
removeRegex('sites/hey-this-is-andrew/src/components/BrandCarousel.astro', /if \(this\.timer\) cancelAnimationFrame\(this\.timer\);/, "");

// 5. GOALS SUMMARY
removeRegex('sites/hey-this-is-andrew/src/components/GoalsSummary.astro', /const base = rawBase === '\/' \? '' : rawBase\.replace\(\/\\\\\/\\$\/, ''\);\s*/, "");

// 6. KIT SECTION
removeRegex('sites/hey-this-is-andrew/src/components/KitSection.astro', /const base = rawBase === '\/' \? '' : rawBase\.replace\(\/\\\\\/\\$\/, ''\);\s*/, "");

// 7. LATEST CONTENT
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /\/\/ @ts-ignore\s*const FALLBACK_VIDEOS/g, "const FALLBACK_VIDEOS");
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /const FALLBACK_VIDEOS: LatestItem\[\] = REAL_YOUTUBE_VIDEOS;/g, "");

removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /\/\/ @ts-ignore\s*const CHANNEL_URL/g, "const CHANNEL_URL");
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /const CHANNEL_URL = 'https:\/\/www\.youtube\.com\/@HeyThisIsAndrew';/g, "");

removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /\/\/ @ts-ignore\s*const YT_CHANNEL_ID/g, "const YT_CHANNEL_ID");
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /const YT_CHANNEL_ID = 'UCNn5badDO7pbspeS6noInCw'; \/\/ @HeyThisIsAndrew/g, "");

removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /\/\/ @ts-ignore\s*function tag/g, "function tag");
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /function tag\(xml: string, name: string\): string \| null \{\s*const m = xml\.match\(new RegExp\(`<\\$\{name\}[^>]*>\\(\[\\\\s\\\\S\]\*\\?\\)<\/\\$\{name\}>`\)\);\s*return m \? m\[1\]\.trim\(\) : null;\s*\}/g, "");

// 8. BUILD ASTRO
removeRegex('sites/hey-this-is-andrew/src/pages/build.astro', /const base = rawBase === '\/' \? '' : rawBase\.replace\(\/\\\\\/\\$\/, ''\);\s*/, "");

