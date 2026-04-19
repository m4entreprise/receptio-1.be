import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { requirePermission } from '../utils/authz';
import {
  analyzeCall,
  createNewTemplateVersion,
  AnalysisTemplate,
  AnalysisFlagDefinition,
  QAScore,
  QAFlagDetail,
} from '../services/qaAnalysis';

const router = Router();

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

function normalizeFlagDefinitions(raw: unknown): AnalysisFlagDefinition[] {
  const parsed = parseJsonField<unknown[]>(raw, []);
  if (!Array.isArray(parsed)) return [];
  const normalized: AnalysisFlagDefinition[] = [];
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.type !== 'string') continue;
    normalized.push({
      type: candidate.type,
      description: typeof candidate.description === 'string' ? candidate.description : '',
      requiresExtrait: Boolean(candidate.requires_extrait ?? candidate.requiresExtrait ?? false),
    });
  }
  return normalized;
}

function rowToTemplate(r: Record<string, unknown>): AnalysisTemplate {
  return {
    id: r.id as string,
    companyId: r.company_id as string,
    name: r.name as string,
    callType: r.call_type as string,
    promptTemplate: (r.prompt_template as string) || '',
    systemPrompt: (r.system_prompt as string) || '',
    flagDefinitions: normalizeFlagDefinitions(r.flag_definitions),
    outputSchema: parseJsonField<Record<string, unknown> | null>(r.output_schema, null),
    version: Number(r.version || 1),
    isActive: Boolean(r.is_active),
    supersededBy: (r.superseded_by as string | null) ?? null,
    createdAt: r.created_at as Date,
  };
}

function getPeriodBounds(period: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (period === 'today') {
    from.setHours(0, 0, 0, 0);
  } else if (period === '7d') {
    from.setDate(from.getDate() - 7);
    from.setHours(0, 0, 0, 0);
  } else {
    from.setDate(from.getDate() - 30);
    from.setHours(0, 0, 0, 0);
  }
  return { from, to };
}

function normalizeScores(raw: unknown): QAScore[] {
  const parsed = parseJsonField<unknown>(raw, []);
  if (Array.isArray(parsed)) {
    const normalized: QAScore[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const score = entry as Record<string, unknown>;
      if (typeof score.critere_id !== 'string') continue;
      normalized.push({
        critere_id: score.critere_id,
        note: Number(score.note ?? 0),
        max: Number(score.max ?? 0),
        justification: typeof score.justification === 'string' ? score.justification : '',
      });
    }
    return normalized;
  }

  if (parsed && typeof parsed === 'object') {
    return Object.entries(parsed as Record<string, unknown>).map(([critereId, value]) => ({
      critere_id: critereId,
      note: typeof value === 'boolean' ? (value ? 1 : 0) : typeof value === 'number' ? value : 0,
      max: typeof value === 'boolean' ? 1 : typeof value === 'number' ? 5 : 1,
      justification: '',
    }));
  }

  return [];
}

function normalizeFlags(raw: unknown): string[] {
  const parsed = parseJsonField<unknown[]>(raw, []);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === 'string') : [];
}

function normalizeFlagsDetail(raw: unknown, flags: string[]): QAFlagDetail[] {
  const parsed = parseJsonField<unknown[]>(raw, []);
  if (Array.isArray(parsed) && parsed.length > 0) {
    const normalized: QAFlagDetail[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const flag = entry as Record<string, unknown>;
      if (typeof flag.type !== 'string') continue;
      normalized.push({
        type: flag.type,
        extrait: typeof flag.extrait === 'string' ? flag.extrait : null,
        position_ms: typeof flag.position_ms === 'number' ? flag.position_ms : undefined,
      });
    }
    return normalized;
  }

  return flags.map((flag) => ({ type: flag, extrait: null }));
}

function normalizeVerbatims(raw: unknown): Record<string, string> {
  const parsed = parseJsonField<Record<string, unknown>>(raw, {});
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  return Object.fromEntries(
    Object.entries(parsed)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string])
  );
}

