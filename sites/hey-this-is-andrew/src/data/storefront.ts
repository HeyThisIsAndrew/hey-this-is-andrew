// Storefront picks and referrals (StorefrontCTA.astro). The Amazon
// influencer storefront URL lives here once; GearGrid reads it too.

export const AMAZON_STOREFRONT = 'https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh';

export interface StorefrontPick {
  /** Optional small label above the title. */
  kicker?: string;
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
 * (StorefrontCTA with picks={REFERRALS}). The copy and the referral link
 * are the owner's own, word for word.
 */
export const REFERRALS: StorefrontPick[] = [
  {
    kicker: 'Mobile workflow',
    title: 'Mint Mobile',
    desc: 'Switch to Mint Mobile and stop spending so much on your wireless plan. Use my referral link to get $15 in renewal credit. Then use the money you save to buy me lunch or something (as a thank you).',
    cta: 'Check out Mint Mobile',
    url: 'https://my.mintmobile.com/refer/pHvGFQz',
  },
  {
    title: 'inKind',
    desc: "Hey! Join inKind and we'll both get $25 to spend at amazing restaurants!",
    cta: 'Check out inKind',
    url: 'https://app.inkind.com/refer/YMEZOONP',
  },
  {
    title: 'Fetch',
    desc: "Stop tossing your receipts. 🧾 They're worth gift cards on Fetch! Use my code FJ6MX and we'll both get a bonus when you join and complete any point-earning action.",
    cta: 'Check out Fetch',
    url: 'https://referral.fetch.com/vvv3/share?code=FJ6MX',
  },
];
