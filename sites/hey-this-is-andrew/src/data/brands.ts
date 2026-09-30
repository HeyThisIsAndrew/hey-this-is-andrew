import type { AccordionPanel } from '@andrew/ui/types';
import beLogo from '../assets/brand-logos/be-logo.png';
import cccLogo from '../assets/brand-logos/ccc-logo.png';
import beMedia from '../assets/hero-media/be-hq-still.jpg';
import cccMedia from '../assets/hero-media/ccc-pour.jpg';

// The brands accordion (#directory): the worlds Andrew has built. This file
// is the single source of truth for every panel. Images are imported so
// Astro optimizes them at build time (WebP, responsive widths). Masters
// live in src/assets; nothing here points at /public.

/** A brand panel: the shared accordion's panel shape (@andrew/ui/types).
 *  `accent: 'be-red'` is mapped to BE's red in src/styles/theme.css; the
 *  parent site's other panels use the monochrome base accent. */
export type ChildBrand = AccordionPanel;

/* Sip The Magic teaser art: a line-drawn cup with steam, monochrome. */
const STM_TEASER_SVG =
  '<svg viewBox="0 0 240 240" fill="none" stroke="currentColor" stroke-linecap="square" aria-hidden="true">' +
  '<path d="M112 38c-10 12 10 20 0 34M132 30c-10 14 10 24 0 40M152 40c-10 12 10 20 0 32" stroke-width="3" opacity="0.55"/>' +
  '<path d="M70 96h120l-10 70a26 26 0 0 1-26 22h-48a26 26 0 0 1-26-22z" stroke-width="5"/>' +
  '<path d="M190 112h10a18 18 0 0 1 0 36h-14" stroke-width="5"/>' +
  '<path d="M56 206h148" stroke-width="5"/>' +
  '</svg>';

export const childBrands: ChildBrand[] = [
  {
    id: 'be',
    name: 'BE Unconventional HQ',
    kicker: 'Media Brand',
    headline: 'WHERE NERD CULTURE GETS CINEMATIC.',
    deck: 'Reviews, deep dives, and event coverage.',
    cta: 'Visit BE Unconventional HQ',
    url: 'https://beunconventionalhq.com/',
    logoSrc: beLogo,
    wordmark: 'BE',
    mediaSrc: beMedia,
    accent: 'be-red',
    ctaFillOnPanelHover: true,
  },
  {
    id: 'ccc',
    name: 'Capture Create Caffeinate',
    kicker: 'BARS · RESTAURANTS · EVENTS',
    headline: 'CONTENT THAT BRINGS PEOPLE THROUGH YOUR DOOR',
    deck: 'People decide with their eyes. One shoot, everywhere you post. Four hours, no disruption.',
    cta: 'Visit Capture Create Caffeinate',
    url: 'https://the.fotoapp.co/capturecreatecaffeinate',
    logoSrc: cccLogo,
    wordmark: 'CCC',
    mediaSrc: cccMedia,
    inquiry: {
      email: 'capturecreatecaffeinate@gmail.com',
      subject: 'Photography project inquiry',
      label: 'Start a project',
    },
  },
  {
    id: 'sip-the-magic',
    name: 'Sip the Magic',
    kicker: 'SOMETHING IS BREWING',
    headline: 'SIP THE MAGIC.',
    deck: 'Something is brewing. Sip the Magic is coming together. More soon.',
    cta: '',
    // TODO (Andrew): no CTA link until you supply the Instagram link.
    url: '',
    wordmark: 'STM',
    // TODO (Andrew): swap in the Instagram image you choose. Import it at the
    // top of this file (e.g. `import stmArt from '../assets/hero-media/stm.jpg'`)
    // and set `mediaSrc: stmArt`. Until then the teaser card renders.
    mediaSrc: null,
    teaserSvg: STM_TEASER_SVG,
    comingSoon: true,
    teaserTag: 'In the works',
  },
];
