// @andrew/ui icon library: every social glyph in one place.
//
// Conventions (adopted from BE Unconventional HQ's src/data/icons.js, the
// better-engineered of the two icon sets): each entry is INNER SVG markup
// for a 24x24 viewBox, painted with currentColor, no width/height (size is
// a CSS concern). The wrapping <svg> carries aria-hidden; the link around it
// carries the accessible name. Authored here, never user input, so
// set:html is safe.
//
// SOCIAL_LINE_ICONS: the monochrome line set the personal site uses.
// (HQ's official Simple Icons set joins this file when HQ migrates in;
// see ARCHITECTURE.md.)

export const SOCIAL_LINE_ICONS: Record<string, string> = {
  YouTube: '<rect x="2.5" y="6" width="19" height="12.5" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M10.5 9.8v5l4.5-2.5z" fill="currentColor" stroke="none"/>',
  Instagram: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><circle cx="17.2" cy="6.8" r="1.2" fill="currentColor" stroke="none"/>',
  TikTok: '<path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" fill="currentColor" stroke="none"/>',
  Threads: '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm3.8 13.5c-.7 1.2-1.8 1.8-3.2 1.8-2.3 0-3.9-1.6-3.9-4.1 0-2.6 1.8-4.3 4.2-4.3 2.1 0 3.6 1.4 3.6 3.4 0 2.2-1.4 3.5-3.3 3.5-.9 0-1.7-.4-2-.9l.8-.6c.2.4.7.6 1.2.6 1.3 0 2.2-1 2.2-2.6 0-1.5-1-2.5-2.5-2.5-1.8 0-3.1 1.3-3.1 3.4 0 2 1.3 3.2 3.1 3.2 1.1 0 2-.5 2.5-1.4l.8.6z" fill="currentColor" stroke="none"/>',
  Substack: '<path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" fill="currentColor" stroke="none"/>',
  LinkedIn: '<path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.7a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z" fill="currentColor" stroke="none"/>',
};
