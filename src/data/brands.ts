import type { ImageMetadata } from 'astro';
import beLogo from '../assets/brand-logos/be-logo.png';
import cccLogo from '../assets/brand-logos/ccc-logo.png';
import beMedia from '../assets/hero-media/be-hq-still.jpg';
import cccMedia from '../assets/hero-media/ccc-pour.jpg';

// The lanes accordion: the worlds Andrew has built.
// Images are imported so Astro optimizes them at build time (WebP/AVIF,
// responsive widths). Masters live in src/assets; nothing here points at
// /public.

export interface ChildBrand {
  id: string;
  name: string;
  kicker: string;
  headline: string;
  deck: string;
  cta: string;
  url: string;
  logoSrc?: ImageMetadata;
  wordmark: string;
  mediaSrc?: ImageMetadata;
  /** Quiet commercial path: rendered as a subtle "Start a project" link
      under the panel CTA. Only set where inquiries are real. */
  inquiryEmail?: string;
  /** Future/unlaunched lane: renders in a quieter treatment, non-clickable. */
  comingSoon?: boolean;
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
    inquiryEmail: 'capturecreatecaffeinate@gmail.com',
  },
  {
    id: 'sip-the-magic',
    name: 'Sip the Magic',
    kicker: 'SOMETHING IS BREWING',
    headline: 'SIP THE MAGIC.',
    deck: 'Something is brewing. Sip the Magic is coming together. More soon.',
    cta: 'In the works',
    url: '',
    wordmark: 'STM',
    comingSoon: true,
  },
];
