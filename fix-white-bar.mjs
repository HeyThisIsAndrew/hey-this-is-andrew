import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/styles/global.css';
let c = fs.readFileSync(p, 'utf8');
c = c.replace('z-index: 9999;', 'z-index: 140;');
c = c.replace('html.bacc-view-open .scroll-progress-bar,', 'html.bacc-view-open .scroll-progress-bar,\nhtml:has(.menu-btn[aria-expanded="true"]) .scroll-progress-bar,\nhtml:has(.nav-link[aria-expanded="true"]) .scroll-progress-bar,');
fs.writeFileSync(p, c);
