import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { requirePermission } from '../utils/authz';

const router = Router();

const knowledgeBaseEntrySchema = z.object({
  title: z.string().min(1),
  category: z.string().optional().nullable(),
  content: z.string().min(1),
  priority: z.number().int().min(0).max(100).optional(),
  enabled: z.boolean().optional(),
});

const knowledgeBaseEntryUpdateSchema = knowledgeBaseEntrySchema.partial();

router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'knowledgeBaseManage');
    const { companyId } = req.user!;
    const result = await query(
      `SELECT id, company_id, title, category, content, priority, enabled, created_at, updated_at
       FROM knowledge_base_entries
       WHERE company_id = $1
       ORDER BY priority DESC, updated_at DESC`,
      [companyId]
    );

    res.json({ entries: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'knowledgeBaseManage');
    const { companyId } = req.user!;
    const data = knowledgeBaseEntrySchema.parse(req.body);

    const result = await query(
      `INSERT INTO knowledge_base_entries (company_id, title, category, content, priority, enabled)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, company_id, title, category, content, priority, enabled, created_at, updated_at`,
      [
        companyId,
        data.title,
        data.category || null,
        data.content,
        data.priority ?? 0,
        data.enabled ?? true,
      ]
    );

    res.status(201).json({ entry: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'knowledgeBaseManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const data = knowledgeBaseEntryUpdateSchema.parse(req.body);
    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(data.title);
    }

    if (data.category !== undefined) {
      updates.push(`category = $${paramCount++}`);
      values.push(data.category || null);
    }

    if (data.content !== undefined) {
      updates.push(`content = $${paramCount++}`);
      values.push(data.content);
    }

    if (data.priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(data.priority);
    }

    if (data.enabled !== undefined) {
      updates.push(`enabled = $${paramCount++}`);
      values.push(data.enabled);
    }

    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    values.push(id, companyId);

    const result = await query(
      `UPDATE knowledge_base_entries
       SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${paramCount++} AND company_id = $${paramCount}
       RETURNING id, company_id, title, category, content, priority, enabled, created_at, updated_at`,
      values
    );

    if (result.rows.length === 0) {
      throw new AppError('Knowledge base entry not found', 404);
    }

    res.json({ entry: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'knowledgeBaseManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const result = await query(
      'DELETE FROM knowledge_base_entries WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Knowledge base entry not found', 404);
    }

    res.json({ message: 'Knowledge base entry deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;
