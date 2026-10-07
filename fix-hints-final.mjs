import fs from 'fs';

function removeRegex(path, regex, repl = '') {
  let c = fs.readFileSync(path, 'utf8');
  c = c.replace(regex, repl);
  fs.writeFileSync(path, c);
}

// 1. ABOUT SECTION
removeRegex('sites/hey-this-is-andrew/src/components/AboutSection.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/g, "");

// 2. GOALS SUMMARY
removeRegex('sites/hey-this-is-andrew/src/components/GoalsSummary.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/g, "");

// 3. KIT SECTION
removeRegex('sites/hey-this-is-andrew/src/components/KitSection.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/g, "");

// 4. BUILD ASTRO
removeRegex('sites/hey-this-is-andrew/src/pages/build.astro', /const rawBase = import\.meta\.env\.BASE_URL;\s*/g, "");

// 5. LATEST CONTENT (tag)
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /function tag\(xml: string, name: string\): string \| null \{\s*\}/g, "");
// wait, I already removed the body of tag, so it's just an empty function now.
// Let's just remove the word "function tag" and everything up to "null {" and the "}" 
// actually I'll just remove `function tag\(.*\}|function tag\(.*`
removeRegex('sites/hey-this-is-andrew/src/lib/latest-content.ts', /function tag\(xml: string, name: string\): string \| null \{\s*\}/g, "");

