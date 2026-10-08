import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/components/NewsletterSignup.astro';
let src = fs.readFileSync(p, 'utf8');

src = src.replace('.newsletter-row {\n    display: flex;\n    gap: 0.75rem;\n  }', '.newsletter-row {\n    display: flex;\n    gap: 0;\n    position: relative;\n  }');

src = src.replace('.newsletter-input {\n    flex: 1;\n    min-width: 0;', '.newsletter-input {\n    flex: 1;\n    min-width: 0;\n    padding-right: 120px; /* space for absolute button */');

src = src.replace('.newsletter-btn { flex: none; }', `.newsletter-btn { 
    flex: none;
    position: absolute;
    right: 4px;
    top: 4px;
    bottom: 4px;
    min-height: calc(var(--btn-h-md) - 8px);
    margin: 0;
    padding: 0 1.25rem;
  }`);

fs.writeFileSync(p, src);
