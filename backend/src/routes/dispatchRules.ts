import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  conditionType: z.enum(['always', 'intent']).optional(),
  conditions: z.record(z.any()).optional(),
  targetType: z.enum(['group', 'agent']).optional(),
  targetGroupId: z.string().uuid().nullable().optional(),
  targetStaffId: z.string().uuid().nullable().optional(),
  distributionStrategy: z.enum(['sequential', 'random', 'simultaneous']).optional(),
  agentOrder: z.array(z.string().uuid()).optional(),
  fallbackType: z.enum(['voicemail', 'none', 'group', 'agent']).optional(),
  fallbackGroupId: z.string().uuid().nullable().optional(),
  fallbackStaffId: z.string().uuid().nullable().optional(),
});

// POST /api/dispatch-rules/reorder — must be before /:id routes
router.post('/reorder', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError('Forbidden', 403);
    const { companyId } = req.user!;
    const { order } = z.object({ order: z.array(z.string().uuid()) }).parse(req.body);

    await Promise.all(
      order.map((id, idx) =>
        query(
          `UPDATE dispatch_rules SET priority = $1 WHERE id = $2 AND company_id = $3`,
          [idx, id, companyId]
        )
      )
    );
    res.json({ message: 'Reordered' });
  } catch (err) { next(err); }
});

// GET /api/dispatch-rules
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT
        r.*,
        tg.name AS target_group_name,
        tg.role AS target_group_role,
        ts.first_name AS target_staff_first_name,
        ts.last_name AS target_staff_last_name,
        fg.name AS fallback_group_name,
        fs.first_name AS fallback_staff_first_name,
        fs.last_name AS fallback_staff_last_name
       FROM dispatch_rules r
       LEFT JOIN staff_groups tg ON tg.id = r.target_group_id
       LEFT JOIN staff ts ON ts.id = r.target_staff_id
       LEFT JOIN staff_groups fg ON fg.id = r.fallback_group_id
       LEFT JOIN staff fs ON fs.id = r.fallback_staff_id
       WHERE r.company_id = $1
       ORDER BY r.priority ASC, r.created_at ASC`,
      [companyId]
    );
    res.json({ rules: result.rows });
  } catch (err) { next(err); }
});

// POST /api/dispatch-rules
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError('Forbidden', 403);
    const { companyId } = req.user!;
    const data = ruleSchema.parse(req.body);

    const result = await query(
      `INSERT INTO dispatch_rules (
        company_id, name, description, priority, enabled,
        condition_type, conditions,
        target_type, target_group_id, target_staff_id,
        distribution_strategy, agent_order,
        fallback_type, fallback_group_id, fallback_staff_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
      RETURNING *`,
      [
        companyId,
        data.name,
        data.description ?? null,
        data.priority ?? 0,
        data.enabled ?? true,
        data.conditionType ?? 'always',
        JSON.stringify(data.conditions ?? {}),
        data.targetType ?? 'group',
        data.targetGroupId ?? null,
        data.targetStaffId ?? null,
        data.distributionStrategy ?? 'sequential',
        JSON.stringify(data.agentOrder ?? []),
        data.fallbackType ?? 'voicemail',
        data.fallbackGroupId ?? null,
        data.fallbackStaffId ?? null,
      ]
    );
    res.status(201).json({ rule: result.rows[0] });
  } catch (err) { next(err); }
});

// PATCH /api/dispatch-rules/:id
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError('Forbidden', 403);
    const { companyId } = req.user!;
    const { id } = req.params;
    const data = ruleSchema.partial().parse(req.body);

    if (Object.keys(data).length === 0) throw new AppError('No fields to update', 400);

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (data.name !== undefined) { setClauses.push(`name = $${idx++}`); values.push(data.name); }
    if (data.description !== undefined) { setClauses.push(`description = $${idx++}`); values.push(data.description); }
    if (data.priority !== undefined) { setClauses.push(`priority = $${idx++}`); values.push(data.priority); }
    if (data.enabled !== undefined) { setClauses.push(`enabled = $${idx++}`); values.push(data.enabled); }
    if (data.conditionType !== undefined) { setClauses.push(`condition_type = $${idx++}`); values.push(data.conditionType); }
    if (data.conditions !== undefined) { setClauses.push(`conditions = $${idx++}`); values.push(JSON.stringify(data.conditions)); }
    if (data.targetType !== undefined) { setClauses.push(`target_type = $${idx++}`); values.push(data.targetType); }
    if (data.targetGroupId !== undefined) { setClauses.push(`target_group_id = $${idx++}`); values.push(data.targetGroupId); }
    if (data.targetStaffId !== undefined) { setClauses.push(`target_staff_id = $${idx++}`); values.push(data.targetStaffId); }
    if (data.distributionStrategy !== undefined) { setClauses.push(`distribution_strategy = $${idx++}`); values.push(data.distributionStrategy); }
    if (data.agentOrder !== undefined) { setClauses.push(`agent_order = $${idx++}`); values.push(JSON.stringify(data.agentOrder)); }
    if (data.fallbackType !== undefined) { setClauses.push(`fallback_type = $${idx++}`); values.push(data.fallbackType); }
    if (data.fallbackGroupId !== undefined) { setClauses.push(`fallback_group_id = $${idx++}`); values.push(data.fallbackGroupId); }
    if (data.fallbackStaffId !== undefined) { setClauses.push(`fallback_staff_id = $${idx++}`); values.push(data.fallbackStaffId); }

    values.push(id, companyId);
    const result = await query(
      `UPDATE dispatch_rules SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND company_id = $${idx++}
       RETURNING *`,
      values
    );
    if (result.rowCount === 0) throw new AppError('Rule not found', 404);
    res.json({ rule: result.rows[0] });
  } catch (err) { next(err); }
});

// DELETE /api/dispatch-rules/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    if (req.user!.role !== 'admin') throw new AppError('Forbidden', 403);
    const { companyId } = req.user!;
    const { id } = req.params;
    const result = await query(
      `DELETE FROM dispatch_rules WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (result.rowCount === 0) throw new AppError('Rule not found', 404);
    res.json({ message: 'Rule deleted' });
  } catch (err) { next(err); }
});

export default router;
