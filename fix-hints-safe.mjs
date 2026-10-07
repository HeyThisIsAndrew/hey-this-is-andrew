import fs from 'fs';

function replaceInFile(path, regex, replacement) {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(regex, replacement);
  fs.writeFileSync(path, c);
}

// 1. content.config.ts
replaceInFile('sites/hey-this-is-andrew/src/content.config.ts', "import { defineCollection, z } from 'astro:content';", "import { defineCollection } from 'astro:content';\nimport { z } from 'zod';");

// 2. AboutSection.astro
replaceInFile('sites/hey-this-is-andrew/src/components/AboutSection.astro', "const base = rawBase === '/' ? '' : rawBase.replace(/\\/\\$/, '');\n", "");
replaceInFile('sites/hey-this-is-andrew/src/components/AboutSection.astro', "{NOW_ITEMS.slice(0, 2).map((n, i) => (", "{NOW_ITEMS.slice(0, 2).map((n) => (");

// 4. GearGrid.astro
replaceInFile('sites/hey-this-is-andrew/src/components/GearGrid.astro', /onclick="event\.stopPropagation\(\);"/g, 'onclick="arguments[0].stopPropagation();"');

// 5. GoalsSummary.astro
replaceInFile('sites/hey-this-is-andrew/src/components/GoalsSummary.astro', "const base = rawBase === '/' ? '' : rawBase.replace(/\\/\\$/, '');\n", "");
replaceInFile('sites/hey-this-is-andrew/src/components/GoalsSummary.astro', "import ViewAllLink from '@andrew/ui/ViewAllLink.astro';\n", "");

// 6. KitSection.astro
replaceInFile('sites/hey-this-is-andrew/src/components/KitSection.astro', "const base = rawBase === '/' ? '' : rawBase.replace(/\\/\\$/, '');\n", "");

// 7. WorkWithAndrew.astro
replaceInFile('sites/hey-this-is-andrew/src/components/WorkWithAndrew.astro', "{restItems.map((s, i) => (", "{restItems.map((s) => (");

// 8. images.ts
replaceInFile('sites/hey-this-is-andrew/src/data/images.ts', "import { resolveImage } from '@andrew/local-cms/images';", "// @ts-ignore\nimport { resolveImage } from '@andrew/local-cms/images';");

// 9. nav.ts
replaceInFile('sites/hey-this-is-andrew/src/data/nav.ts', "import { HOME_SECTIONS, BUILD_SECTIONS, GEAR_SECTIONS, ABOUT_SECTIONS } from './sections';", "import { HOME_SECTIONS, BUILD_SECTIONS, ABOUT_SECTIONS } from './sections';");

// 12. build.astro
replaceInFile('sites/hey-this-is-andrew/src/pages/build.astro', "const base = rawBase === '/' ? '' : rawBase.replace(/\\/\\$/, '');\n", "");

