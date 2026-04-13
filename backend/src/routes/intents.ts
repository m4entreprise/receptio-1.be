import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

const router = Router();

// GET /api/intents
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT id, company_id, label, description, keywords, color, position, is_active, created_at
       FROM call_intents
       WHERE company_id = $1
       ORDER BY position ASC, created_at ASC`,
      [companyId]
    );
    res.json({ intents: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/intents
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { label, description = null, keywords = null, color = '#344453', position = 0 } = req.body;

    if (!label || typeof label !== 'string') throw new AppError('label is required', 400);

    const result = await query(
      `INSERT INTO call_intents (company_id, label, description, keywords, color, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, label.trim(), description, keywords, color, position]
    );
    res.status(201).json({ intent: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/intents/:id
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const existing = await query(
      `SELECT id FROM call_intents WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (existing.rows.length === 0) throw new AppError('Intent not found', 404);

    const { label, description, keywords, color, position, isActive } = req.body;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (label !== undefined) { fields.push(`label = $${idx++}`); values.push(label); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (keywords !== undefined) { fields.push(`keywords = $${idx++}`); values.push(keywords); }
    if (color !== undefined) { fields.push(`color = $${idx++}`); values.push(color); }
    if (position !== undefined) { fields.push(`position = $${idx++}`); values.push(position); }
    if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(isActive); }

    if (fields.length === 0) {
      const row = await query(`SELECT * FROM call_intents WHERE id = $1`, [id]);
      res.json({ intent: row.rows[0] });
      return;
    }

    values.push(id);
    const updated = await query(
      `UPDATE call_intents SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ intent: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/intents/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const existing = await query(
      `SELECT id FROM call_intents WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (existing.rows.length === 0) throw new AppError('Intent not found', 404);

    await query(`DELETE FROM call_intents WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// GET /api/intents/active — endpoint public (appelé par les webhooks sans token)
// Retourne les intents actifs pour un tenant donné via ?companyId=...
router.get('/active', async (req, res: Response, next) => {
  try {
    const companyId = typeof req.query.companyId === 'string' ? req.query.companyId : null;
    if (!companyId) {
      res.json({ intents: [] });
      return;
    }

    const result = await query(
      `SELECT label, description, keywords
       FROM call_intents
       WHERE company_id = $1 AND is_active = true
       ORDER BY position ASC, created_at ASC`,
      [companyId]
    );
    res.json({ intents: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
