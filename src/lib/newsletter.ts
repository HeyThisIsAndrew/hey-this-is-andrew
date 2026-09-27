// Newsletter integration point.
//
// Today the signup completes on Substack (a real, working path — no fake
// form). To connect a direct email provider later, swap NEWSLETTER_HANDLER
// for one that POSTs to the provider's endpoint; the UI stays untouched.
//
//   provider: 'substack' -> opens the Substack subscribe page in a new tab.
//   provider: 'direct'   -> POSTs { email } to NEWSLETTER_ENDPOINT.
export const NEWSLETTER_PROVIDER: 'substack' | 'direct' = 'substack';

export const SUBSTACK_URL = 'https://thisiscoffeetalk.substack.com';
export const SUBSTACK_SUBSCRIBE_URL = `${SUBSTACK_URL}/subscribe`;

/** Set this when a direct provider is connected. */
export const NEWSLETTER_ENDPOINT: string | null = null;

export function newsletterSubscribeUrl(email: string): string {
  const clean = email.trim();
  // Substack honours ?email= as a prefill on the subscribe page; if it
  // ever stops, the user still lands on a working subscribe form.
  return clean
    ? `${SUBSTACK_SUBSCRIBE_URL}?email=${encodeURIComponent(clean)}`
    : SUBSTACK_SUBSCRIBE_URL;
}
