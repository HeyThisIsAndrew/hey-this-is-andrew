// Storefront and recommendations (StorefrontCTA.astro, with gear and goals).
// The Amazon influencer storefront URL lives here once; GearGrid and the
// rotator both read it.

export const AMAZON_STOREFRONT = 'https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh';

export interface StorefrontPick {
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  url: string;
}

export const PICKS: StorefrontPick[] = [
  {
    kicker: 'Production Stack',
    title: 'Verified Hardware Kit',
    desc: 'The complete inventory of cameras, lenses, lighting, and audio gear actively deployed in the studio.',
    cta: 'Browse complete kit',
    url: AMAZON_STOREFRONT,
  },
  {
    kicker: 'Mobile workflow',
    title: 'Mint Mobile',
    desc: 'Reliable, flexible cellular connectivity powering off-site shoots and mobile production.',
    cta: 'Check out Mint Mobile',
    url: 'https://mintmobile.com/',
  },
  {
    kicker: 'Post-production',
    title: 'DaVinci Resolve',
    desc: 'Professional editing, color grading, and audio post for all long-form and commercial deliverables.',
    cta: 'Explore DaVinci Resolve',
    url: 'https://www.blackmagicdesign.com/products/davinciresolve',
  },
];
