import { createHash } from 'crypto';
import { z } from 'zod';
import { query, getClient } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { generateResponse } from './mistral';
import logger from '../utils/logger';

const DEFAULT_ALLOWED_FLAGS = [
  'manquement_script',
  'question_oubliee',
  'promesse_non_tenue',
  'client_irrite',
  'transfert_rate',
  'prospect_chaud',
  'appel_exemplaire',
] as const;

const CRITICAL_FLAGS = ['prospect_chaud', 'promesse_non_tenue', 'transfert_rate'] as const;

export interface AnalysisFlagDefinition {
  type: string;
  description: string;
  requiresExtrait?: boolean;
}

export interface AnalysisTemplate {
  id: string;
  companyId: string;
  name: string;
  callType: string;
  promptTemplate: string;
  systemPrompt: string;
  flagDefinitions: AnalysisFlagDefinition[];
  outputSchema: Record<string, unknown> | null;
  version: number;
  isActive: boolean;
  supersededBy: string | null;
  createdAt: Date;
}

export interface AnalysisCriteria {
  id: string;
  templateId: string;
  label: string;
  description: string | null;
  weight: number;
  type: 'boolean' | 'score_0_5' | 'text';
  required: boolean;
  position: number;
}

export interface QAScore {
  critere_id: string;
  note: number;
  max: number;
  justification: string;
}

export interface QAFlagDetail {
  type: string;
  extrait: string | null;
  position_ms?: number;
}

export interface QAAnalysisResult {
  scores: QAScore[];
  flagsDetail: QAFlagDetail[];
  flags: string[];
  verbatims: Record<string, string>;
  conversationMode: 'ai_only' | 'ai_and_human' | 'unknown';
  resume: string;
  coachingTip: string;
  globalScore: number;
  model: string;
  promptHash: string;
  retries: number;
  rawResponse: string;
}

interface TemplateWithCriteria extends AnalysisTemplate {
  criteria: AnalysisCriteria[];
}

interface CallForAnalysis {
  id: string;
  companyId: string;
  agentId: string | null;
  transcript: string;
  intent: string;
  conversationMode: 'ai_only' | 'ai_and_human' | 'unknown';
}

function safeJSON(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function stripCodeFences(raw: string): string {
  return raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
}

function normalizeFlagDefinitions(raw: unknown): AnalysisFlagDefinition[] {
  if (!Array.isArray(raw)) return [];

  const normalized: AnalysisFlagDefinition[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.type !== 'string' || !candidate.type.trim()) continue;
    normalized.push({
      type: candidate.type.trim(),
      description: typeof candidate.description === 'string' ? candidate.description : '',
      requiresExtrait: Boolean(candidate.requires_extrait ?? candidate.requiresExtrait ?? false),
    });
  }
  return normalized;
}

function getAllowedFlags(template: AnalysisTemplate): string[] {
  const defined = template.flagDefinitions.map((flag) => flag.type).filter(Boolean);
  return defined.length > 0 ? defined : [...DEFAULT_ALLOWED_FLAGS];
}

function createQAResultSchema(allowedFlags: string[]) {
  return z.object({
    scores: z.array(z.object({
      critere_id: z.string(),
      note: z.number(),
      max: z.number().positive(),
      justification: z.string().min(10),
    })),
    flags_detail: z.array(z.object({
      type: z.string().refine((value) => allowedFlags.includes(value), 'Flag non autorisé'),
      extrait: z.string().nullable(),
      position_ms: z.number().optional(),
    })),
    resume: z.string().max(400),
    coaching_tip: z.string().max(300),
  });
}

function buildSchemaDescription(allowedFlags: string[]): string {
  return JSON.stringify({
    type: 'object',
    additionalProperties: false,
    properties: {
      scores: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            critere_id: { type: 'string' },
            note: { type: 'number' },
            max: { type: 'number' },
            justification: { type: 'string', minLength: 10 },
          },
          required: ['critere_id', 'note', 'max', 'justification'],
        },
      },
      flags_detail: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            type: { type: 'string', enum: allowedFlags },
            extrait: { type: ['string', 'null'] },
            position_ms: { type: 'number' },
          },
          required: ['type', 'extrait'],
        },
      },
      resume: { type: 'string', maxLength: 400 },
      coaching_tip: { type: 'string', maxLength: 300 },
    },
    required: ['scores', 'flags_detail', 'resume', 'coaching_tip'],
  }, null, 2);
}

