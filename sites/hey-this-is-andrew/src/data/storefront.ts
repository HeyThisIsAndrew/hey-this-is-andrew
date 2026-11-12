// Storefront picks and referrals (StorefrontCTA.astro). The Amazon
// influencer storefront URL lives here once; GearGrid reads it too.

export const AMAZON_STOREFRONT = 'https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh';

export interface StorefrontPick {
  kicker: string;
  title: string;
  desc: string;
  cta: string;
  url: string;
}

/** Gear picks: the homepage Gear section, /gear/ (StorefrontCTA). */
export const GEAR_PICKS: StorefrontPick[] = [
  {
    kicker: 'Production Stack',
    title: 'Full kit',
    desc: 'The complete inventory of cameras, lenses, lighting, and audio gear actively deployed in the studio.',
    cta: 'Browse complete kit',
    url: AMAZON_STOREFRONT,
  },
  {
    kicker: 'Post-production',
    title: 'DaVinci Resolve',
    desc: 'Professional editing, color grading, and audio post for all long-form and commercial deliverables.',
    cta: 'Explore DaVinci Resolve',
    url: 'https://www.blackmagicdesign.com/products/davinciresolve',
  },
];

/**
 * Referrals: not gear, so never in a gear section. Shown on /about/
 * (StorefrontCTA with picks={REFERRALS}). Put a personal referral link in
 * `url` when there is one; today it is Mint Mobile's home page.
 */
export const REFERRALS: StorefrontPick[] = [
  {
    kicker: 'Mobile workflow',
    title: 'Mint Mobile',
    desc: 'Reliable, flexible cellular connectivity powering off-site shoots and mobile production.',
    cta: 'Check out Mint Mobile',
    url: 'https://mintmobile.com/',
  },
];
