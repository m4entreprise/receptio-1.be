import { Router, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { requirePermission } from '../utils/authz';

const router = Router();

// ─── Schémas Zod ─────────────────────────────────────────────────────────────

const positionSchema = z.object({ x: z.number(), y: z.number() });


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
      res.json({
        nodes: [{ id: 'entry', type: 'entry', position: { x: 400, y: 60 }, data: {} }],
        edges: [],
      });
      return;
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
