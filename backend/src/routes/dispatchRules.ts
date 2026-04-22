import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { requirePermission } from '../utils/authz';

const router = Router();

// ─── Schémas Zod V2 ──────────────────────────────────────────────────────────

const conditionSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('always') }),
  z.object({
    id: z.string(),
    type: z.literal('schedule'),
    days: z.array(z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday'])),
    time_start: z.string().regex(/^\d{2}:\d{2}$/),
    time_end: z.string().regex(/^\d{2}:\d{2}$/),
  }),
  z.object({
    id: z.string(),
    type: z.literal('holiday'),
    country: z.enum(['BE','FR','LU','NL','DE','CH']),
    match: z.enum(['on_holiday','not_on_holiday']),
  }),
  z.object({
    id: z.string(),
    type: z.literal('language'),
    languages: z.array(z.string().min(2).max(5)),
  }),
  z.object({
    id: z.string(),
    type: z.literal('caller_number'),
    mode: z.enum(['equals','starts_with','contains']),
    patterns: z.array(z.string()),
  }),
  z.object({
    id: z.string(),
    type: z.literal('intent'),
    intents: z.array(z.string()),
    match_mode: z.enum(['any','all']),
  }),
  z.object({
    id: z.string(),
    type: z.literal('agent_availability'),
    group_id: z.string().uuid(),
    check: z.enum(['any_available','all_unavailable']),
  }),
]);

const retrySchema = z.object({
  max_attempts: z.number().int().min(0).max(99),
  ring_duration: z.number().int().min(5).max(120),
  between_attempts_delay: z.number().int().min(0).max(30),
});

const actionSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('route_group'),
    group_id: z.string().uuid(),
    distribution_strategy: z.enum(['sequential','simultaneous','random','round_robin']),
    agent_order: z.array(z.string().uuid()).optional(),
    retry: retrySchema,
  }),
  z.object({
    type: z.literal('route_agent'),
    agent_id: z.string().uuid(),
    ring_duration: z.number().int().min(5).max(120),
  }),
  z.object({
    type: z.literal('route_external'),
    phone_number: z.string().min(6),
    label: z.string().optional(),
  }),
  z.object({
    type: z.literal('play_message'),
    message_text: z.string().min(1),
  }),
  z.object({
    type: z.literal('voicemail'),
    greeting_text: z.string().optional(),
  }),
]);

const fallbackStepSchema = z.object({
  id: z.string(),
  label: z.string(),
  action: actionSchema,
  delay: z.number().int().min(0).optional(),
});

const ruleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  priority: z.number().int().optional(),
  enabled: z.boolean().optional(),
  condition_operator: z.enum(['AND','OR','ALWAYS']).optional(),
  conditions: z.array(conditionSchema).optional(),
  action: actionSchema.optional(),
  fallback_chain: z.array(fallbackStepSchema).optional(),
  node_positions: z.record(z.object({ x: z.number(), y: z.number() })).optional(),
});

// ─── Reorder — avant /:id ────────────────────────────────────────────────────
router.post('/reorder', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { order } = z.object({ order: z.array(z.string().uuid()) }).parse(req.body);
    await Promise.all(
      order.map((id, idx) =>
        query(`UPDATE dispatch_rules SET priority = $1 WHERE id = $2 AND company_id = $3`, [idx, id, companyId])
      )
    );
    res.json({ message: 'Reordered' });
  } catch (err) { next(err); }
});

// ─── GET /api/dispatch-rules ──────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT * FROM dispatch_rules
       WHERE company_id = $1
       ORDER BY priority ASC, created_at ASC`,
      [companyId]
    );
    // Normaliser les champs JSONB (pg renvoie des objets JS natifs)
    const rules = result.rows.map(normalizeRow);
    res.json({ rules });
  } catch (err) { next(err); }
});

// ─── POST /api/dispatch-rules ────────────────────────────────────────────────
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const data = ruleSchema.parse(req.body);

    // Calculer la priorité max pour placer la nouvelle règle en dernier
    const maxResult = await query(
      `SELECT COALESCE(MAX(priority), -1) + 1 AS next_priority FROM dispatch_rules WHERE company_id = $1`,
      [companyId]
    );
    const nextPriority = data.priority ?? maxResult.rows[0].next_priority;

    const defaultAction = {
      type: 'voicemail',
      greeting_text: 'Veuillez laisser votre message après le bip.',
    };

    const result = await query(
      `INSERT INTO dispatch_rules (
        company_id, name, description, priority, enabled,
        condition_operator, conditions, action, fallback_chain, node_positions
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *`,
      [
        companyId,
        data.name,
        data.description ?? null,
        nextPriority,
        data.enabled ?? true,
        data.condition_operator ?? 'ALWAYS',
        JSON.stringify(data.conditions ?? []),
        JSON.stringify(data.action ?? defaultAction),
        JSON.stringify(data.fallback_chain ?? []),
        JSON.stringify(data.node_positions ?? {}),
      ]
    );
    res.status(201).json({ rule: normalizeRow(result.rows[0]) });
  } catch (err) { next(err); }
});

// ─── PATCH /api/dispatch-rules/:id ───────────────────────────────────────────
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const data = ruleSchema.partial().parse(req.body);

    if (Object.keys(data).length === 0) throw new AppError('No fields to update', 400);

    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const addField = (col: string, val: any, serialize = false) => {
      setClauses.push(`${col} = $${idx++}`);
      values.push(serialize ? JSON.stringify(val) : val);
    };

    if (data.name !== undefined)               addField('name', data.name);
    if (data.description !== undefined)        addField('description', data.description);
    if (data.priority !== undefined)           addField('priority', data.priority);
    if (data.enabled !== undefined)            addField('enabled', data.enabled);
    if (data.condition_operator !== undefined) addField('condition_operator', data.condition_operator);
    if (data.conditions !== undefined)         addField('conditions', data.conditions, true);
    if (data.action !== undefined)             addField('action', data.action, true);
    if (data.fallback_chain !== undefined)     addField('fallback_chain', data.fallback_chain, true);
    if (data.node_positions !== undefined)     addField('node_positions', data.node_positions, true);

    values.push(id, companyId);
    const result = await query(
      `UPDATE dispatch_rules SET ${setClauses.join(', ')}
       WHERE id = $${idx++} AND company_id = $${idx++}
       RETURNING *`,
      values
    );
    if (result.rowCount === 0) throw new AppError('Rule not found', 404);
    res.json({ rule: normalizeRow(result.rows[0]) });
  } catch (err) { next(err); }
});

// ─── DELETE /api/dispatch-rules/:id ──────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
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

// ─── Utilitaire de normalisation ─────────────────────────────────────────────
function normalizeRow(row: any) {
  return {
    ...row,
    conditions:    Array.isArray(row.conditions) ? row.conditions : [],
    fallback_chain: Array.isArray(row.fallback_chain) ? row.fallback_chain : [],
    node_positions: row.node_positions ?? {},
  };
}

export default router;
