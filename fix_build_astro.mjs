import fs from 'fs';

const p = 'sites/hey-this-is-andrew/src/pages/build.astro';
let src = fs.readFileSync(p, 'utf8');

// 1. Add getCollection import
src = src.replace("import SectionHeader from '@andrew/ui/SectionHeader.astro';", "import SectionHeader from '@andrew/ui/SectionHeader.astro';\nimport Accordion from '@andrew/ui/Accordion.astro';\nimport AccordionRow from '@andrew/ui/AccordionRow.astro';\nimport { getCollection } from 'astro:content';\n\nconst goalsCollection = await getCollection('goals');\ngoalsCollection.sort((a, b) => a.data.order - b.data.order);");

// 2. Replace the sections with the Accordion
const replaceStart = src.indexOf('<!-- 1. Primary Focus');
const replaceEnd = src.indexOf('</section>\n  </div>\n</BaseLayout>');

const newContent = `
    <Accordion>
      {goalsCollection.map((group) => {
        const doneCount = group.data.items.filter(i => i.status === 'done').length;
        const total = group.data.items.length;
        return (
          <AccordionRow
            id={\`goal-\${group.id}\`}
            kicker="Goal Group"
            title={group.data.title}
            progressCount={doneCount}
            progressTotal={total}
          >
            <ul class="checklist-container" style="padding-top: 1.5rem;">
              {group.data.items.map(item => (
                <li class:list={['checklist-card', { completed: item.status === 'done' }]}>
                  <div class="checklist-left">
                    <span class:list={['checklist-mark', { 'is-done': item.status === 'done' }]} aria-hidden="true">
                      {item.status === 'done' && (
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="square" /></svg>
                      )}
                    </span>
                    <div class="checklist-info">
                      <h3 class="checklist-title">{item.label}</h3>
                      {item.note && <p class="checklist-desc">{item.note}</p>}
                    </div>
                  </div>
                  <div class:list={['status-badge', item.status === 'done' ? 'achieved' : item.status]}>
                    {item.status === 'in-progress' && <span class="pulse-indicator"></span>}
                    <span class="badge-text">{item.status === 'done' ? 'Done' : item.status === 'in-progress' ? 'In Progress' : 'Queued'}</span>
                  </div>
                </li>
              ))}
            </ul>
          </AccordionRow>
        );
      })}

      <AccordionRow
        id="core-engine"
        kicker="Primary Milestones · HEY_THISISANDREW"
        title="Core Engine"
        progressCount={doneCount}
        progressTotal={MILESTONES.length}
      >
        <div style="padding-top: 1.5rem;">
          <ul class="checklist-container">
            {MILESTONES.map((m) => (
              <li class:list={['checklist-card', { completed: m.status === 'done' }]} data-milestone-card={m.id}>
                <div class="checklist-left">
                  <span class:list={['checklist-mark', { 'is-done': m.status === 'done' }]} aria-hidden="true">
                    {m.status === 'done' && (
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none"><path d="M3 8.5l3 3 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="square" /></svg>
                    )}
                  </span>
                  <div class="checklist-info">
                    <h3 class="checklist-title">{m.title}</h3>
                    <p class="checklist-desc">{m.desc}</p>
                  </div>
                </div>
                <div class:list={['status-badge', m.status === 'done' ? 'achieved' : m.status]}>
                  {m.status === 'in-progress' && <span class="pulse-indicator"></span>}
                  <span class="badge-text">{STATUS_LABEL[m.status]}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </AccordionRow>

      <AccordionRow
        id="be"
        kicker="BE Unconventional HQ"
        title="Entertainment Outlet"
      >
        <div style="padding-top: 1.5rem;">
          <div class="progression-stages-grid">
            <div class="progression-stage-item">
              <div class="stage-bar achieved"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 01</span>
                <span class="stage-badge achieved">Achieved</span>
              </div>
              <h4 class="stage-name">Foundation</h4>
              <p class="stage-detail">Independent editorial calendar and breaking coverage system.</p>
            </div>
            <div class="progression-stage-item">
              <div class="stage-bar active"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 02</span>
                <span class="stage-badge active">Active Target</span>
              </div>
              <h4 class="stage-name">On-Site Access</h4>
              <p class="stage-detail">Major event press credentials and live floor coverage.</p>
            </div>
            <div class="progression-stage-item">
              <div class="stage-bar upcoming"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 03</span>
                <span class="stage-badge upcoming">Upcoming</span>
              </div>
              <h4 class="stage-name">Commercial Integration</h4>
              <p class="stage-detail">Paid event photography and marketing partnerships.</p>
            </div>
            <div class="progression-stage-item">
              <div class="stage-bar target"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 04</span>
                <span class="stage-badge target">Target</span>
              </div>
              <h4 class="stage-name">Industry Milestone</h4>
              <p class="stage-detail">Critics Choice Association (CCA) accreditation.</p>
            </div>
          </div>
        </div>
      </AccordionRow>

      <AccordionRow
        id="ccc"
        kicker="Capture Create Caffeinate"
        title="Commercial Beverage"
      >
        <div style="padding-top: 1.5rem;">
          <div class="progression-stages-grid">
            <div class="progression-stage-item">
              <div class="stage-bar achieved"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 01</span>
                <span class="stage-badge achieved">Achieved</span>
              </div>
              <h4 class="stage-name">System Setup</h4>
              <p class="stage-detail">Native 9:16 capture pipeline and portfolio build.</p>
            </div>
            <div class="progression-stage-item">
              <div class="stage-bar active"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 02</span>
                <span class="stage-badge active">Active Target</span>
              </div>
              <h4 class="stage-name">Local Penetration</h4>
              <p class="stage-detail">San Diego roasters and cocktail lounge retainers.</p>
            </div>
            <div class="progression-stage-item">
              <div class="stage-bar upcoming"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 03</span>
                <span class="stage-badge upcoming">Upcoming</span>
              </div>
              <h4 class="stage-name">Digital Products</h4>
              <p class="stage-detail">Lightroom drink presets and lighting recipe guides.</p>
            </div>
            <div class="progression-stage-item">
              <div class="stage-bar target"></div>
              <div class="stage-meta">
                <span class="stage-num font-mono">Stage 04</span>
                <span class="stage-badge target">Target</span>
              </div>
              <h4 class="stage-name">National Campaigns</h4>
              <p class="stage-detail">Commercial beverage brand contracts and licensing.</p>
            </div>
          </div>
        </div>
      </AccordionRow>
    </Accordion>
`;

src = src.slice(0, replaceStart) + newContent + src.slice(replaceEnd);
fs.writeFileSync(p, src);
