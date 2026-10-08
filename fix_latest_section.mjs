import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/components/LatestSection.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace("import ExpandSection from '@andrew/ui/ExpandSection.astro';", "import Accordion from '@andrew/ui/Accordion.astro';\nimport AccordionRow from '@andrew/ui/AccordionRow.astro';");

const expandStart = src.indexOf('<ExpandSection');
const expandEnd = src.indexOf('</ExpandSection>') + '</ExpandSection>'.length;

const newExpand = `
      <div class="latest-accordion-wrapper" style="margin-top: 2rem;">
        <Accordion>
          <AccordionRow id="latest-archive" kicker="Archive" title={\`All Latest (\${restItems.length})\`}>
            <div style="padding-top: 1.5rem;">
              <LatestFeed items={restItems} id="latest-rest" />
              <p class="latest-links">
                <a href={SUBSTACK_URL} target="_blank" rel="noopener">Read everything on Substack</a>
                <a href={\`\${base}/rss.xml\`}>RSS feed for the writing</a>
              </p>
            </div>
          </AccordionRow>
        </Accordion>
      </div>
`;

src = src.slice(0, expandStart) + newExpand + src.slice(expandEnd);
fs.writeFileSync(p, src);
