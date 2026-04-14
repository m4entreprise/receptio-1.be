import { Router, Response } from 'express';
import axios from 'axios';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { summarizeCall } from '../services/mistral';
import { getAiModelsSettings } from '../services/offerB';
import logger from '../utils/logger';

const router = Router();
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUnavailableSummary(summary: unknown): boolean {
  const value = typeof summary === 'string' ? summary.trim() : '';
  return !value || value === 'Résumé non disponible';
}

function assertValidCallId(id: string) {
  if (!uuidPattern.test(id)) {
    throw new AppError('Invalid call id', 400);
  }
}

router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT c.*, t.text as transcription_text, t.language, t.segments as transcription_segments, cs.summary, cs.intent
      FROM calls c
      LEFT JOIN transcriptions t ON c.id = t.call_id
      LEFT JOIN call_summaries cs ON c.id = cs.call_id
      WHERE c.company_id = $1
    `;
    const params: any[] = [companyId];

    if (status) {
      queryText += ` AND c.status = $${params.length + 1}`;
      params.push(status);
    }

    queryText += ` ORDER BY c.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await query(queryText, params);

    const countResult = await query(
      'SELECT COUNT(*) FROM calls WHERE company_id = $1',
      [companyId]
    );

    res.json({
      calls: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/queued', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT c.id, c.caller_number, c.caller_name, c.call_sid, c.queue_reason, c.queued_at, c.status
       FROM calls c
       WHERE c.company_id = $1 AND c.queue_status = 'waiting'
       ORDER BY c.queued_at ASC`,
      [companyId]
    );
    res.json({ calls: result.rows });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    assertValidCallId(id);

    const result = await query(
      `SELECT c.*, t.text as transcription_text, t.language, t.confidence, t.segments as transcription_segments,
              cs.summary, cs.intent, cs.sentiment, cs.actions
       FROM calls c
       LEFT JOIN transcriptions t ON c.id = t.call_id
       LEFT JOIN call_summaries cs ON c.id = cs.call_id
       WHERE c.id = $1 AND c.company_id = $2`,
      [id, companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Call not found', 404);
    }

    const callRow = result.rows[0] as Record<string, unknown>;
    const transcriptionText = typeof callRow.transcription_text === 'string' ? callRow.transcription_text.trim() : '';
    if (isUnavailableSummary(callRow.summary) && transcriptionText) {
      try {
        const companySettingsResult = await query('SELECT settings FROM companies WHERE id = $1', [companyId]);
        const aiModels = getAiModelsSettings(companySettingsResult.rows[0]?.settings || {});
        const regeneratedSummary = await summarizeCall(transcriptionText, aiModels.summaryLlmModel || undefined);
        if (!isUnavailableSummary(regeneratedSummary)) {
          await query('UPDATE call_summaries SET summary = $1 WHERE call_id = $2', [regeneratedSummary, id]);
          callRow.summary = regeneratedSummary;
        }
      } catch (summaryError: any) {
        logger.warn('Call summary regeneration failed on detail fetch', { callId: id, error: summaryError.message });
      }
    }

    // If a summary exists but no transcription, create a minimal transcription row
    // so the frontend transcription section is visible (e.g. short calls with no recording)
    if (!transcriptionText && callRow.summary && typeof callRow.summary === 'string') {
      try {
        const existing = await query('SELECT id FROM transcriptions WHERE call_id = $1', [id]);
        if (existing.rows.length === 0) {
          const fallbackText = callRow.summary as string;
          await query(
            `INSERT INTO transcriptions (call_id, text, language, confidence) VALUES ($1, $2, $3, $4)`,
            [id, fallbackText, 'fr', 1.0]
          );
          callRow.transcription_text = fallbackText;
          logger.info('Call detail: fallback transcription synthesized from summary', { callId: id });
        }
      } catch (transcriptionError: any) {
        logger.warn('Call detail: fallback transcription creation failed', { callId: id, error: transcriptionError.message });
      }
    }

    const eventsResult = await query(
      'SELECT * FROM call_events WHERE call_id = $1 ORDER BY timestamp ASC',
      [id]
    );

    res.json({
      call: callRow,
      events: eventsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id/recording', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    assertValidCallId(id);

    const result = await query(
      'SELECT recording_url FROM calls WHERE id = $1 AND company_id = $2',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Call not found', 404);
    }

    const recordingUrl = result.rows[0].recording_url as string | null;

    if (!recordingUrl) {
      throw new AppError('Recording not found', 404);
    }

    const isTwilioRecording = /twilio\.com/i.test(recordingUrl);
    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const hasTwilioCreds = !!(twilioSid && twilioToken);

    logger.info('Recording proxy request', {
      callId: id,
      isTwilioRecording,
      hasTwilioCreds,
      sidPresent: !!twilioSid,
      tokenPresent: !!twilioToken,
      recordingUrl,
    });

    let finalUrl = recordingUrl;

    // Twilio's recording API requires Basic auth to resolve the URL, but then
    // redirects to a CDN that must NOT receive the Authorization header.
    // We manually follow redirects with auth on the Twilio origin, then stop
    // once we reach a non-Twilio URL and stream that without auth.
    if (isTwilioRecording && hasTwilioCreds) {
      finalUrl = await resolveTwilioRecordingUrl(recordingUrl, twilioSid!, twilioToken!);
      logger.info('Recording proxy: resolved URL', { callId: id, isSameDomain: finalUrl === recordingUrl, finalUrl: finalUrl.substring(0, 80) });
    }

    // Stream the fully-resolved URL.
    // maxRedirects: 0 — the URL is already resolved; no further redirects expected.
    // Auth only if we're still on a Twilio origin (CDN URLs must NOT get auth).
    const isFinalUrlTwilio = /twilio\.com/i.test(finalUrl);
    const response = await axios.get(finalUrl, {
      responseType: 'stream',
      maxRedirects: 0,
      validateStatus: (s) => s >= 200 && s < 300,
      ...(isFinalUrlTwilio && hasTwilioCreds
        ? { auth: { username: twilioSid!, password: twilioToken! } }
        : {}),
    });

    const contentType = typeof response.headers['content-type'] === 'string'
      ? response.headers['content-type']
      : 'audio/mpeg';
    const contentLength = response.headers['content-length'];

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="call-${id}.mp3"`);

    if (typeof contentLength === 'string') {
      res.setHeader('Content-Length', contentLength);
    }

    response.data.on('error', (streamError: Error) => {
      logger.error('Recording stream error', { callId: id, error: streamError.message });
      if (!res.headersSent) {
        next(streamError);
      }
    });

    response.data.pipe(res);
  } catch (error: any) {
    const upstreamStatus = error.response?.status;
    logger.error('Recording proxy error', {
      callId: req.params.id,
      error: error.message,
      status: upstreamStatus,
    });
    console.error('[RECORDING PROXY ERROR]', error.message, error.stack);
    if (upstreamStatus === 404) {
      next(new AppError('Enregistrement introuvable sur Twilio', 404));
    } else if (upstreamStatus === 401 || upstreamStatus === 403) {
      next(new AppError('Accès à l\'enregistrement refusé (authentification Twilio)', 502));
    } else {
      next(error);
    }
  }
});

