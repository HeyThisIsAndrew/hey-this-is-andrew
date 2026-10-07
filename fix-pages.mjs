import fs from 'fs';

const gear = 'sites/hey-this-is-andrew/src/pages/gear.astro';
let g = fs.readFileSync(gear, 'utf8');
g = g.replace('<div class="container kit-wrap">', '<div class="container kit-wrap">\n    <section id="cafe" aria-hidden="true"></section>');
fs.writeFileSync(gear, g);

const about = 'sites/hey-this-is-andrew/src/pages/about.astro';
let a = fs.readFileSync(about, 'utf8');
a = a.replace('<div class="page-head" aria-hidden="true"></div>', '<div class="page-head" aria-hidden="true"></div>\n  <section id="story" aria-hidden="true"></section>\n  <section id="brands" aria-hidden="true"></section>\n  <section id="press" aria-hidden="true"></section>\n  <section id="contact" aria-hidden="true"></section>');
fs.writeFileSync(about, a);

const build = 'sites/hey-this-is-andrew/src/pages/build.astro';
let b = fs.readFileSync(build, 'utf8');
b = b.replace('<div class="page-head" aria-hidden="true"></div>', '<div class="page-head" aria-hidden="true"></div>\n  <section id="now" aria-hidden="true"></section>\n  <section id="roadmap" aria-hidden="true"></section>\n  <section id="core-engine" aria-hidden="true"></section>\n  <section id="be" aria-hidden="true"></section>\n  <section id="ccc" aria-hidden="true"></section>');
fs.writeFileSync(build, b);
