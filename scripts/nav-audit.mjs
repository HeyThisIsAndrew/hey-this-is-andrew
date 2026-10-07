import fs from 'fs';
import path from 'path';
import { JSDOM } from 'jsdom';

const distDir = path.resolve('sites/hey-this-is-andrew/dist');

// Find all html files
function findHtml(dir, fileList = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      findHtml(path.join(dir, file), fileList);
    } else if (file.endsWith('.html')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const htmlFiles = findHtml(distDir);
const pageLinks = new Map();
const sitemapLinks = new Set();
let out = '';

// First pass: find all links in main content
for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(content);
  const document = dom.window.document;
  
  const relPath = '/' + path.relative(distDir, file).replace(/index\.html$/, '').replace(/\.html$/, '');
  const isSitemap = relPath === '/sitemap/';
  
  if (isSitemap) {
    document.querySelectorAll('main a').forEach(a => sitemapLinks.add(new URL(a.href, 'http://localhost').pathname));
  }
  
  const links = [];
  document.querySelectorAll('main a').forEach(a => {
    links.push(new URL(a.href, 'http://localhost').pathname);
  });
  pageLinks.set(relPath, links);
}

// Check every page reachable only from sitemap or single section
const reachableFrom = {};
for (const [page, links] of pageLinks.entries()) {
  for (const link of links) {
    if (!reachableFrom[link]) reachableFrom[link] = new Set();
    reachableFrom[link].add(page);
  }
}

for (const file of htmlFiles) {
  const content = fs.readFileSync(file, 'utf8');
  const dom = new JSDOM(content);
  const document = dom.window.document;
  
  const relPath = '/' + path.relative(distDir, file).replace(/index\.html$/, '').replace(/\.html$/, '');
  
  out += `\n--- Page: ${relPath} ---\n`;
  
  // Dropdown entries per top-level item
  const dropdowns = document.querySelectorAll('.nav-dropdown'); // Adjust selector as needed based on ui
  // Actually, let's just find dropdown menus
  const menus = document.querySelectorAll('.dropdown-menu');
  menus.forEach(menu => {
    const parentNav = menu.closest('.nav-item')?.querySelector('button, a')?.textContent.trim() || 'Unknown';
    out += `Dropdown: ${parentNav}\n`;
    menu.querySelectorAll('a').forEach(a => {
      const href = a.getAttribute('href');
      const isOnSamePage = href.startsWith('#') || href.startsWith(relPath);
      out += `  - ${a.textContent.trim()} (href: ${href}) -> Same page: ${isOnSamePage}\n`;
    });
  });

  // Check DOM order
  // ... let's do a simpler DOM order check by finding all section ids
  const sectionIds = Array.from(document.querySelectorAll('[id]')).map(el => el.id);
  out += `Section IDs in DOM: ${sectionIds.join(', ')}\n`;
  
  // Every link in main that leaves the page
  const mainLinks = document.querySelectorAll('main a');
  const leavePageLinks = [];
  mainLinks.forEach(a => {
    const href = a.getAttribute('href');
    if (href && !href.startsWith('#') && !href.startsWith('http') && !href.startsWith('mailto')) {
      const urlPath = new URL(a.href, 'http://localhost').pathname;
      if (urlPath !== relPath && urlPath !== relPath + '/') {
        leavePageLinks.push(href);
      }
    }
  });
  out += `Links leaving page from main: ${leavePageLinks.join(', ') || 'None'}\n`;
  
  const reach = reachableFrom[relPath] || new Set();
  const reachArr = Array.from(reach).filter(r => r !== relPath);
  if (reachArr.length <= 1 || (reachArr.length === 2 && reachArr.includes('/sitemap/'))) {
    out += `Reachability: Only reachable from ${reachArr.join(', ')}\n`;
  }
}

console.log(out);