export function computeScore(scores: QAScore[], criteria: AnalysisCriteria[]): number {
  const criteriaMap = Object.fromEntries(criteria.map((criterion) => [criterion.id, criterion]));
  let weightedSum = 0;
  let totalWeight = 0;

  for (const score of scores) {
    const criterion = criteriaMap[score.critere_id];
    if (!criterion || score.max <= 0) continue;
    const normalized = Math.max(0, Math.min(1, score.note / score.max));
    weightedSum += normalized * criterion.weight;
    totalWeight += criterion.weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 100) : 0;
}

function extractFlagTypes(flagsDetail: QAFlagDetail[]): string[] {
  return Array.from(new Set(flagsDetail.map((flag) => flag.type)));
}

function extractVerbatims(scores: QAScore[]): Record<string, string> {
  return Object.fromEntries(scores.map((score) => [score.critere_id, score.justification]));
}

function buildPrompt(
  transcription: string,
  intent: string,
  template: TemplateWithCriteria,
  conversationMode: 'ai_only' | 'ai_and_human' | 'unknown'
): string {
  const criteresBlock = template.criteria
    .sort((a, b) => a.position - b.position)
    .map((criterion) => `- [${criterion.id}] ${criterion.label} (${criterion.type}, poids ${criterion.weight}%) : ${criterion.description || 'Aucune précision fournie.'}`)
    .join('\n');

  const allowedFlags = getAllowedFlags(template);
  const flagsBlock = allowedFlags
    .map((type) => {
      const definition = template.flagDefinitions.find((flag) => flag.type === type);
      return `  - "${type}" : ${definition?.description || 'Flag critique ou qualitatif du template.'}`;
    })
    .join('\n');

  const basePrompt = template.systemPrompt?.trim() || template.promptTemplate?.trim() || 'Tu es un expert QA en relation client et tu réponds uniquement avec un JSON valide.';

  return `${basePrompt}

## Transcription
${transcription}

## Intent détecté
${intent}

## Contexte de conversation
Mode détecté : ${conversationMode}
- ai_only = conversation avec le réceptionniste IA uniquement
- ai_and_human = conversation impliquant aussi un agent humain après transfert
- unknown = impossible à déterminer avec certitude
Adapte l'analyse à ce contexte et ne confonds jamais le réceptionniste IA avec un agent humain transféré.

## Critères d'évaluation
${criteresBlock}

## Flags autorisés (liste fermée)
${flagsBlock}
Tout flag hors de cette liste doit être ignoré.
Chaque flag DOIT contenir un champ "extrait" avec la citation verbatim déclenchante, ou null.

## Format de réponse
Retourne UNIQUEMENT un JSON valide selon ce schéma. Aucun texte avant ou après.
${buildSchemaDescription(allowedFlags)}`.trim();
}

