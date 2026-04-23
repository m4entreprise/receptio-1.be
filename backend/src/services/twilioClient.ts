import Twilio from 'twilio';

const TWILIO_IRELAND_REGION = 'ie1';
const TWILIO_IRELAND_EDGE = 'dublin';

export function getTwilioAccountSid(): string {
  const accountSid = (process.env.TWILIO_ACCOUNT_SID || '').trim();
  if (!accountSid) {
    throw new Error('Twilio account SID not configured (TWILIO_ACCOUNT_SID)');
  }
  return accountSid;
}

export function getTwilioRegion(): string {
  const configuredRegion = (process.env.TWILIO_REGION || '').trim().toLowerCase();
  if (configuredRegion && configuredRegion !== TWILIO_IRELAND_REGION) {
    throw new Error(`Twilio region must be ${TWILIO_IRELAND_REGION}, received ${configuredRegion}`);
  }
  return TWILIO_IRELAND_REGION;
}

export function getTwilioEdge(): string {
  const configuredEdge = (process.env.TWILIO_EDGE || '').trim().toLowerCase();
  if (configuredEdge && configuredEdge !== TWILIO_IRELAND_EDGE) {
    throw new Error(`Twilio edge must be ${TWILIO_IRELAND_EDGE}, received ${configuredEdge}`);
  }
  return TWILIO_IRELAND_EDGE;
}

export function getTwilioApiKeyCredentials(): { apiKeySid: string; apiKeySecret: string } {
  const apiKeySid = (process.env.TWILIO_API_KEY_SID || '').trim();
  const apiKeySecret = (process.env.TWILIO_API_KEY_SECRET || '').trim();
  if (!apiKeySid || !apiKeySecret) {
    throw new Error('Twilio API Key not configured (TWILIO_API_KEY_SID / TWILIO_API_KEY_SECRET)');
  }
  return { apiKeySid, apiKeySecret };
}

export function getTwilioBasicAuth(): { username: string; password: string } {
  const { apiKeySid, apiKeySecret } = getTwilioApiKeyCredentials();
  return {
    username: apiKeySid,
    password: apiKeySecret,
  };
}

export function getTwilioClient(): ReturnType<typeof Twilio> {
  const accountSid = getTwilioAccountSid();
  const region = getTwilioRegion();
  const edge = getTwilioEdge();
  const { apiKeySid, apiKeySecret } = getTwilioApiKeyCredentials();
  return Twilio(apiKeySid, apiKeySecret, { accountSid, region, edge });
}

/**
 * Returns the Twilio REST API base URL for the configured region.
 * e.g. TWILIO_REGION=ie1 + TWILIO_EDGE=dublin → https://api.dublin.ie1.twilio.com
 */
export function getTwilioApiBase(): string {
  return `https://api.${getTwilioEdge()}.${getTwilioRegion()}.twilio.com`;
}
