import { Router, Response } from 'express';
import axios from 'axios';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const assertValidCallId = (id: string) => {
  if (!UUID_REGEX.test(id)) {
    throw new AppError('Invalid call id', 400);
  }
};

router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { status, limit = 50, offset = 0 } = req.query;

    let queryText = `
      SELECT c.*, t.text as transcription_text, t.language, cs.summary, cs.intent
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

router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    assertValidCallId(id);

    const result = await query(
      `SELECT c.*, t.text as transcription_text, t.language, t.confidence,
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

    const eventsResult = await query(
      'SELECT * FROM call_events WHERE call_id = $1 ORDER BY timestamp ASC',
      [id]
    );

    res.json({
      call: result.rows[0],
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
    const auth = isTwilioRecording && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
      ? {
          username: process.env.TWILIO_ACCOUNT_SID,
          password: process.env.TWILIO_AUTH_TOKEN,
        }
      : undefined;

    const response = await axios.get(recordingUrl, {
      responseType: 'stream',
      auth,
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
    logger.error('Recording proxy error', {
      callId: req.params.id,
      error: error.message,
      status: error.response?.status,
    });
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
