import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import logger from '../utils/logger';

const router = Router();

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

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

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
