import { AccessToken, WebhookReceiver } from 'livekit-server-sdk';
import logger from '../utils/logger';

const OFFER_B_LIVEKIT_ENABLED = process.env.OFFER_B_LIVEKIT_ENABLED === 'true';
const LIVEKIT_URL = String(process.env.LIVEKIT_URL || '').replace(/\/+$/, '');
const LIVEKIT_API_KEY = String(process.env.LIVEKIT_API_KEY || '');
const LIVEKIT_API_SECRET = String(process.env.LIVEKIT_API_SECRET || '');
const LIVEKIT_SIP_DOMAIN = String(process.env.LIVEKIT_SIP_DOMAIN || '');
const LIVEKIT_SIP_TRUNK_USERNAME = String(process.env.LIVEKIT_SIP_TRUNK_USERNAME || '');
const LIVEKIT_SIP_TRUNK_PASSWORD = String(process.env.LIVEKIT_SIP_TRUNK_PASSWORD || '');
const LIVEKIT_SIP_TRANSPORT = String(process.env.LIVEKIT_SIP_TRANSPORT || 'tcp').toLowerCase();
const OFFER_B_LIVEKIT_AGENT_NAME = String(process.env.OFFER_B_LIVEKIT_AGENT_NAME || 'offer-b-agent');

const liveKitWebhookReceiver = LIVEKIT_API_KEY && LIVEKIT_API_SECRET
  ? new WebhookReceiver(LIVEKIT_API_KEY, LIVEKIT_API_SECRET)
  : null;

export interface LiveKitSipDispatchParams {
  callId: string;
  companyId: string;
  companyName: string;
  destinationNumber: string;
}

export interface LiveKitAgentTokenParams {
  callId: string;
  companyId: string;
  participantName?: string;
  roomName: string;
}

export function shouldUseOfferBLiveKit(): boolean {
  return OFFER_B_LIVEKIT_ENABLED
    && Boolean(LIVEKIT_URL)
    && Boolean(LIVEKIT_API_KEY)
    && Boolean(LIVEKIT_API_SECRET)
    && Boolean(LIVEKIT_SIP_DOMAIN);
}

export function getLiveKitUrl(): string {
  return LIVEKIT_URL;
}

export function getLiveKitSipTrunkUsername(): string {
  return LIVEKIT_SIP_TRUNK_USERNAME;
}

export function getLiveKitSipTrunkPassword(): string {
  return LIVEKIT_SIP_TRUNK_PASSWORD;
}

export function buildLiveKitSipUri(params: LiveKitSipDispatchParams): string {
  const headers = new URLSearchParams({
    'x-call-id': params.callId,
    'x-company-id': params.companyId,
    'x-company-name': params.companyName,
  });

  return `sip:${params.destinationNumber}@${LIVEKIT_SIP_DOMAIN};transport=${LIVEKIT_SIP_TRANSPORT}?${headers.toString()}`;
}

export async function verifyLiveKitWebhook(body: Buffer | string, authorizationHeader: string | undefined) {
  if (!liveKitWebhookReceiver) {
    throw new Error('LiveKit webhook receiver not configured');
  }

  const rawBody = Buffer.isBuffer(body) ? body.toString('utf8') : String(body || '');
  return await liveKitWebhookReceiver.receive(rawBody, authorizationHeader);
}

export async function createLiveKitAgentToken(params: LiveKitAgentTokenParams): Promise<string> {
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    throw new Error('LiveKit API credentials not configured');
  }

  const participantName = params.participantName || OFFER_B_LIVEKIT_AGENT_NAME;
  const accessToken = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: participantName,
    name: participantName,
    metadata: JSON.stringify({
      callId: params.callId,
      companyId: params.companyId,
      role: 'offer_b_agent',
    }),
  });

  accessToken.addGrant({
    roomJoin: true,
    room: params.roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return await accessToken.toJwt();
}

export function logLiveKitConfigurationWarning() {
  if (OFFER_B_LIVEKIT_ENABLED && !shouldUseOfferBLiveKit()) {
    logger.warn('LiveKit telephony is enabled but configuration is incomplete', {
      hasUrl: Boolean(LIVEKIT_URL),
      hasApiKey: Boolean(LIVEKIT_API_KEY),
      hasApiSecret: Boolean(LIVEKIT_API_SECRET),
      hasSipDomain: Boolean(LIVEKIT_SIP_DOMAIN),
      hasSipUsername: Boolean(LIVEKIT_SIP_TRUNK_USERNAME),
      hasSipPassword: Boolean(LIVEKIT_SIP_TRUNK_PASSWORD),
    });
    return;
  }

  if (OFFER_B_LIVEKIT_ENABLED) {
    logger.info('LiveKit telephony configuration loaded', {
      sipDomain: LIVEKIT_SIP_DOMAIN,
      hasSipUsername: Boolean(LIVEKIT_SIP_TRUNK_USERNAME),
      hasSipPassword: Boolean(LIVEKIT_SIP_TRUNK_PASSWORD),
      sipTransport: LIVEKIT_SIP_TRANSPORT,
    });
  }
}
