import type { ImageMetadata } from 'astro';
import beLogo from '../assets/brand-logos/be-logo.png';
import cccLogo from '../assets/brand-logos/ccc-logo.png';
import beMedia from '../assets/hero-media/be-hq-still.jpg';
import cccMedia from '../assets/hero-media/ccc-pour.jpg';

// The brands accordion (#directory): the worlds Andrew has built. This file
// is the single source of truth for every panel. Images are imported so
// Astro optimizes them at build time (WebP, responsive widths). Masters
// live in src/assets; nothing here points at /public.

/**
 * Panel accent. The parent site is monochrome (decision 2); the BE
 * Unconventional HQ panel is a BE brand context and carries BE's red
 * (decision 3). Every other panel is 'mono'.
 */
export type PanelAccent = 'mono' | 'be-red';

export interface ChildBrand {
  id: string;
  name: string;
  /** Metadata chip, top-left of the open panel. */
  kicker: string;
  headline: string;
  deck: string;
  cta: string;
  /** Empty for a panel with no CTA (Sip The Magic, for now). */
  url: string;
  logoSrc?: ImageMetadata;
  wordmark: string;
  /** Preview art: full on the open panel, blurred on a collapsed strip.
      Null renders the monochrome teaser card instead (never a black box). */
  mediaSrc: ImageMetadata | null;
  accent: PanelAccent;
  /** Quiet commercial path: rendered as a subtle "Start a project" link
      under the panel CTA. Only set where inquiries are real. */
  inquiryEmail?: string;
  /** Future/unlaunched brand: coming-soon teaser treatment, no CTA link. */
  comingSoon?: boolean;
  /** Teaser tag shown in place of a CTA on a coming-soon panel. */
  teaserTag?: string;
}

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
    accent: 'mono',
    inquiryEmail: 'capturecreatecaffeinate@gmail.com',
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
    accent: 'mono',
    comingSoon: true,
    teaserTag: 'In the works',
  },
];
