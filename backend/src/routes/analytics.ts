import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();

type Period = 'today' | '7d' | '30d';

function getPeriodBounds(period: Period): { from: Date; to: Date; groupBy: 'hour' | 'day' } {
  const to = new Date();
  const from = new Date();

  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
    return { from, to, groupBy: 'hour' };
  }

  if (period === '7d') {
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
    return { from, to, groupBy: 'day' };
  }

  // 30d
  from.setDate(from.getDate() - 30);
  from.setHours(0, 0, 0, 0);
  return { from, to, groupBy: 'day' };
}

// GET /api/analytics/kpis?period=today|7d|30d
router.get('/kpis', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : 'today';
    const period: Period = ['today', '7d', '30d'].includes(rawPeriod) ? (rawPeriod as Period) : 'today';
    const { from, to, groupBy } = getPeriodBounds(period);

    // ── 1. KPIs scalaires ────────────────────────────────────────────────────
    const kpiResult = await query(
      `SELECT
         COUNT(*)                                                                    AS total_calls,
         COUNT(*) FILTER (WHERE c.direction = 'inbound')                            AS inbound,
         COUNT(*) FILTER (WHERE c.direction = 'outbound')                           AS outbound,
         ROUND(AVG(c.duration))                                                     AS avg_duration_sec,
         ROUND(AVG(
           EXTRACT(EPOCH FROM (ce_t.first_transfer - c.created_at))
         ))                                                                         AS avg_time_to_transfer_sec,
         ROUND(100.0 * COUNT(*) FILTER (
           WHERE c.queue_status = 'abandoned' OR c.status = 'missed'
         ) / NULLIF(COUNT(*), 0), 1)                                               AS abandon_rate,
         ROUND(100.0 * COUNT(*) FILTER (
           WHERE c.status = 'transferred'
         ) / NULLIF(COUNT(*), 0), 1)                                               AS transfer_rate,
         ROUND(100.0 * COUNT(*) FILTER (
           WHERE EXISTS (
             SELECT 1 FROM call_summaries cs2
             WHERE cs2.call_id = c.id
               AND cs2.actions @> '[{"type":"appointment"}]'
           )
         ) / NULLIF(COUNT(*), 0), 1)                                               AS appointment_rate,
         COUNT(*) FILTER (
           WHERE LOWER(c.queue_reason) LIKE '%urgent%'
              OR EXISTS (
                SELECT 1 FROM call_summaries cs3
                WHERE cs3.call_id = c.id AND cs3.intent = 'urgence'
              )
         )                                                                         AS urgent_count
       FROM calls c
       LEFT JOIN LATERAL (
         SELECT MIN(ce.timestamp) AS first_transfer
         FROM call_events ce
         WHERE ce.call_id = c.id
           AND ce.event_type = 'twilio.routing.transferred'
       ) ce_t ON true
       WHERE c.company_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3`,
      [companyId, from.toISOString(), to.toISOString()]
    );

    const kpi = kpiResult.rows[0] || {};

    // ── 2. Volume par slot (heure ou jour) ──────────────────────────────────
    const slotExpr = groupBy === 'hour'
      ? `DATE_TRUNC('hour', c.created_at)`
      : `DATE_TRUNC('day', c.created_at)`;

    const volumeResult = await query(
      `SELECT
         ${slotExpr}                                                AS slot,
         COUNT(*)                                                   AS total,
         COUNT(*) FILTER (WHERE c.direction = 'inbound')           AS inbound,
         COUNT(*) FILTER (WHERE c.direction = 'outbound')          AS outbound
       FROM calls c
       WHERE c.company_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY slot
       ORDER BY slot ASC`,
      [companyId, from.toISOString(), to.toISOString()]
    );

    // ── 3. Appels par agent ──────────────────────────────────────────────────
    const agentResult = await query(
      `SELECT
         s.id                           AS staff_id,
         s.first_name,
         s.last_name,
         COUNT(DISTINCT c.id)           AS count
       FROM calls c
       JOIN call_events ce
         ON ce.call_id = c.id
        AND ce.event_type = 'twilio.routing.transferred'
       JOIN staff s
         ON s.id::text = ce.data->>'staffId'
       WHERE c.company_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY s.id, s.first_name, s.last_name
       ORDER BY count DESC`,
      [companyId, from.toISOString(), to.toISOString()]
    );

    // ── 4. Répartition par intent ───────────────────────────────────────────
    const intentResult = await query(
      `SELECT
         COALESCE(cs.intent, 'autre')   AS intent,
         COUNT(*)                       AS count
       FROM calls c
       LEFT JOIN call_summaries cs ON cs.call_id = c.id
       WHERE c.company_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY cs.intent
       ORDER BY count DESC`,
      [companyId, from.toISOString(), to.toISOString()]
    );

    // ── 5. Répartition par issue (status) ───────────────────────────────────
    const outcomeResult = await query(
      `SELECT
         c.status,
         COUNT(*) AS count
       FROM calls c
       WHERE c.company_id = $1
         AND c.created_at >= $2
         AND c.created_at <= $3
       GROUP BY c.status
       ORDER BY count DESC`,
      [companyId, from.toISOString(), to.toISOString()]
    );

    // ── Réponse ──────────────────────────────────────────────────────────────
    res.json({
      period,
      filters: { from: from.toISOString(), to: to.toISOString() },
      overview: {
        totalCalls:            Number(kpi.total_calls) || 0,
        inbound:               Number(kpi.inbound) || 0,
        outbound:              Number(kpi.outbound) || 0,
        avgDurationSec:        kpi.avg_duration_sec !== null ? Number(kpi.avg_duration_sec) : null,
        avgTimeToTransferSec:  kpi.avg_time_to_transfer_sec !== null ? Number(kpi.avg_time_to_transfer_sec) : null,
        abandonRate:           Number(kpi.abandon_rate) || 0,
        transferRate:          Number(kpi.transfer_rate) || 0,
        appointmentRate:       Number(kpi.appointment_rate) || 0,
        urgentCount:           Number(kpi.urgent_count) || 0,
      },
      charts: {
        volumeBySlot: volumeResult.rows.map((r) => ({
          slot:     r.slot instanceof Date ? r.slot.toISOString() : String(r.slot),
          total:    Number(r.total),
          inbound:  Number(r.inbound),
          outbound: Number(r.outbound),
        })),
        callsByAgent: agentResult.rows.map((r) => ({
          staffId:   r.staff_id,
          firstName: r.first_name,
          lastName:  r.last_name,
          count:     Number(r.count),
        })),
        intentDistribution: intentResult.rows.map((r) => ({
          intent: r.intent || 'autre',
          count:  Number(r.count),
        })),
        outcomeDistribution: outcomeResult.rows.map((r) => ({
          status: r.status,
          count:  Number(r.count),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
