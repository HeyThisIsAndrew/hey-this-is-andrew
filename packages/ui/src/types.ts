import type { ImageMetadata } from 'astro';

/** One panel of the BrandAccordion. Site data files export arrays of these. */
export interface AccordionPanel {
  /** Slug. The panel's element id is `brand-<id>`, so `#brand-<id>` opens it. */
  id: string;
  /** Collapsed-strip label and the trigger's accessible name. */
  name: string;
  /** Metadata chip, top-left of the open panel. */
  kicker: string;
  headline: string;
  deck: string;
  /** CTA label. Omitted or empty (or `comingSoon`) renders no CTA. */
  cta?: string;
  url?: string;
  logoSrc?: ImageMetadata;
  /** Shown in the logo box when there is no logo. */
  wordmark: string;
  /** Preview art. Null/undefined renders the teaser card (never a black box). */
  mediaSrc?: ImageMetadata | null;
  /** Inline SVG markup for the teaser card (authored in the site's data file,
      never user input). Omit for a plain monochrome card. */
  teaserSvg?: string;
  /** Accent name. The panel renders `data-accent="<accent>"`; the site's
      theme maps it to --accordion-* tokens. Omit for the base accent. */
  accent?: string;
  /** HQ behaviour: the CTA fills whenever its open panel is hovered, not
      only when the CTA itself is. */
  ctaFillOnPanelHover?: boolean;
  /** Quiet secondary action under the CTA (e.g. a mailto). */
  inquiry?: { email: string; subject: string; label: string };
  /** Coming-soon treatment: no CTA link, the teaser tag instead. */
  comingSoon?: boolean;
  teaserTag?: string;
}

/** Interface strings the accordion speaks. Defaults are English. */
export interface AccordionLabels {
  play: string;
  pause: string;
  close: string;
  closeKey: string;
  closeAria: string;
}

export interface NavSubItem {
  label: string;
  href: string;
  kicker: string;
}

export interface NavItem {
  label: string;
  href: string;
  /** Section id for scrollspy on the home page; null for none. */
  section: string | null;
  subsections: NavSubItem[];
}

export interface FooterLink {
  label: string;
  href: string;
}

export interface SocialLink {
  label: string;
  href: string;
  /** Inner SVG markup for a 24x24 viewBox (see icons.ts). */
  icon: string;
}

export interface LogoAsset {
  src: string;
  width: number;
  height: number;
  alt: string;
}
