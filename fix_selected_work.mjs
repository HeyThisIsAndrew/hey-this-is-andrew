import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/components/SelectedWork.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace("import ExpandSection from '@andrew/ui/ExpandSection.astro';", "import Accordion from '@andrew/ui/Accordion.astro';\nimport AccordionRow from '@andrew/ui/AccordionRow.astro';");

const expandStart = src.indexOf('<ExpandSection');
const expandEnd = src.indexOf('</ExpandSection>') + '</ExpandSection>'.length;

const newExpand = `
    <div class="sw-accordion-wrapper">
      <Accordion>
        <AccordionRow id="work-archive" kicker="Archive" title={\`All Work (\${restVideos.length + restProjects.length})\`}>
          <div class="sw-expanded">
            {restVideos.length > 0 && (
              <div class="sw-videos-extra">
                {restVideos.map(v => <LatestCard item={v} />)}
              </div>
            )}
            
            {restProjects.length > 0 && (
              <div class="sw-projects-extra sw-projects">
                {restProjects.map(p => <ProjectCard project={p} />)}
              </div>
            )}
            
            <div id="workflow" class="sw-workflow">
              <WorkflowStrip />
            </div>
          </div>
        </AccordionRow>
      </Accordion>
    </div>
`;

src = src.slice(0, expandStart) + newExpand + src.slice(expandEnd);
fs.writeFileSync(p, src);