async function fetchTemplate(companyId: string, templateId: string): Promise<TemplateWithCriteria> {
  const [templateResult, criteriaResult] = await Promise.all([
    query(
      `SELECT id, company_id, name, call_type, prompt_template, system_prompt, flag_definitions, output_schema,
              version, is_active, superseded_by, created_at
       FROM analysis_templates
       WHERE id = $1 AND company_id = $2`,
      [templateId, companyId]
    ),
    query(
      `SELECT id, template_id, label, description, weight, type, required, position
       FROM analysis_criteria
       WHERE template_id = $1
       ORDER BY position ASC`,
      [templateId]
    ),
  ]);

  if (templateResult.rows.length === 0) {
    throw new AppError('Template not found', 404);
  }

  const row = templateResult.rows[0] as Record<string, unknown>;
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    name: row.name as string,
    callType: row.call_type as string,
    promptTemplate: (row.prompt_template as string) || '',
    systemPrompt: (row.system_prompt as string) || '',
    flagDefinitions: normalizeFlagDefinitions(row.flag_definitions),
    outputSchema: (row.output_schema as Record<string, unknown> | null) ?? null,
    version: Number(row.version || 1),
    isActive: Boolean(row.is_active),
    supersededBy: (row.superseded_by as string | null) ?? null,
    createdAt: row.created_at as Date,
    criteria: criteriaResult.rows.map((criterionRow: Record<string, unknown>) => ({
      id: criterionRow.id as string,
      templateId: criterionRow.template_id as string,
      label: criterionRow.label as string,
      description: (criterionRow.description as string | null) ?? null,
      weight: Number(criterionRow.weight || 0),
      type: criterionRow.type as 'boolean' | 'score_0_5' | 'text',
      required: Boolean(criterionRow.required),
      position: Number(criterionRow.position || 0),
    })),
  };
}

async function fetchCall(callId: string, companyId: string): Promise<CallForAnalysis> {
  const result = await query(
    `SELECT c.id, c.company_id, c.initiated_by_staff_id,
            t.text AS transcript,
            cs.intent,
            cs.summary,
            EXISTS (
              SELECT 1
              FROM call_events ce
              WHERE ce.call_id = c.id
                AND ce.event_type IN ('twilio.offer_b.started', 'agent_replied', 'agent_closed_call', 'agent_needs_clarification', 'bbis.turn.completed', 'bbis.turn.failed', 'bbis.turn.no_transcript')
            ) AS has_ai_receptionist,
            EXISTS (
              SELECT 1
              FROM call_events ce
              WHERE ce.call_id = c.id
                AND ce.event_type IN ('twilio.routing.transferred', 'transfer_to_human')
            ) AS has_human_transfer,
            EXISTS (
              SELECT 1
              FROM call_events ce
              WHERE ce.call_id = c.id
                AND ce.event_type IN ('twilio.recording.completed', 'twilio.streaming.recording.completed')
            ) AS has_verified_recording,
            POSITION('[Conversation avec l''agent]' IN COALESCE(t.text, '')) > 0 AS has_human_transcript_marker
     FROM calls c
     LEFT JOIN transcriptions t ON t.call_id = c.id
     LEFT JOIN call_summaries cs ON cs.call_id = c.id
     WHERE c.id = $1 AND c.company_id = $2`,
    [callId, companyId]
  );

  if (result.rows.length === 0) {
    throw new AppError('Call not found', 404);
  }

  const row = result.rows[0] as Record<string, unknown>;
  const transcript = typeof row.transcript === 'string' && row.transcript.trim()
    ? (row.transcript as string)
    : typeof row.summary === 'string' && row.summary.trim()
      ? `Résumé disponible mais transcription manquante : ${row.summary as string}`
      : 'Aucune transcription disponible.';
  const hasAiReceptionist = Boolean(row.has_ai_receptionist);
  const hasHumanTransfer = Boolean(row.has_human_transfer);
  const hasVerifiedHumanConversation = Boolean(row.has_verified_recording) || Boolean(row.has_human_transcript_marker);
  const conversationMode = hasAiReceptionist && hasHumanTransfer && hasVerifiedHumanConversation
    ? 'ai_and_human'
    : hasAiReceptionist && !hasHumanTransfer
      ? 'ai_only'
      : 'unknown';

  return {
    id: row.id as string,
    companyId: row.company_id as string,
    agentId: (row.initiated_by_staff_id as string | null) ?? null,
    transcript,
    intent: (row.intent as string) || 'inconnu',
    conversationMode,
  };
}

