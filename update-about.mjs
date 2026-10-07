import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/components/AboutSection.astro';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(
  "import BrandAccordion from './BrandAccordion.astro';",
  "import BrandAccordion from './BrandAccordion.astro';\nimport ExpandSection from '@andrew/ui/ExpandSection.astro';\nimport NowBand from './NowBand.astro';"
);

c = c.replace(
  /<div class="about-now reveal"[\s\S]*?<\/div>/,
  `      <div class="about-now reveal" style="--rd: 240ms">
        <span class="about-now-items">
          {NOW_ITEMS.map((item, i) => (
            <span class="about-now-item">
              {i > 0 && <span class="about-now-sep">/</span>}
              <span class="about-now-key">{item.label}</span> <span class="about-now-val">{item.value}</span>
            </span>
          ))}
        </span>
        
        <ExpandSection id="now-expander" expandLabel={\`Now \${NOW_MONTH}\`} collapseLabel="Hide Now">
          <div class="about-now-full">
            <NowBand />
          </div>
        </ExpandSection>
      </div>`
);

c = c.replace(
  "  .about-now-full {\n    margin-top: 1.5rem;\n  }",
  ""
);

c += "\n<style>\n  .about-now-full {\n    margin-top: 1.5rem;\n  }\n</style>\n";

fs.writeFileSync(p, c);
