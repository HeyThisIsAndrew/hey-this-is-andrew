import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/components/NewsletterSignup.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace('.newsletter-row {\n    display: flex;\n    gap: 0;\n    position: relative;\n  }', '.newsletter-row {\n    display: flex;\n    gap: 0;\n  }');

src = src.replace('.newsletter-input {\n    flex: 1;\n    min-width: 0;\n    padding-right: 120px; /* space for absolute button */', '.newsletter-input {\n    flex: 1;\n    min-width: 0;');

src = src.replace('.newsletter-btn { \n    flex: none;\n    position: absolute;\n    right: 4px;\n    top: 4px;\n    bottom: 4px;\n    min-height: calc(var(--btn-h-md) - 8px);\n    margin: 0;\n    padding: 0 1.25rem;\n  }', '.newsletter-btn { flex: none; }');

fs.writeFileSync(p, src);