function buildScoreDetails(scores: QAScore[], criteriaRows: Record<string, unknown>[], verbatims: Record<string, string>) {
  const criteriaMap = new Map(criteriaRows.map((row) => [String(row.id), row]));
  return scores.map((score) => {
    const criterion = criteriaMap.get(score.critere_id);
    return {
      critere_id: score.critere_id,
      label: String(criterion?.label || score.critere_id),
      note: Number(score.note || 0),
      max: Number(score.max || 0),
      poids: Number(criterion?.weight || 0),
      justification: score.justification || verbatims[score.critere_id] || '',
    };
  });
}

function buildCoachingFocus(topFlag: { type: string; count: number } | null, callCount: number): string {
  if (!topFlag || callCount <= 0) return 'Aucun focus de coaching détecté sur la période.';
  const ratio = Math.round((topFlag.count / callCount) * 100);
  return `Travaille principalement sur ${topFlag.type} (${ratio}% des appels).`;
}

function hasVerifiedHumanConversation(row: Record<string, unknown>): boolean {
  return Boolean(row.has_verified_recording) || Boolean(row.has_human_transcript_marker);
}

function deriveConversationMode(row: Record<string, unknown>): 'ai_only' | 'ai_and_human' | 'unknown' {
  const hasHumanTransfer = Boolean(row.has_human_transfer);
  const hasAiReceptionist = Boolean(row.has_ai_receptionist);
  if (hasAiReceptionist && hasHumanTransfer && hasVerifiedHumanConversation(row)) return 'ai_and_human';
  if (hasAiReceptionist) return 'ai_only';
  return 'unknown';
}

function isAgentInteractionProven(row: Record<string, unknown>): boolean {
  const hasAiReceptionist = Boolean(row.has_ai_receptionist);
  const hasHumanTransfer = Boolean(row.has_human_transfer);
  const directHumanOwnership = Boolean(row.initiated_by_staff_id);
  if (hasAiReceptionist) {
    return hasHumanTransfer && hasVerifiedHumanConversation(row);
  }
  return directHumanOwnership || hasVerifiedHumanConversation(row);
}

function getAgentInteractionStatus(row: Record<string, unknown>): 'proven' | 'unverified' | 'not_agent' {
  if (isAgentInteractionProven(row)) return 'proven';
  if (Boolean(row.has_ai_receptionist) || Boolean(row.has_human_transfer)) return 'unverified';
  return 'not_agent';
}

async function ensureTemplateOwnership(templateId: string, companyId: string) {
  const result = await query(
    `SELECT * FROM analysis_templates WHERE id = $1 AND company_id = $2`,
    [templateId, companyId]
  );
  if (result.rows.length === 0) throw new AppError('Template not found', 404);
  return rowToTemplate(result.rows[0]);
}