router.post('/:id/abandon', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    assertValidCallId(id);

    const callResult = await query(
      `SELECT call_sid FROM calls WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );

    if (callResult.rows.length === 0) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    const { call_sid: callSid } = callResult.rows[0];

    if (callSid) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (accountSid && authToken) {
        try {
          const twilio = require('twilio')(accountSid, authToken);
          await twilio.calls(callSid).update({ status: 'completed' });
        } catch {
        }
      }
    }

    await query(
      `UPDATE calls SET queue_status = 'abandoned', status = 'completed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $1`,
      [id]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [id, 'twilio.routing.abandoned', { companyId }]
    );

    logger.info('Queued call abandoned by agent', { callId: id, companyId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Abandon error', { callId: req.params.id, error: error.message });
    next(error);
  }
});

router.post('/:id/transfer', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    assertValidCallId(id);
    const { staffPhone } = req.body;

    if (!staffPhone) {
      res.status(400).json({ error: 'staffPhone is required' });
      return;
    }

    const callResult = await query(
      `SELECT c.call_sid, c.queue_status, c.queue_reason,
              COALESCE(co.settings->>'publicWebhookUrl', '') AS public_webhook_url
       FROM calls c
       LEFT JOIN companies co ON co.id = c.company_id
       WHERE c.id = $1 AND c.company_id = $2`,
      [id, companyId]
    );

    if (callResult.rows.length === 0) {
      res.status(404).json({ error: 'Call not found' });
      return;
    }

    const { call_sid: callSid } = callResult.rows[0];

    if (!callSid) {
      res.status(400).json({ error: 'No active call SID found' });
      return;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      res.status(500).json({ error: 'Twilio credentials not configured' });
      return;
    }

    const baseWebhookUrl = (process.env.PUBLIC_WEBHOOK_URL || '').replace(/\/+$/, '');
    const recordingCallbackUrl = baseWebhookUrl
      ? `${baseWebhookUrl}/api/webhooks/twilio/recording-complete`
      : null;

    const recordAttr = recordingCallbackUrl
      ? ` record="record-from-answer" recordingStatusCallback="${recordingCallbackUrl}" recordingStatusCallbackMethod="POST"`
      : '';

    const twilio = require('twilio')(accountSid, authToken);

    await twilio.calls(callSid).update({
      twiml: `<Response><Say language="fr-FR">Nous vous transférons maintenant. Veuillez patienter.</Say><Dial${recordAttr}><Number>${staffPhone}</Number></Dial></Response>`,
    });

    await query(
      `UPDATE calls SET queue_status = 'transferred', status = 'transferred' WHERE id = $1`,
      [id]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [id, 'twilio.routing.transferred', { staffPhone, companyId }]
    );

    logger.info('Call transferred', { callId: id, staffPhone, companyId });
    res.json({ success: true });
  } catch (error: any) {
    logger.error('Transfer error', { callId: req.params.id, error: error.message });
    next(error);
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    assertValidCallId(id);

    const result = await query(
      'DELETE FROM calls WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Call not found', 404);
    }

    logger.info('Call deleted', { callId: id, companyId });

    res.json({ message: 'Call deleted successfully' });
  } catch (error) {
    next(error);
  }
});

