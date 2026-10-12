/*
 * Who runs Reelay, and the identifiers each platform's review asks for.
 * Every {{PLACEHOLDER}} here renders literally on the site until it's
 * filled in, so nothing invented ever ships. The audit lists the ones left
 * and fails on them when run with REELAY_RELEASE=1.
 */
export const OPERATOR = {
  product: 'Reelay',
  legalEntity: '{{LEGAL_ENTITY}}',
  address: '{{ADDRESS}}',
  country: '{{COUNTRY}}',
  governingLaw: '{{GOVERNING_LAW}}',
  dmcaAgent: '{{DMCA_AGENT}}',
  /* Total liability cap in the Terms (a legal decision; e.g. an amount in USD). */
  liabilityCap: '{{LIABILITY_CAP}}',
  domain: 'reelay.app',
  /* The website's host and how long it keeps request logs (privacy policy). */
  webHost: '{{WEB_HOST}}',
  webLogRetention: '{{WEB_LOG_RETENTION}}',
  /* Where auth.reelay.app runs (privacy policy, international transfers). */
  authServerRegion: '{{AUTH_SERVER_REGION}}',
};

/* App identifiers reviewers match against the submission. */
export const APP_IDS = {
  googleProjectId: '{{GOOGLE_PROJECT_ID}}',
  googleClientId: '{{GOOGLE_CLIENT_ID}}',
  tiktokClientKey: '{{TIKTOK_CLIENT_KEY}}',
  instagramAppId: '{{INSTAGRAM_APP_ID}}',
  threadsAppId: '{{THREADS_APP_ID}}',
  facebookAppId: '{{FACEBOOK_APP_ID}}',
};

export const CONTACTS = {
  support: 'support@reelay.app',
  privacy: 'privacy@reelay.app',
  reviewers: 'compliance@reelay.app',
  security: 'security@reelay.app',
  copyright: 'copyright@reelay.app',
};

export const TRADEMARKS =
  'TikTok is a trademark of ByteDance Ltd. YouTube and Google are trademarks of Google LLC. Instagram, Facebook and Threads are trademarks of Meta Platforms, Inc. Snapchat is a trademark of Snap Inc. Bluesky is a trademark of Bluesky Social, PBC. Reelay isn’t affiliated with or endorsed by any of them.';

export const LIMITED_USE =
  'Reelay’s use and transfer of information received from Google APIs to any other app will adhere to the Google API Services User Data Policy, including the Limited Use requirements.';

/*
 * Google's YouTube API Services policy asks that stored API data be
 * refreshed or deleted within 30 days. The app (9f3a2fb) keeps listed
 * YouTube videos in the library until you remove them, so the site does NOT
 * claim this yet. Flip to true only once the app enforces it.
 */
export const YOUTUBE_30_DAY_REFRESH = false;
