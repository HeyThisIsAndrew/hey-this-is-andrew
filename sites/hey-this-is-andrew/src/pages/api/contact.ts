import type { APIRoute } from 'astro';

const CCC_EMAIL = 'capturecreatecaffeinate@gmail.com';
const DEFAULT_EMAIL = 'heythisisandrewb@gmail.com';

function getEnvVar(context: any, key: string): string | undefined {
  const runtimeEnv = context.locals?.runtime?.env;
  if (runtimeEnv && runtimeEnv[key]) {
    return runtimeEnv[key];
  }
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  return undefined;
}

export const GET: APIRoute = async (context) => {
  const apiKey = getEnvVar(context, 'RESEND_API_KEY');
  return new Response(
    JSON.stringify({
      status: 'ok',
      configured: Boolean(apiKey),
      message: apiKey
        ? 'Contact API endpoint is configured and active.'
        : 'Contact API endpoint is awaiting RESEND_API_KEY secret.',
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
};

export const POST: APIRoute = async (context) => {
  let body: Record<string, any>;
  try {
    body = await context.request.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: 'invalid_json',
        message: 'Request body must be valid JSON.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const subject = typeof body.subject === 'string' ? body.subject.trim() : '';
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  const venue = typeof body.venue === 'string' ? body.venue.trim() : '';
  const service = typeof body.service === 'string' ? body.service.trim() : '';
  const requestedRecipient = typeof body.recipient === 'string' ? body.recipient.trim().toLowerCase() : '';

  if (!email && !message && !notes) {
    return new Response(
      JSON.stringify({
        error: 'missing_fields',
        message: 'Please provide contact information and a message.',
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Route strictly: CCC recipient ONLY for Capture Create Caffeinate inquiries; otherwise personal email.
  const targetRecipient = requestedRecipient === CCC_EMAIL ? CCC_EMAIL : DEFAULT_EMAIL;

  const emailSubject = subject || (requestedRecipient === CCC_EMAIL ? 'Capture Create Caffeinate Inquiry' : 'Website Contact Form');

  const lines = [
    name ? `Name: ${name}` : '',
    email ? `Email: ${email}` : '',
    venue ? `Venue: ${venue}` : '',
    service ? `Service / Package: ${service}` : '',
    notes ? `Notes:\n${notes}` : '',
    message ? `Message:\n${message}` : '',
    `\n---\nSent via ${targetRecipient === CCC_EMAIL ? 'Capture Create Caffeinate' : 'HEY_THISISANDREW'} website`,
  ].filter(Boolean);

  const textContent = lines.join('\n\n');

  const apiKey = getEnvVar(context, 'RESEND_API_KEY');
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        error: 'service_unavailable',
        message: 'Email service is not configured yet. Please email heythisisandrewb@gmail.com directly.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  const fromEmail = getEnvVar(context, 'RESEND_FROM_EMAIL') || 'HEY_THISISANDREW <onboarding@resend.dev>';

  try {
    const resendPayload: Record<string, any> = {
      from: fromEmail,
      to: [targetRecipient],
      subject: emailSubject,
      text: textContent,
    };
    if (email) {
      resendPayload.reply_to = email;
    }

    const resendRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(resendPayload),
    });

    if (!resendRes.ok) {
      const errBody = await resendRes.text();
      return new Response(
        JSON.stringify({
          error: 'send_failed',
          message: `Email provider returned error: ${resendRes.status}`,
          details: errBody,
        }),
        {
          status: 502,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const resendData = await resendRes.json();
    return new Response(
      JSON.stringify({
        success: true,
        id: resendData?.id,
        message: 'Your inquiry has been received. We will be in touch shortly.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: 'network_error',
        message: err?.message || 'Failed to connect to email provider.',
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
