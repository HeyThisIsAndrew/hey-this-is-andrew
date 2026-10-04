import type { AccordionPanel } from '@andrew/ui/types';
import rows from './brands.json';
import { image } from './images';

// The brands accordion (#directory): the worlds Andrew has built. The panels
// live in brands.json, edited by hand or in the local CMS (`pnpm dev`, then
// /local-cms). Images are paths under src/assets (or Sanity asset ids),
// resolved by ./images so Astro still optimizes them at build time.
//
// Sip the Magic: no CTA link and no art until Andrew supplies them. Set
// `url` and `cta`, and `media` to the image (upload it in the CMS), and drop
// `comingSoon`.

/** A brand panel: the shared accordion's panel shape (@andrew/ui/types).
 *  `accent: 'be-red'` is mapped to BE's red in src/styles/theme.css; the
 *  parent site's other panels use the monochrome base accent. */
export type ChildBrand = AccordionPanel;

/** One row of brands.json (what the CMS edits). */
interface BrandRow {
  id: string;
  name: string;
  kicker: string;
  headline: string;
  deck: string;
  cta?: string;
  url?: string;
  logo?: string;
  wordmark: string;
  media?: string;
  teaserArt?: string;
  accent?: string;
  ctaFillOnPanelHover?: boolean;
  inquiry?: { email: string; subject: string; label: string };
  comingSoon?: boolean;
  teaserTag?: string;
}

/* Teaser art for a brand with no photo yet. Kept in code, chosen by name:
   it is SVG markup rendered as HTML, not something to edit in a form. */
const TEASER_ART: Record<string, string> = {
  /* Sip The Magic: a line-drawn cup with steam, monochrome. */
  cup:
    '<svg viewBox="0 0 240 240" fill="none" stroke="currentColor" stroke-linecap="square" aria-hidden="true">' +
    '<path d="M112 38c-10 12 10 20 0 34M132 30c-10 14 10 24 0 40M152 40c-10 12 10 20 0 32" stroke-width="3" opacity="0.55"/>' +
    '<path d="M70 96h120l-10 70a26 26 0 0 1-26 22h-48a26 26 0 0 1-26-22z" stroke-width="5"/>' +
    '<path d="M190 112h10a18 18 0 0 1 0 36h-14" stroke-width="5"/>' +
    '<path d="M56 206h148" stroke-width="5"/>' +
    '</svg>',
};

export const childBrands: ChildBrand[] = (rows as BrandRow[]).map((b) => ({
  id: b.id,
  name: b.name,
  kicker: b.kicker,
  headline: b.headline,
  deck: b.deck,
  cta: b.cta ?? '',
  url: b.url ?? '',
  logoSrc: image(b.logo, `brands.json ${b.id}.logo`),
  wordmark: b.wordmark,
  mediaSrc: image(b.media, `brands.json ${b.id}.media`) ?? null,
  teaserSvg: b.teaserArt ? TEASER_ART[b.teaserArt] : undefined,
  accent: b.accent || undefined,
  ctaFillOnPanelHover: b.ctaFillOnPanelHover || undefined,
  inquiry: b.inquiry,
  comingSoon: b.comingSoon || undefined,
  teaserTag: b.teaserTag,
}));
