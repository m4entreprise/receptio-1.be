import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { requirePermission } from '../utils/authz';

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

function parseJsonField<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
  return value as T;
}

function normalizeScores(raw: unknown): Array<{ critere_id: string; note: number; max: number }> {
  const parsed = parseJsonField<unknown>(raw, []);
  if (Array.isArray(parsed)) {
    const normalized: Array<{ critere_id: string; note: number; max: number }> = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const score = entry as Record<string, unknown>;
      if (typeof score.critere_id !== 'string') continue;
      normalized.push({
        critere_id: score.critere_id,
        note: Number(score.note ?? 0),
        max: Number(score.max ?? 0),
      });
    }
    return normalized;
  }

  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([critereId, value]) => ({
      critere_id: critereId,
      note: typeof value === 'boolean' ? (value ? 1 : 0) : typeof value === 'number' ? value : 0,
      max: typeof value === 'boolean' ? 1 : typeof value === 'number' ? 5 : 1,
    }));
  }

  return [];
}

function normalizeFlags(raw: unknown): string[] {
  const parsed = parseJsonField<unknown[]>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
}

function isProvenAgentInteraction(row: Record<string, unknown>): boolean {
  const hasAiReceptionist = Boolean(row.has_ai_receptionist);
  const hasHumanTransfer = Boolean(row.has_human_transfer);
  const hasVerifiedRecording = Boolean(row.has_verified_recording);
  const hasHumanTranscriptMarker = Boolean(row.has_human_transcript_marker);
  const directHumanOwnership = Boolean(row.initiated_by_staff_id);

  if (hasAiReceptionist) {
    return hasHumanTransfer && (hasVerifiedRecording || hasHumanTranscriptMarker);
  }

  return directHumanOwnership || hasVerifiedRecording || hasHumanTranscriptMarker;
 }

