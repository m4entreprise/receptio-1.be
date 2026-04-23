import Twilio from 'twilio';

export function getTwilioClient(): ReturnType<typeof Twilio> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  const region = (process.env.TWILIO_REGION || '').trim() || undefined;
  const apiKeySid = (process.env.TWILIO_API_KEY_SID || '').trim() || undefined;
  const apiKeySecret = (process.env.TWILIO_API_KEY_SECRET || '').trim() || undefined;

  if (region && apiKeySid && apiKeySecret) {
    return Twilio(apiKeySid, apiKeySecret, { accountSid, region });
  }
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