router.get('/templates', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const result = await query(
      `SELECT t.*,
              (SELECT COUNT(*) FROM analysis_criteria ac WHERE ac.template_id = t.id) AS criteria_count,
              (SELECT COUNT(*) FROM call_analysis_results car WHERE car.template_id = t.id) AS results_count
       FROM analysis_templates t
       WHERE t.company_id = $1
       ORDER BY t.version DESC, t.created_at DESC`,
      [companyId]
    );

    res.json({
      templates: result.rows.map((row: Record<string, unknown>) => ({
        ...rowToTemplate(row),
        criteriaCount: Number(row.criteria_count || 0),
        resultsCount: Number(row.results_count || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/templates', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const {
      name,
      callType = '*',
      promptTemplate,
      systemPrompt = '',
      flagDefinitions = [],
      outputSchema = null,
    } = req.body;

    if (!name || typeof name !== 'string') throw new AppError('name is required', 400);
    if (!promptTemplate || typeof promptTemplate !== 'string') throw new AppError('promptTemplate is required', 400);

    const result = await query(
      `INSERT INTO analysis_templates (company_id, name, call_type, prompt_template, system_prompt, flag_definitions, output_schema)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        companyId,
        name.trim(),
        callType,
        promptTemplate,
        typeof systemPrompt === 'string' ? systemPrompt : '',
        JSON.stringify(Array.isArray(flagDefinitions) ? flagDefinitions : []),
        outputSchema ? JSON.stringify(outputSchema) : null,
      ]
    );

    res.status(201).json({ template: rowToTemplate(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

router.get('/templates/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const template = await ensureTemplateOwnership(id, companyId);
    const cResult = await query(
      `SELECT * FROM analysis_criteria WHERE template_id = $1 ORDER BY position ASC`,
      [id]
    );
    res.json({ template: { ...template, criteria: cResult.rows } });
  } catch (error) {
    next(error);
  }
});

router.patch('/templates/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const { name, callType, promptTemplate, systemPrompt, flagDefinitions, isActive, outputSchema } = req.body;
    const existing = await ensureTemplateOwnership(id, companyId);

    const versionSensitive =
      (promptTemplate !== undefined && promptTemplate !== existing.promptTemplate)
      || (systemPrompt !== undefined && systemPrompt !== existing.systemPrompt)
      || (flagDefinitions !== undefined && JSON.stringify(flagDefinitions) !== JSON.stringify(existing.flagDefinitions));

    if (versionSensitive) {
      const usageResult = await query(`SELECT COUNT(*) AS cnt FROM call_analysis_results WHERE template_id = $1`, [id]);
      const hasResults = Number(usageResult.rows[0].cnt || 0) > 0;
      if (hasResults) {
        const newTemplate = await createNewTemplateVersion(existing, {
          name,
          callType,
          promptTemplate,
          systemPrompt,
          flagDefinitions: Array.isArray(flagDefinitions) ? flagDefinitions : undefined,
          outputSchema,
        });
        res.json({ template: newTemplate, versioned: true });
        return;
      }
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (callType !== undefined) { fields.push(`call_type = $${idx++}`); values.push(callType); }
    if (promptTemplate !== undefined) { fields.push(`prompt_template = $${idx++}`); values.push(promptTemplate); }
    if (systemPrompt !== undefined) { fields.push(`system_prompt = $${idx++}`); values.push(systemPrompt); }
    if (flagDefinitions !== undefined) { fields.push(`flag_definitions = $${idx++}`); values.push(JSON.stringify(Array.isArray(flagDefinitions) ? flagDefinitions : [])); }
    if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(isActive); }
    if (outputSchema !== undefined) { fields.push(`output_schema = $${idx++}`); values.push(outputSchema ? JSON.stringify(outputSchema) : null); }

    if (fields.length === 0) {
      res.json({ template: existing, versioned: false });
      return;
    }

    values.push(id);
    const updated = await query(
      `UPDATE analysis_templates SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ template: rowToTemplate(updated.rows[0]), versioned: false });
  } catch (error) {
    next(error);
  }
});

router.delete('/templates/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    await ensureTemplateOwnership(id, companyId);
    const usageResult = await query(`SELECT COUNT(*) AS cnt FROM call_analysis_results WHERE template_id = $1`, [id]);
    const hasResults = Number(usageResult.rows[0].cnt || 0) > 0;

    if (hasResults) {
      await query(`UPDATE analysis_templates SET is_active = false WHERE id = $1`, [id]);
    } else {
      await query(`DELETE FROM analysis_templates WHERE id = $1`, [id]);
    }

    res.json({ success: true, softDeleted: hasResults });
  } catch (error) {
    next(error);
  }
});