/**
 * Resolve a Twilio recording URL to the final streamable CDN URL.
 *
 * Twilio's recording API requires Basic auth and may redirect (302) to a CDN.
 * The CDN rejects Authorization headers (403). We resolve the redirect chain
 * manually: send auth only on twilio.com hops, stop at non-Twilio locations.
 * Use responseType:'stream' + immediate destroy to avoid downloading the body.
 */
async function resolveTwilioRecordingUrl(url: string, sid: string, token: string): Promise<string> {
  let currentUrl = url;

  for (let hop = 0; hop < 10; hop++) {
    const isTwilio = /twilio\.com/i.test(currentUrl);
    const resp = await axios.head(currentUrl, {
      maxRedirects: 0,
      validateStatus: () => true,
      ...(isTwilio ? { auth: { username: sid, password: token } } : {}),
    });

    logger.info('resolveTwilioRecordingUrl hop', {
      hop,
      status: resp.status,
      currentUrl,
      location: resp.headers['location'] || null,
    });

    if (resp.status === 200) {
      return currentUrl;
    }

    if (resp.status >= 301 && resp.status <= 308) {
      const location = resp.headers['location'] as string | undefined;
      if (location) {
        currentUrl = location;
        continue;
      }
    }

    if (resp.status === 401 || resp.status === 403) {
      throw new AppError('Accès à l\'enregistrement refusé (authentification Twilio)', 502);
    }

    if (resp.status === 404) {
      throw new AppError('Enregistrement introuvable sur Twilio', 404);
    }

    throw new AppError(`Twilio a répondu avec le statut ${resp.status}`, 502);
  }

  return currentUrl;
}

export default router;
