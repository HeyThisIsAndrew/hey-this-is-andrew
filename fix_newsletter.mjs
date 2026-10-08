import fs from 'fs';
const p = 'sites/hey-this-is-andrew/src/components/NewsletterSignup.astro';
let src = fs.readFileSync(p, 'utf8');
src = src.replace('@media (max-width: 480px) {\n    .newsletter-row { flex-direction: column; }\n    .newsletter-btn { width: 100%; }\n  }', '@media (max-width: 480px) {\n    .newsletter-row { flex-direction: column; }\n    .newsletter-btn { width: 100%; border-radius: var(--btn-radius); margin-left: 0; margin-top: 0.5rem; }\n  }');
fs.writeFileSync(p, src);