router.get('/templates/:id/criteria', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    await ensureTemplateOwnership(id, companyId);
    const result = await query(`SELECT * FROM analysis_criteria WHERE template_id = $1 ORDER BY position ASC`, [id]);
    res.json({ criteria: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/templates/:id/criteria', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const { label, description = null, weight = 10, type = 'boolean', required = false, position = 0 } = req.body;
    if (!label || typeof label !== 'string') throw new AppError('label is required', 400);
    await ensureTemplateOwnership(id, companyId);
    const result = await query(
      `INSERT INTO analysis_criteria (template_id, label, description, weight, type, required, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, label.trim(), description, weight, type, required, position]
    );
    res.status(201).json({ criterion: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/criteria/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;

    const cResult = await query(
      `SELECT ac.* FROM analysis_criteria ac
       JOIN analysis_templates t ON t.id = ac.template_id
       WHERE ac.id = $1 AND t.company_id = $2`,
      [id, companyId]
    );
    if (cResult.rows.length === 0) throw new AppError('Criterion not found', 404);

    const { label, description, weight, type, required, position } = req.body;
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (label !== undefined) { fields.push(`label = $${idx++}`); values.push(label); }
    if (description !== undefined) { fields.push(`description = $${idx++}`); values.push(description); }
    if (weight !== undefined) { fields.push(`weight = $${idx++}`); values.push(weight); }
    if (type !== undefined) { fields.push(`type = $${idx++}`); values.push(type); }
    if (required !== undefined) { fields.push(`required = $${idx++}`); values.push(required); }
    if (position !== undefined) { fields.push(`position = $${idx++}`); values.push(position); }

    if (fields.length === 0) {
      res.json({ criterion: cResult.rows[0] });
      return;
    }

    values.push(id);
    const updated = await query(`UPDATE analysis_criteria SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`, values);
    res.json({ criterion: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/criteria/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;

    const cResult = await query(
      `SELECT ac.id FROM analysis_criteria ac
       JOIN analysis_templates t ON t.id = ac.template_id
       WHERE ac.id = $1 AND t.company_id = $2`,
      [id, companyId]
    );
    if (cResult.rows.length === 0) throw new AppError('Criterion not found', 404);

    await query(`DELETE FROM analysis_criteria WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.post('/analyze/:callId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { callId } = req.params;
    const { templateId, force = false } = req.body;
    if (!templateId) throw new AppError('templateId is required', 400);

    if (!force) {
      const existing = await query(`SELECT id FROM call_analysis_results WHERE call_id = $1 AND template_id = $2 LIMIT 1`, [callId, templateId]);
      if (existing.rows.length > 0) {
        throw new AppError('Une analyse existe déjà pour cet appel avec ce template. Utilisez force=true pour relancer.', 409);
      }
    }

    const result = await analyzeCall(callId, templateId, companyId);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

router.get('/results', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const periodParam = typeof req.query.period === 'string' ? req.query.period : '30d';
    const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : null;
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(200, Math.max(10, Number(req.query.limit || 50)));
    const offset = (page - 1) * limit;
    const { from, to } = getPeriodBounds(periodParam);

    const params: unknown[] = [companyId, from.toISOString(), to.toISOString()];
    let extraWhere = '';
    if (templateId) {
      params.push(templateId);
      extraWhere += ` AND car.template_id = $${params.length}`;
    }

    const countResult = await query(
      `SELECT COUNT(*) AS total
       FROM call_analysis_results car
       JOIN calls c ON c.id = car.call_id
       WHERE c.company_id = $1
         AND car.processed_at >= $2
         AND car.processed_at <= $3${extraWhere}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await query(
      `SELECT
         car.id, car.call_id, car.template_id, car.template_version,
         car.scores, car.global_score, car.verbatims, car.flags, car.flags_detail,
         car.resume, car.coaching_tip, car.model, car.prompt_hash, car.retries, car.processed_at,
         c.caller_number, c.created_at AS call_created_at, c.direction, c.initiated_by_staff_id,
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
         POSITION('[Conversation avec l''agent]' IN COALESCE(tr.text, '')) > 0 AS has_human_transcript_marker,
         t.name AS template_name, t.version AS template_current_version,
         COALESCE(s_init.id, s_xfer.id) AS agent_id,
         COALESCE(s_init.first_name, s_xfer.first_name) AS agent_first_name,
         COALESCE(s_init.last_name, s_xfer.last_name) AS agent_last_name
       FROM call_analysis_results car
       JOIN calls c ON c.id = car.call_id
       JOIN analysis_templates t ON t.id = car.template_id
       LEFT JOIN transcriptions tr ON tr.call_id = c.id
       LEFT JOIN staff s_init ON s_init.id = c.initiated_by_staff_id
       LEFT JOIN LATERAL (
         SELECT s2.id, s2.first_name, s2.last_name
         FROM call_events ce2
         JOIN staff s2 ON s2.id::text = ce2.data->>'staffId'
         WHERE ce2.call_id = c.id
           AND ce2.event_type = 'twilio.routing.transferred'
         LIMIT 1
       ) s_xfer ON true
       WHERE c.company_id = $1
         AND car.processed_at >= $2
         AND car.processed_at <= $3${extraWhere}
       ORDER BY car.processed_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      results: dataResult.rows.map((row: Record<string, unknown>) => {
        const flags = normalizeFlags(row.flags);
        return {
          ...row,
          conversation_mode: deriveConversationMode(row),
          agent_interaction_proven: isAgentInteractionProven(row),
          agent_interaction_status: getAgentInteractionStatus(row),
          flags,
          flags_detail: normalizeFlagsDetail(row.flags_detail, flags),
        };
      }),
      total: Number(countResult.rows[0].total || 0),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/results/:callId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { callId } = req.params;

    const analysesResult = await query(
      `SELECT
         car.id, car.call_id, car.template_id, car.template_version,
         car.scores, car.global_score, car.verbatims, car.flags, car.flags_detail,
         car.resume, car.coaching_tip, car.model, car.prompt_hash, car.retries, car.processed_at,
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
         POSITION('[Conversation avec l''agent]' IN COALESCE(tr.text, '')) > 0 AS has_human_transcript_marker,
         t.name AS template_name, t.version AS template_current_version,
         c.created_at AS call_created_at,
         COALESCE(s_init.id, s_xfer.id) AS agent_id,
         COALESCE(s_init.first_name, s_xfer.first_name) AS agent_first_name,
         COALESCE(s_init.last_name, s_xfer.last_name) AS agent_last_name
       FROM call_analysis_results car
       JOIN calls c ON c.id = car.call_id
       JOIN analysis_templates t ON t.id = car.template_id
       LEFT JOIN transcriptions tr ON tr.call_id = c.id
       LEFT JOIN staff s_init ON s_init.id = c.initiated_by_staff_id
       LEFT JOIN LATERAL (
         SELECT s2.id, s2.first_name, s2.last_name
         FROM call_events ce2
         JOIN staff s2 ON s2.id::text = ce2.data->>'staffId'
         WHERE ce2.call_id = c.id
           AND ce2.event_type = 'twilio.routing.transferred'
         LIMIT 1
       ) s_xfer ON true
       WHERE car.call_id = $1 AND c.company_id = $2
       ORDER BY car.processed_at DESC`,
      [callId, companyId]
    );

    const history = analysesResult.rows.map((row: Record<string, unknown>) => ({
      id: row.id,
      template_name: row.template_name,
      global_score: Number(row.global_score || 0),
      conversation_mode: deriveConversationMode(row),
      agent_interaction_proven: isAgentInteractionProven(row),
      agent_interaction_status: getAgentInteractionStatus(row),
      flags: normalizeFlags(row.flags),
      processed_at: row.processed_at,
    }));

    const latest = analysesResult.rows[0] as Record<string, unknown> | undefined;
    if (!latest) {
      res.json({ result: null, results: [] });
      return;
    }

    const criteriaResult = await query(
      `SELECT id, label, weight FROM analysis_criteria WHERE template_id = $1 ORDER BY position ASC`,
      [latest.template_id]
    );

    const scores = normalizeScores(latest.scores);
    const flags = normalizeFlags(latest.flags);
    const verbatims = normalizeVerbatims(latest.verbatims);
    const flagsDetail = normalizeFlagsDetail(latest.flags_detail, flags);

    res.json({
      result: {
        call_id: latest.call_id,
        agent: isAgentInteractionProven(latest) && latest.agent_id ? { id: latest.agent_id, name: `${latest.agent_first_name || ''} ${latest.agent_last_name || ''}`.trim() } : null,
        template: { id: latest.template_id, name: latest.template_name, version: Number(latest.template_version || latest.template_current_version || 1) },
        conversation_mode: deriveConversationMode(latest),
        agent_interaction_proven: isAgentInteractionProven(latest),
        agent_interaction_status: getAgentInteractionStatus(latest),
        global_score: Number(latest.global_score || 0),
        processed_at: latest.processed_at,
        resume: (latest.resume as string) || '',
        coaching_tip: (latest.coaching_tip as string) || '',
        scores: buildScoreDetails(scores, criteriaResult.rows as Record<string, unknown>[], verbatims),
        flags_detail: flagsDetail.map((flag) => ({
          type: flag.type,
          extrait: flag.extrait,
          position_ms: flag.position_ms ?? null,
        })),
      },
      results: history,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/agents/:staffId/profile', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { staffId } = req.params;
    const period = typeof req.query.period === 'string' ? req.query.period : '30d';
    const { from, to } = getPeriodBounds(period);

    const agentResult = await query(
      `SELECT id, first_name, last_name FROM staff WHERE id = $1 AND company_id = $2`,
      [staffId, companyId]
    );
    if (agentResult.rows.length === 0) throw new AppError('Staff member not found', 404);

    const analysesResult = await query(
      `SELECT car.call_id, car.global_score, car.flags, car.scores, car.processed_at,
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
         AND c.initiated_by_staff_id = $2
         AND car.processed_at >= $3
         AND car.processed_at <= $4
       ORDER BY car.processed_at DESC`,
      [companyId, staffId, from.toISOString(), to.toISOString()]
    );

    const rows = (analysesResult.rows as Record<string, unknown>[]).filter((row) => isAgentInteractionProven(row));
    const callCount = rows.length;
    const avgScore = callCount > 0 ? Math.round(rows.reduce((sum, row) => sum + Number(row.global_score || 0), 0) / callCount) : 0;

    const trendMap = new Map<string, number[]>();
    const flagMap = new Map<string, number>();
    const weakCriterionMap = new Map<string, { totalNote: number; totalMax: number; count: number }>();
    for (const row of rows) {
      const date = String(row.processed_at).slice(0, 10);
      const trend = trendMap.get(date) || [];
      trend.push(Number(row.global_score || 0));
      trendMap.set(date, trend);

      for (const flag of normalizeFlags(row.flags)) {
        flagMap.set(flag, (flagMap.get(flag) || 0) + 1);
      }

      for (const score of normalizeScores(row.scores)) {
        const current = weakCriterionMap.get(score.critere_id) || { totalNote: 0, totalMax: 0, count: 0 };
        current.totalNote += Number(score.note || 0);
        current.totalMax += Number(score.max || 0);
        current.count += 1;
        weakCriterionMap.set(score.critere_id, current);
      }
    }

    const criterionIds = Array.from(weakCriterionMap.keys());
    const criteriaLookup = criterionIds.length > 0
      ? await query(`SELECT id, label FROM analysis_criteria WHERE id = ANY($1::uuid[])`, [criterionIds])
      : { rows: [] };
    const labels = new Map((criteriaLookup.rows as Record<string, unknown>[]).map((row) => [String(row.id), String(row.label)]));

    const flagBreakdown = Array.from(flagMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);
    const topFlag = flagBreakdown[0] || null;

    res.json({
      agent: { id: agentResult.rows[0].id, name: `${agentResult.rows[0].first_name} ${agentResult.rows[0].last_name}`.trim() },
      period,
      call_count: callCount,
      avg_score: avgScore,
      score_trend: Array.from(trendMap.entries())
        .map(([date, scores]) => ({ date, score: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) }))
        .sort((a, b) => a.date.localeCompare(b.date)),
      top_flag: topFlag,
      flag_breakdown: flagBreakdown,
      weak_criteria: Array.from(weakCriterionMap.entries())
        .map(([critereId, stats]) => ({
          label: labels.get(critereId) || critereId,
          avg_note: stats.count > 0 ? Number((stats.totalNote / stats.count).toFixed(2)) : 0,
          avg_max: stats.count > 0 ? Number((stats.totalMax / stats.count).toFixed(2)) : 0,
        }))
        .sort((a, b) => (a.avg_max > 0 ? a.avg_note / a.avg_max : 1) - (b.avg_max > 0 ? b.avg_note / b.avg_max : 1)),
      best_calls: rows.slice().sort((a, b) => Number(b.global_score || 0) - Number(a.global_score || 0)).slice(0, 3).map((row) => ({ call_id: row.call_id, score: Number(row.global_score || 0), date: row.processed_at })),
      worst_calls: rows.slice().sort((a, b) => Number(a.global_score || 0) - Number(b.global_score || 0)).slice(0, 3).map((row) => ({ call_id: row.call_id, score: Number(row.global_score || 0), date: row.processed_at })),
      coaching_focus: buildCoachingFocus(topFlag, callCount),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/alerts', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const acknowledged = req.query.acknowledged === 'true';
    const result = await query(
      `SELECT qa.id, qa.call_id, qa.flag_type, qa.agent_id, qa.extrait, qa.acknowledged, qa.created_at,
              s.first_name, s.last_name
       FROM qa_alerts qa
       LEFT JOIN staff s ON s.id = qa.agent_id
       WHERE qa.company_id = $1 AND qa.acknowledged = $2
       ORDER BY qa.created_at DESC`,
      [companyId, acknowledged]
    );
    res.json({
      alerts: result.rows,
      unacknowledgedCount: acknowledged ? undefined : result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/alerts/:id/acknowledge', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    const result = await query(
      `UPDATE qa_alerts qa
       SET acknowledged = true
       WHERE qa.id = $1 AND qa.company_id = $2
       RETURNING qa.id`,
      [id, companyId]
    );
    if (result.rows.length === 0) throw new AppError('Alert not found', 404);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.get('/batch-eligible', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'qaManage');
    const { companyId } = req.user!;
    const templateId = typeof req.query.templateId === 'string' ? req.query.templateId : null;
    const periodParam = typeof req.query.period === 'string' ? req.query.period : '30d';
    const skipExisting = req.query.skipExisting !== 'false';
    if (!templateId) throw new AppError('templateId is required', 400);

    await ensureTemplateOwnership(templateId, companyId);
    const { from, to } = getPeriodBounds(periodParam);
    let sql = `
      SELECT c.id, c.caller_number, c.created_at, c.direction
      FROM calls c
      INNER JOIN transcriptions t ON t.call_id = c.id AND t.text IS NOT NULL AND t.text <> ''
      WHERE c.company_id = $1
        AND c.created_at >= $2
        AND c.created_at <= $3`;
    const params: unknown[] = [companyId, from.toISOString(), to.toISOString()];
    if (skipExisting) {
      params.push(templateId);
      sql += ` AND NOT EXISTS (
        SELECT 1 FROM call_analysis_results car
        WHERE car.call_id = c.id AND car.template_id = $${params.length}
      )`;
    }

    sql += ` ORDER BY c.created_at DESC LIMIT 100`;
    const result = await query(sql, params);
    res.json({
      calls: result.rows.map((r: Record<string, unknown>) => ({
        id: r.id,
        callerNumber: r.caller_number,
        createdAt: r.created_at,
        direction: r.direction,
      })),
      total: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
