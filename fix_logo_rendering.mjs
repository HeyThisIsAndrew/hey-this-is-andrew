import fs from 'fs';

// Nav.astro
const navP = 'packages/ui/src/Nav.astro';
let navSrc = fs.readFileSync(navP, 'utf8');
navSrc = navSrc.replace('.wordmark-logo {\n    display: block;\n    height: 3rem;\n    width: auto;', '.wordmark-logo {\n    display: block;\n    height: 3rem;\n    width: auto;\n    image-rendering: -webkit-optimize-contrast;\n    image-rendering: crisp-edges;');
fs.writeFileSync(navP, navSrc);

// Footer.astro
const footP = 'packages/ui/src/Footer.astro';
let footSrc = fs.readFileSync(footP, 'utf8');
footSrc = footSrc.replace('.footer-logo {\n    display: block;\n    height: 5rem;\n    width: auto;', '.footer-logo {\n    display: block;\n    height: 5rem;\n    width: auto;\n    image-rendering: -webkit-optimize-contrast;\n    image-rendering: crisp-edges;');
fs.writeFileSync(footP, footSrc);