// GET /api/analytics/kpis?period=today|7d|30d
router.get('/kpis', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'analyticsRead');
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
        volumeBySlot: volumeResult.rows.map((r: Record<string, unknown>) => ({
          slot:     r.slot instanceof Date ? r.slot.toISOString() : String(r.slot),
          total:    Number(r.total),
          inbound:  Number(r.inbound),
          outbound: Number(r.outbound),
        })),
        callsByAgent: agentResult.rows.map((r: Record<string, unknown>) => ({
          staffId:   r.staff_id,
          firstName: r.first_name,
          lastName:  r.last_name,
          count:     Number(r.count),
        })),
        intentDistribution: intentResult.rows.map((r: Record<string, unknown>) => ({
          intent: (r.intent as string) || 'autre',
          count:  Number(r.count),
        })),
        outcomeDistribution: outcomeResult.rows.map((r: Record<string, unknown>) => ({
          status: r.status,
          count:  Number(r.count),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/qa/weak-criteria?templateId=&period=7d|30d
router.get('/qa/weak-criteria', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'analyticsRead');
    const { companyId } = req.user!;
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : '30d';
    const period: Period = ['today', '7d', '30d'].includes(rawPeriod) ? (rawPeriod as Period) : '30d';
    const templateId = typeof req.query.templateId === 'string' && req.query.templateId.trim() ? req.query.templateId : null;
    const { from, to } = getPeriodBounds(period);

    const params: unknown[] = [companyId, from.toISOString(), to.toISOString()];
    let extraWhere = '';
    if (templateId) {
      params.push(templateId);
      extraWhere = ` AND car.template_id = $${params.length}`;
    }

    const result = await query(
      `SELECT car.scores, car.template_id,
               c.initiated_by_staff_id,
               EXISTS (
                 SELECT 1 FROM call_events ce_mode
                 WHERE ce_mode.call_id = c.id
                   AND ce_mode.event_type IN ('twilio.offer_b.started', 'agent_replied', 'agent_closed_call', 'agent_needs_clarification', 'bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript')
               ) AS has_ai_receptionist,
               EXISTS (
                 SELECT 1 FROM call_events ce_transfer
                 WHERE ce_transfer.call_id = c.id
                   AND ce_transfer.event_type IN ('twilio.routing.transferred', 'transfer_to_human')
               ) AS has_human_transfer,
               EXISTS (
                 SELECT 1 FROM call_events ce_recording
                 WHERE ce_recording.call_id = c.id
                   AND ce_recording.event_type IN ('twilio.recording.completed', 'twilio.streaming.recording.completed')
               ) AS has_verified_recording,
               POSITION('[Conversation avec l''agent]' IN COALESCE(tr.text, '')) > 0 AS has_human_transcript_marker
        FROM call_analysis_results car
        JOIN calls c ON c.id = car.call_id
        LEFT JOIN transcriptions tr ON tr.call_id = c.id
        WHERE c.company_id = $1
          AND car.processed_at >= $2
          AND car.processed_at <= $3${extraWhere}`,
      params
    );

    const aggregates = new Map<string, { totalNote: number; totalMax: number; count: number }>();
    for (const row of result.rows as Record<string, unknown>[]) {
      if (!isProvenAgentInteraction(row)) continue;
      for (const score of normalizeScores(row.scores)) {
        const current = aggregates.get(score.critere_id) || { totalNote: 0, totalMax: 0, count: 0 };
        current.totalNote += score.note;
        current.totalMax += score.max;
        current.count += 1;
        aggregates.set(score.critere_id, current);
      }
    }

    const criteriaLookup = aggregates.size > 0
      ? await query(
        `SELECT id, label, weight FROM analysis_criteria WHERE id = ANY($1::uuid[])`,
        [Array.from(aggregates.keys())]
      )
      : { rows: [] };

    const criteriaMeta = new Map((criteriaLookup.rows as Record<string, unknown>[]).map((row) => [String(row.id), row]));
    const response = Array.from(aggregates.entries())
      .map(([criterionId, stats]) => {
        const avg = stats.count > 0 ? stats.totalNote / stats.count : 0;
        const avgMax = stats.count > 0 ? stats.totalMax / stats.count : 0;
        const meta = criteriaMeta.get(criterionId);
        return {
          critere_id: criterionId,
          label: String(meta?.label || criterionId),
          avg: Number(avg.toFixed(2)),
          avg_max: Number(avgMax.toFixed(2)),
          stddev: 0,
          weight: Number(meta?.weight || 0),
        };
      })
      .sort((a, b) => (a.avg_max > 0 ? a.avg / a.avg_max : 1) - (b.avg_max > 0 ? b.avg / b.avg_max : 1));

    res.json({ period, templateId, criteria: response });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/qa/flags/trend?period=7d|30d&flagType=
router.get('/qa/flags/trend', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'analyticsRead');
    const { companyId } = req.user!;
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : '30d';
    const period: Period = ['today', '7d', '30d'].includes(rawPeriod) ? (rawPeriod as Period) : '30d';
    const flagType = typeof req.query.flagType === 'string' ? req.query.flagType : '';
    const { from, to } = getPeriodBounds(period);

    const result = await query(
      `SELECT car.flags, car.processed_at,
               c.initiated_by_staff_id,
               EXISTS (
                 SELECT 1 FROM call_events ce_mode
                 WHERE ce_mode.call_id = c.id
                   AND ce_mode.event_type IN ('twilio.offer_b.started', 'agent_replied', 'agent_closed_call', 'agent_needs_clarification', 'bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript')
               ) AS has_ai_receptionist,
               EXISTS (
                 SELECT 1 FROM call_events ce_transfer
                 WHERE ce_transfer.call_id = c.id
                   AND ce_transfer.event_type IN ('twilio.routing.transferred', 'transfer_to_human')
               ) AS has_human_transfer,
               EXISTS (
                 SELECT 1 FROM call_events ce_recording
                 WHERE ce_recording.call_id = c.id
                   AND ce_recording.event_type IN ('twilio.recording.completed', 'twilio.streaming.recording.completed')
               ) AS has_verified_recording,
               POSITION('[Conversation avec l''agent]' IN COALESCE(tr.text, '')) > 0 AS has_human_transcript_marker
        FROM call_analysis_results car
        JOIN calls c ON c.id = car.call_id
        LEFT JOIN transcriptions tr ON tr.call_id = c.id
        WHERE c.company_id = $1
          AND car.processed_at >= $2
          AND car.processed_at <= $3
       ORDER BY car.processed_at ASC`,
      [companyId, from.toISOString(), to.toISOString()]
    );

    const trendMap = new Map<string, number>();
    for (const row of result.rows as Record<string, unknown>[]) {
      if (!isProvenAgentInteraction(row)) continue;
      const date = String(row.processed_at).slice(0, 10);
      const flags = normalizeFlags(row.flags);
      if (!flagType || flags.includes(flagType)) {
        trendMap.set(date, (trendMap.get(date) || 0) + (!flagType ? flags.length : 1));
      }
    }

    res.json({
      period,
      flagType,
      trend: Array.from(trendMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/analytics/qa/score-distribution?templateId=&period=
router.get('/qa/score-distribution', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'analyticsRead');
    const { companyId } = req.user!;
    const rawPeriod = typeof req.query.period === 'string' ? req.query.period : '30d';
    const period: Period = ['today', '7d', '30d'].includes(rawPeriod) ? (rawPeriod as Period) : '30d';
    const templateId = typeof req.query.templateId === 'string' && req.query.templateId.trim() ? req.query.templateId : null;
    const { from, to } = getPeriodBounds(period);

    const params: unknown[] = [companyId, from.toISOString(), to.toISOString()];
    let extraWhere = '';
    if (templateId) {
      params.push(templateId);
      extraWhere = ` AND car.template_id = $${params.length}`;
    }

    const result = await query(
      `SELECT car.global_score,
               c.initiated_by_staff_id,
               EXISTS (
                 SELECT 1 FROM call_events ce_mode
                 WHERE ce_mode.call_id = c.id
                   AND ce_mode.event_type IN ('twilio.offer_b.started', 'agent_replied', 'agent_closed_call', 'agent_needs_clarification', 'bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript')
               ) AS has_ai_receptionist,
               EXISTS (
                 SELECT 1 FROM call_events ce_transfer
                 WHERE ce_transfer.call_id = c.id
                   AND ce_transfer.event_type IN ('twilio.routing.transferred', 'transfer_to_human')
               ) AS has_human_transfer,
               EXISTS (
                 SELECT 1 FROM call_events ce_recording
                 WHERE ce_recording.call_id = c.id
                   AND ce_recording.event_type IN ('twilio.recording.completed', 'twilio.streaming.recording.completed')
               ) AS has_verified_recording,
               POSITION('[Conversation avec l''agent]' IN COALESCE(tr.text, '')) > 0 AS has_human_transcript_marker
        FROM call_analysis_results car
        JOIN calls c ON c.id = car.call_id
        LEFT JOIN transcriptions tr ON tr.call_id = c.id
        WHERE c.company_id = $1
          AND car.processed_at >= $2
          AND car.processed_at <= $3${extraWhere}`,
      params
    );

    const buckets = new Map<string, number>();
    for (let start = 0; start < 100; start += 10) {
      buckets.set(`${start}-${start + 10}`, 0);
    }
    buckets.set('100-100', 0);

    for (const row of result.rows as Record<string, unknown>[]) {
      if (!isProvenAgentInteraction(row)) continue;
      const score = Math.max(0, Math.min(100, Number(row.global_score || 0)));
      const bucket = score === 100 ? '100-100' : `${Math.floor(score / 10) * 10}-${Math.floor(score / 10) * 10 + 10}`;
      buckets.set(bucket, (buckets.get(bucket) || 0) + 1);
    }

    res.json({
      period,
      templateId,
      distribution: Array.from(buckets.entries()).map(([bucket, count]) => ({ bucket, count })),
    });
  } catch (error) {
    next(error);
  }
});

export default router;