async function upsertAnalysisResult(
  callId: string,
  template: AnalysisTemplate,
  payload: {
    scores: QAScore[];
    flags: string[];
    flagsDetail: QAFlagDetail[];
    globalScore: number;
    verbatims: Record<string, string>;
    resume: string;
    coachingTip: string;
    model: string;
    promptHash: string;
    retries: number;
    rawResponse: string;
  }
) {
  const existing = await query(
    `SELECT id
     FROM call_analysis_results
     WHERE call_id = $1 AND template_id = $2
     ORDER BY processed_at DESC NULLS LAST
     LIMIT 1`,
    [callId, template.id]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE call_analysis_results SET
         template_version = $1,
         scores = $2,
         flags = $3,
         flags_detail = $4,
         global_score = $5,
         verbatims = $6,
         resume = $7,
         coaching_tip = $8,
         model = $9,
         prompt_hash = $10,
         retries = $11,
         raw_response = $12,
         processed_at = NOW()
       WHERE id = $13`,
      [
        template.version,
        JSON.stringify(payload.scores),
        JSON.stringify(payload.flags),
        JSON.stringify(payload.flagsDetail),
        payload.globalScore,
        JSON.stringify(payload.verbatims),
        payload.resume,
        payload.coachingTip,
        payload.model,
        payload.promptHash,
        payload.retries,
        payload.rawResponse,
        existing.rows[0].id,
      ]
    );
    return;
  }

  await query(
    `INSERT INTO call_analysis_results
       (call_id, template_id, template_version, scores, global_score, verbatims, flags, flags_detail, resume, coaching_tip, model, prompt_hash, retries, raw_response, processed_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW())`,
    [
      callId,
      template.id,
      template.version,
      JSON.stringify(payload.scores),
      payload.globalScore,
      JSON.stringify(payload.verbatims),
      JSON.stringify(payload.flags),
      JSON.stringify(payload.flagsDetail),
      payload.resume,
      payload.coachingTip,
      payload.model,
      payload.promptHash,
      payload.retries,
      payload.rawResponse,
    ]
  );
}

async function storeFailedAttempt(callId: string, templateId: string, retries: number, rawResponse: string) {
  const existing = await query(
    `SELECT id
     FROM call_analysis_results
     WHERE call_id = $1 AND template_id = $2
     ORDER BY processed_at DESC NULLS LAST
     LIMIT 1`,
    [callId, templateId]
  );

  if (existing.rows.length > 0) {
    await query(
      `UPDATE call_analysis_results
       SET retries = $1, raw_response = $2
       WHERE id = $3`,
      [retries, rawResponse, existing.rows[0].id]
    );
  }
}

async function createAlertIfNeeded(
  result: { flagsDetail: QAFlagDetail[] },
  callId: string,
  agentId: string | null,
  companyId: string
): Promise<void> {
  const criticalFlags = result.flagsDetail.filter((flag) =>
    (CRITICAL_FLAGS as readonly string[]).includes(flag.type)
  );

  for (const flag of criticalFlags) {
    await query(
      `INSERT INTO qa_alerts (company_id, call_id, flag_type, agent_id, extrait)
       VALUES ($1, $2, $3, $4, $5)`,
      [companyId, callId, flag.type, agentId, flag.extrait]
    );
  }
}

export async function analyzeCall(
  callId: string,
  templateId: string,
  companyId: string,
  maxRetries = 3
): Promise<QAAnalysisResult> {
  const [call, template] = await Promise.all([
    fetchCall(callId, companyId),
    fetchTemplate(companyId, templateId),
  ]);

  const prompt = buildPrompt(call.transcript, call.intent, template, call.conversationMode);
  const promptHash = createHash('sha256').update(prompt).digest('hex');
  const allowedFlags = getAllowedFlags(template);
  const resultSchema = createQAResultSchema(allowedFlags);
  const model = 'mistral-large-latest';

  let lastRaw = '';

  logger.info('QA analysis started', { callId, templateId, companyId, promptHash, maxRetries });

  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const raw = await generateResponse(
      [{ role: 'user', content: prompt }],
      undefined,
      { model, maxCompletionTokens: 2500, temperature: 0.1 }
    );

    lastRaw = raw;
    const parsed = safeJSON(stripCodeFences(raw));
    const validated = resultSchema.safeParse(parsed);

    if (!validated.success) {
      logger.warn('QA analysis validation failed', {
        callId,
        templateId,
        attempt,
        errors: validated.error.flatten(),
      });
      continue;
    }

    const data = validated.data;
    const flagsDetail: QAFlagDetail[] = data.flags_detail.map((flag) => ({
      type: flag.type,
      extrait: flag.extrait,
      position_ms: flag.position_ms,
    }));
    const globalScore = computeScore(data.scores, template.criteria);
    const verbatims = extractVerbatims(data.scores);
    const flags = extractFlagTypes(flagsDetail);

    await upsertAnalysisResult(callId, template, {
      scores: data.scores,
      flags,
      flagsDetail,
      globalScore,
      verbatims,
      resume: data.resume,
      coachingTip: data.coaching_tip,
      model,
      promptHash,
      retries: attempt,
      rawResponse: raw,
    });

    await createAlertIfNeeded({ flagsDetail }, callId, call.agentId, companyId);

    logger.info('QA analysis saved', { callId, templateId, globalScore, retries: attempt });

    return {
      scores: data.scores,
      flagsDetail,
      flags,
      verbatims,
      conversationMode: call.conversationMode,
      resume: data.resume,
      coachingTip: data.coaching_tip,
      globalScore,
      model,
      promptHash,
      retries: attempt,
      rawResponse: raw,
    };
  }

  await storeFailedAttempt(callId, templateId, maxRetries, lastRaw);
  throw new AppError(`QA analysis failed for call ${callId}`, 422);
}

export async function createNewTemplateVersion(
  existingTemplate: AnalysisTemplate,
  patch: {
    name?: string;
    callType?: string;
    promptTemplate?: string;
    systemPrompt?: string;
    flagDefinitions?: AnalysisFlagDefinition[];
    outputSchema?: Record<string, unknown> | null;
  }
): Promise<AnalysisTemplate> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    await client.query(
      `UPDATE analysis_templates SET is_active = false WHERE id = $1`,
      [existingTemplate.id]
    );

    const newResult = await client.query(
      `INSERT INTO analysis_templates
         (company_id, name, call_type, prompt_template, system_prompt, flag_definitions, output_schema, version, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
       RETURNING *`,
      [
        existingTemplate.companyId,
        patch.name ?? existingTemplate.name,
        patch.callType ?? existingTemplate.callType,
        patch.promptTemplate ?? existingTemplate.promptTemplate,
        patch.systemPrompt ?? existingTemplate.systemPrompt,
        JSON.stringify(patch.flagDefinitions ?? existingTemplate.flagDefinitions),
        patch.outputSchema !== undefined ? JSON.stringify(patch.outputSchema) : existingTemplate.outputSchema,
        existingTemplate.version + 1,
      ]
    );

    const newTemplate = newResult.rows[0] as Record<string, unknown>;

    await client.query(
      `UPDATE analysis_templates SET superseded_by = $1 WHERE id = $2`,
      [newTemplate.id, existingTemplate.id]
    );

    await client.query(
      `INSERT INTO analysis_criteria
         (template_id, label, description, weight, type, required, position)
       SELECT $1, label, description, weight, type, required, position
       FROM analysis_criteria WHERE template_id = $2`,
      [newTemplate.id, existingTemplate.id]
    );

    await client.query('COMMIT');

    return {
      id: newTemplate.id as string,
      companyId: newTemplate.company_id as string,
      name: newTemplate.name as string,
      callType: newTemplate.call_type as string,
      promptTemplate: (newTemplate.prompt_template as string) || '',
      systemPrompt: (newTemplate.system_prompt as string) || '',
      flagDefinitions: normalizeFlagDefinitions(newTemplate.flag_definitions),
      outputSchema: (newTemplate.output_schema as Record<string, unknown> | null) ?? null,
      version: Number(newTemplate.version || 1),
      isActive: Boolean(newTemplate.is_active),
      supersededBy: (newTemplate.superseded_by as string | null) ?? null,
      createdAt: newTemplate.created_at as Date,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
