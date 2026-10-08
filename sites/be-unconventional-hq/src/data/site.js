export const site = {
  name: 'BE Unconventional HQ',
  short: 'Unconventional HQ',
  tagline: 'Where nerd culture gets cinematic',
  description:
    'A cinematic creator hub for film, TV, games, and live events: reviews, reactions, and deep dives from BE Unconventional HQ.',
  url: 'https://beunconventionalhq.com/',
  image: 'https://beunconventionalhq.com/og-image.png',
  ga4: 'G-CF16HJW04T',

  /**
   * Primary navigation — the single source for BOTH the navbar and the footer.
   *
   * These two used to hardcode their own copies of this list, which is why
   * adding a section meant editing two files and hoping you found both.
   *
   * `href` is the path WITHOUT a leading slash; the navbar adds it and uses
   * the bare value for active-state matching.
   *
   * Order is deliberate: Feed and Intel are the two content surfaces (watch
   * and read) and sit together at the front; Events and Featured are the
   * editorial hubs; About closes.
   */
  nav: [
    { label: 'Feed', href: 'feed' },
    { label: 'Intel', href: 'intel' },
    { label: 'Events', href: 'events' },
    { label: 'Featured', href: 'featured' },
    { label: 'About', href: 'about' },
  ],

  /*
   * ─── THE CHANNEL HAS TWO URLs, AND BOTH BELONG HERE ──────────────────────
   *
   * `youtube` is the channel. `youtubeSubscribe` is the same channel with
   * `?sub_confirmation=1`, which makes YouTube open its one-click subscribe
   * dialog over the page instead of dropping the visitor on the channel and
   * leaving them to find the button. Any CTA whose ASK is "subscribe" wants
   * the second one; a link that merely points at the channel wants the first.
   *
   * Derived here rather than written out, and derived rather than assembled
   * at each call site. It had been assembled at call sites: CommercialRotator
   * carried the full URL with the parameter typed into it, and the /feed
   * hero's SUBSCRIBE button pointed at the bare channel. Two copies of one
   * handle, and the one place it mattered most was the one that lost the
   * parameter. Neither file spells the handle out now.
   */
  socials: {
    youtube: 'https://www.youtube.com/@BeUnconventionalHQ',
    get youtubeSubscribe() {
      return `${this.youtube}?sub_confirmation=1`;
    },
    instagram: 'https://www.instagram.com/beunconventionalhq',
    tiktok: 'https://www.tiktok.com/@beunconventionalhq',
    threads: 'https://www.threads.com/@beunconventionalhq',
    facebook: 'https://www.facebook.com/profile.php?id=61557980693320',
    substack: 'https://beunconventionalhq.substack.com/',
    twitter: 'https://x.com/beunconhq',
    letterboxd: 'https://letterboxd.com/beunconhq/',
    amazon: 'https://www.amazon.com/shop/influencer-0931c541',
    bluesky: 'https://bsky.app/profile/beunconventionalhq.com',
  },
};
