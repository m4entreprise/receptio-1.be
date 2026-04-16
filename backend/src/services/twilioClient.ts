import Twilio from 'twilio';

/**
 * Returns a Twilio REST client configured for the region specified in
 * TWILIO_REGION (e.g. "ie1" → api.ie1.twilio.com).
 * Falls back to the global US1 endpoint when TWILIO_REGION is unset.
 */
export function getTwilioClient(): ReturnType<typeof Twilio> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  const region = (process.env.TWILIO_REGION || '').trim() || undefined;
  return Twilio(accountSid, authToken, region ? { region } : undefined);
}

/**
 * Returns the Twilio REST API base URL for the configured region.
 * e.g. TWILIO_REGION=ie1 → https://api.ie1.twilio.com
 */
export function getTwilioApiBase(): string {
  const region = (process.env.TWILIO_REGION || '').trim();
  return region ? `https://api.${region}.twilio.com` : 'https://api.twilio.com';
}
