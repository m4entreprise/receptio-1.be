import { Router, Response } from 'express';
import { getTwilioClient } from '../services/twilioClient';
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

    const twilioSid = process.env.TWILIO_ACCOUNT_SID;
    const twilioToken = process.env.TWILIO_AUTH_TOKEN;
    const isTwilioRecording = /twilio\.com/i.test(recordingUrl);

    logger.info('Recording proxy request', {
      callId: id,
      isTwilioRecording,
      hasTwilioCreds: !!(twilioSid && twilioToken),
      recordingUrl,
    });

    // Stream the recording directly from the stored URL.
    // For Twilio URLs: use Basic auth + beforeRedirect to strip auth header
    // before any CDN redirect (otherwise CDN rejects with 403).
    const streamAuth = isTwilioRecording && twilioSid && twilioToken
      ? { username: twilioSid, password: twilioToken }
      : undefined;

    logger.info('Recording proxy: streaming', { callId: id, isTwilioRecording, hasAuth: !!streamAuth });

    const response = await axios.get(recordingUrl, {
      responseType: 'stream',
      maxRedirects: 10,
      validateStatus: (s) => s >= 200 && s < 300,
      ...(streamAuth ? { auth: streamAuth } : {}),
      beforeRedirect: (options: any) => {
        // Strip Authorization header when redirected to a non-Twilio host (CDN)
        if (options.hostname && !/twilio\.com$/i.test(options.hostname)) {
          delete options.headers['Authorization'];
          delete options.headers['authorization'];
        }
      },
    });

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `inline; filename="call-${id}.mp3"`);
    if (typeof response.headers['content-length'] === 'string') {
      res.setHeader('Content-Length', response.headers['content-length']);
    }
    response.data.on('error', (streamError: Error) => {
      logger.error('Recording stream error', { callId: id, error: streamError.message });
      if (!res.headersSent) next(streamError);
    });
    response.data.pipe(res);
  } catch (error: any) {
    // Twilio SDK errors use error.status; axios errors use error.response?.status
    const upstreamStatus = error.status ?? error.response?.status ?? error.statusCode;
    logger.error('Recording proxy error', {
      callId: req.params.id,
      error: error.message,
      status: upstreamStatus,
    });
    console.error('[RECORDING PROXY ERROR]', error.message);
    if (error instanceof AppError) {
      next(error);
    } else if (upstreamStatus === 404) {
      // Clear the stale recording_url so the player doesn't appear on future loads
      query('UPDATE calls SET recording_url = NULL WHERE id = $1', [req.params.id]).catch(() => {});
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
          const twilioClient = getTwilioClient();
          await twilioClient.calls(callSid).update({ status: 'completed' });
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

    const twilioClient = getTwilioClient();

    await twilioClient.calls(callSid).update({
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


export default router;
