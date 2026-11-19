// Storefront picks and referrals (StorefrontCTA.astro). The Amazon
// influencer storefront URL lives here once; GearGrid reads it too.
//
// Partner logos are the BE Unconventional HQ referral art (its
// src/assets/partners), copied into src/assets/brand-logos. A pick with no
// logo shows its text badge; never draw one for a partner.
import type { ImageMetadata } from 'astro';
import davinciResolveLogo from '../assets/brand-logos/davinci-resolve.png';
import mintMobileLogo from '../assets/brand-logos/mint-mobile.png';

export const AMAZON_STOREFRONT = 'https://www.amazon.com/shop/influencer-0931c541?ref=ac_inf_tb_vh';

export interface StorefrontPick {
  /** Optional small label above the title. */
  kicker?: string;
  title: string;
  compactTitle?: string;
  badge?: string;
  /** Front description (fits in at most 2 lines). */
  frontDesc?: string;
  /** Optional; left out rather than written for the owner. */
  desc?: string;
  cta: string;
  url: string;
  affiliate?: boolean;
  category?: 'Kit & Tools' | 'Referrals';
  /** The partner's own logo, shown in place of the text badge. */
  logo?: ImageMetadata;
}

export const REFERRAL_DISCLOSURE =
  'As an Amazon Associate, I earn from qualifying purchases. Some links below are affiliate or referral links at no extra cost to you.';

/** Gear picks: storefront and editing tools. */
export const GEAR_PICKS: StorefrontPick[] = [
  {
    title: 'Full kit',
    badge: 'KIT',
    frontDesc: 'Active studio cameras, lenses, lighting, and audio gear.',
    desc: 'The complete inventory of cameras, lenses, lighting, and audio gear actively deployed in the studio.',
    cta: 'Browse',
    url: AMAZON_STOREFRONT,
    affiliate: true,
    category: 'Kit & Tools',
  },
  {
    title: 'DaVinci Resolve',
    badge: 'TOOL',
    frontDesc: 'Professional editing, color grading, and audio post.',
    desc: 'Professional editing, color grading, and audio post for all long-form and commercial deliverables.',
    cta: 'Explore',
    url: 'https://www.blackmagicdesign.com/products/davinciresolve',
    affiliate: false,
    logo: davinciResolveLogo,
    category: 'Kit & Tools',
  },
];

/**
 * Referrals: combined with GEAR_PICKS in ALL_REFERRAL_PICKS for every
 * StorefrontCTA flip-banner and the "View all referrals" modal.
 */
export const REFERRALS: StorefrontPick[] = [
  {
    title: 'Mint Mobile',
    badge: 'MINT',
    desc: 'Switch to Mint Mobile and stop spending so much on your wireless plan. Use my referral link to get renewal credit. Then use the money you save to buy me lunch or something (as a thank you).',
    cta: 'Check out',
    url: 'https://my.mintmobile.com/refer/pHvGFQz',
    affiliate: true,
    logo: mintMobileLogo,
    category: 'Referrals',
  },
  {
    title: 'inKind',
    badge: 'INKIND',
    desc: "Hey! Join inKind and we'll both get credit to spend at amazing restaurants!",
    cta: 'Check out',
    url: 'https://app.inkind.com/refer/YMEZOONP',
    affiliate: true,
    category: 'Referrals',
  },
  {
    title: 'Fetch',
    badge: 'FETCH',
    desc: "Stop tossing your receipts. They're worth gift cards on Fetch! Use my code FJ6MX and we'll both get a bonus when you join and complete any point-earning action.",
    cta: 'Check out',
    url: 'https://referral.fetch.com/vvv3/share?code=FJ6MX',
    affiliate: true,
    category: 'Referrals',
  },
  {
    title: 'Instacart',
    badge: 'INSTA',
    cta: 'Check out',
    url: 'https://inst.cr/t/c821eab27',
    affiliate: true,
    category: 'Referrals',
  },
  {
    title: 'Rakuten',
    badge: 'RAKUTEN',
    cta: 'Check out',
    url: 'https://www.rakuten.com/r/HEYTHI34?eeid=44971',
    affiliate: true,
    category: 'Referrals',
  },
];

export const ALL_REFERRAL_PICKS: StorefrontPick[] = [...GEAR_PICKS, ...REFERRALS];
