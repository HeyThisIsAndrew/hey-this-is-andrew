import fs from 'fs';

function removeRegex(path, regex, repl = '') {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(regex, repl);
  fs.writeFileSync(path, c);
}

// 1. ABOUT SECTION
removeRegex('sites/hey-this-is-andrew/src/components/AboutSection.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/, "");

// 2. GOALS SUMMARY
removeRegex('sites/hey-this-is-andrew/src/components/GoalsSummary.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/, "");

// 3. KIT SECTION
removeRegex('sites/hey-this-is-andrew/src/components/KitSection.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/, "");

// 4. BUILD ASTRO
removeRegex('sites/hey-this-is-andrew/src/pages/build.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/, "");

// 5. ASTRO CONFIG
removeRegex('sites/hey-this-is-andrew/astro.config.mjs', /\/\/ @ts-ignore\s*/g, "");
removeRegex('sites/hey-this-is-andrew/astro.config.mjs', /import \{ localCms \} from '@andrew\/local-cms';/, "// @ts-ignore\nimport { localCms } from '@andrew/local-cms';");

// 6. spatial.ts
removeRegex('sites/hey-this-is-andrew/src/lib/spatial.ts', /export function flipRect/, "export async function flipRect");

