import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { requirePermission } from '../utils/authz';

const router = Router();

// ─── Schémas Zod ─────────────────────────────────────────────────────────────

const positionSchema = z.object({ x: z.number(), y: z.number() });

const conditionSchema = z.discriminatedUnion('type', [
  z.object({ id: z.string(), type: z.literal('always') }),
  z.object({ id: z.string(), type: z.literal('schedule'), days: z.array(z.string()), time_start: z.string(), time_end: z.string() }),
  z.object({ id: z.string(), type: z.literal('holiday'), country: z.enum(['BE','FR','LU','NL','DE','CH']), match: z.enum(['on_holiday','not_on_holiday']) }),
  z.object({ id: z.string(), type: z.literal('language'), languages: z.array(z.string()) }),
  z.object({ id: z.string(), type: z.literal('caller_number'), mode: z.enum(['equals','starts_with','contains']), patterns: z.array(z.string()) }),
  z.object({ id: z.string(), type: z.literal('intent'), intents: z.array(z.string()), match_mode: z.enum(['any','all']) }),
  z.object({ id: z.string(), type: z.literal('agent_availability'), group_id: z.string(), check: z.enum(['any_available','all_unavailable']) }),
]);

const retrySchema = z.object({
  max_attempts: z.number().int().min(0),
  ring_duration: z.number().int().min(5),
  between_attempts_delay: z.number().int().min(0),
});

const leafActionSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('route_group'), group_id: z.string(), distribution_strategy: z.enum(['sequential','simultaneous','random','round_robin']), agent_order: z.array(z.string()).optional(), retry: retrySchema }),
  z.object({ type: z.literal('route_agent'), agent_id: z.string(), ring_duration: z.number() }),
  z.object({ type: z.literal('route_external'), phone_number: z.string(), label: z.string().optional() }),
  z.object({ type: z.literal('play_message'), message_text: z.string() }),
  z.object({ type: z.literal('voicemail'), greeting_text: z.string().optional() }),
]);

const flowNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['entry', 'condition', 'action', 'end']),
  position: positionSchema,
  data: z.record(z.unknown()),
});

const flowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.enum(['yes', 'no', 'out']).nullable().optional(),
});

const flowSchema = z.object({
  nodes: z.array(flowNodeSchema),
  edges: z.array(flowEdgeSchema),
});

// ─── GET /api/dispatch/flow ───────────────────────────────────────────────────
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const result = await query(
      `SELECT id, company_id, nodes, edges, created_at, updated_at
       FROM dispatch_flows WHERE company_id = $1`,
      [companyId]
    );

    if (!result.rows.length) {
      // Retourner un flow vide avec juste le nœud d'entrée
      return res.json({
        nodes: [{ id: 'entry', type: 'entry', position: { x: 400, y: 60 }, data: {} }],
        edges: [],
      });
    }

    const row = result.rows[0];
    res.json({
      id: row.id,
      nodes: row.nodes,
      edges: row.edges,
      created_at: row.created_at,
      updated_at: row.updated_at,
    });
  } catch (err) { next(err); }
});

// ─── PUT /api/dispatch/flow ───────────────────────────────────────────────────
router.put('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;
    const { nodes, edges } = flowSchema.parse(req.body);

    const result = await query(
      `INSERT INTO dispatch_flows (company_id, nodes, edges)
       VALUES ($1, $2, $3)
       ON CONFLICT (company_id) DO UPDATE
         SET nodes = EXCLUDED.nodes,
             edges = EXCLUDED.edges,
             updated_at = now()
       RETURNING id, nodes, edges, created_at, updated_at`,
      [companyId, JSON.stringify(nodes), JSON.stringify(edges)]
    );

    res.json(result.rows[0]);
  } catch (err) { next(err); }
});

export default router;
