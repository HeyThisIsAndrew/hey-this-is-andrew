import fs from 'fs';
let p = 'sites/hey-this-is-andrew/src/pages/kit.astro';
let c = fs.readFileSync(p, 'utf8');

const importStatement = `import SectionHeader from '@andrew/ui/SectionHeader.astro';
import ViewAllLink from '@andrew/ui/ViewAllLink.astro';
import PhotoElevator from '@andrew/ui/PhotoElevator.astro';
import portrait from '../assets/hero-media/portrait.jpg';
import beStill from '../assets/hero-media/be-hq-still.jpg';
import cccPour from '../assets/hero-media/ccc-pour.jpg';

const dummyPhotos = [
  { id: '1', image: portrait, caption: 'Portrait', category: 'Portrait', location: 'Studio', video: false },
  { id: '2', image: beStill, caption: 'BE HQ', category: 'HQ', location: 'Office', video: false },
  { id: '3', image: cccPour, caption: 'Pour', category: 'coffee', location: 'Cafe', video: false },
  { id: '4', image: portrait, caption: 'Portrait 2', category: 'Portrait', location: 'Studio', video: false },
];
`;

c = c.replace("import SectionHeader from '@andrew/ui/SectionHeader.astro';\nimport ViewAllLink from '@andrew/ui/ViewAllLink.astro';", importStatement);

const elevatorSection = `
    <section class="kit-section">
      <h3>PhotoElevator</h3>
      <PhotoElevator photos={dummyPhotos} />
    </section>
  </div>
`;

c = c.replace("  </div>\n</BaseLayout>", elevatorSection + "</BaseLayout>");
fs.writeFileSync(p, c);
