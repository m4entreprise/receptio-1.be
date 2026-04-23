import axios from 'axios';
import logger from '../utils/logger';

const TELNYX_API_BASE = 'https://api.telnyx.com/v2';

export function getTelnyxApiKey(): string {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey) throw new Error('TELNYX_API_KEY not configured');
  return apiKey;
}

export async function redirectTelnyxCall(callSid: string, twiml: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || !callSid) {
    logger.warn('Telnyx call redirect skipped: missing API key or callSid', { callSid });
    return;
  }
  const body = new URLSearchParams({ Twiml: twiml });
  await axios.post(
    `${TELNYX_API_BASE}/texml/calls/${callSid}`,
    body.toString(),
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
}

export async function hangupTelnyxCall(callSid: string): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || !callSid) return;
  await axios.post(
    `${TELNYX_API_BASE}/calls/${callSid}/actions/hangup`,
    {},
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  );
}

export async function startTelnyxRecording(
  callSid: string,
  callbackUrl: string,
  callId: string
): Promise<void> {
  const apiKey = process.env.TELNYX_API_KEY;
  if (!apiKey || !callSid) {
    logger.warn('Telnyx recording skipped: missing API key or callSid', { callSid, callId });
    return;
  }
  if (!callbackUrl) {
    logger.warn('Telnyx recording skipped: empty callbackUrl', { callSid, callId });
    return;
  }
  const httpsCallbackUrl = callbackUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
  try {
    await axios.post(
      `${TELNYX_API_BASE}/calls/${callSid}/actions/record_start`,
      {
        format: 'mp3',
        channels: 'dual',
        webhook_url: httpsCallbackUrl,
        webhook_url_method: 'POST',
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    logger.info('Telnyx recording started', { callSid, callId, callbackUrl: httpsCallbackUrl });
  } catch (error: any) {
    logger.error('Failed to start Telnyx recording', {
      callSid,
      callId,
      error: error.message,
    });
  }
}
