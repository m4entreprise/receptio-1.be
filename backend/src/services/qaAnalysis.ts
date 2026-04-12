import { query, getClient } from '../config/database';
import { generateResponse } from './mistral';
import logger from '../utils/logger';

export interface AnalysisTemplate {
  id: string;
  companyId: string;
  name: string;
  callType: string;
  promptTemplate: string;
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

export interface QAAnalysisResult {
  scores: Record<string, boolean | number | string>;
  globalScore: number;
  verbatims: Record<string, string>;
  flags: string[];
}

// ── Utilitaires ──────────────────────────────────────────────────────────────

function extractJson(raw: string): string {
  // Nettoie le markdown ```json ... ``` éventuel
  const mdMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (mdMatch) return mdMatch[1].trim();
  // Extrait le premier objet JSON trouvé
  const objMatch = raw.match(/\{[\s\S]*\}/);
  if (objMatch) return objMatch[0];
  return raw.trim();
}

function computeGlobalScore(
  scores: Record<string, boolean | number | string>,
  criteria: AnalysisCriteria[]
): number {
  const scoreable = criteria.filter((c) => c.type !== 'text');
  const totalWeight = scoreable.reduce((s, c) => s + c.weight, 0);
  if (totalWeight === 0) return 0;

  let weightedSum = 0;
  for (const c of scoreable) {
    const score = scores[c.id];
    let normalized = 0;
    if (c.type === 'boolean') {
      normalized = score === true || score === 'true' ? 1 : 0;
    } else if (c.type === 'score_0_5') {
      normalized = typeof score === 'number' ? Math.min(5, Math.max(0, score)) / 5 : 0;
    }
    weightedSum += normalized * c.weight;
  }
  return Math.round((weightedSum / totalWeight) * 100);
}

function buildPrompt(
  template: AnalysisTemplate,
  criteria: AnalysisCriteria[],
  transcript: string,
  intent: string
): string {
  const criteriaSection = criteria
    .sort((a, b) => a.position - b.position)
    .map(
      (c) =>
        `- ID:${c.id} | "${c.label}" (poids:${c.weight}%) | type:${c.type}` +
        (c.description ? ` | ${c.description}` : '')
    )
    .join('\n');

  return template.promptTemplate
    .replace(/\{\{TRANSCRIPTION\}\}/g, transcript)
    .replace(/\{\{CRITERES\}\}/g, criteriaSection)
    .replace(/\{\{INTENT\}\}/g, intent);
}

// ── Analyse d'un appel ───────────────────────────────────────────────────────

export async function analyzeCall(
  callId: string,
  templateId: string,
  companyId: string
): Promise<QAAnalysisResult> {
  // 1. Charger le template et ses critères
  const templateResult = await query(
    `SELECT id, company_id, name, call_type, prompt_template, output_schema,
            version, is_active, superseded_by, created_at
     FROM analysis_templates
     WHERE id = $1 AND company_id = $2`,
    [templateId, companyId]
  );

  if (templateResult.rows.length === 0) {
    throw new Error('Template not found or access denied');
  }

  const tRow = templateResult.rows[0];
  const template: AnalysisTemplate = {
    id: tRow.id,
    companyId: tRow.company_id,
    name: tRow.name,
    callType: tRow.call_type,
    promptTemplate: tRow.prompt_template,
    outputSchema: tRow.output_schema,
    version: tRow.version,
    isActive: tRow.is_active,
    supersededBy: tRow.superseded_by,
    createdAt: tRow.created_at,
  };

  const criteriaResult = await query(
    `SELECT id, template_id, label, description, weight, type, required, position
     FROM analysis_criteria
     WHERE template_id = $1
     ORDER BY position ASC`,
    [templateId]
  );

  const criteria: AnalysisCriteria[] = criteriaResult.rows.map((r: Record<string, unknown>) => ({
    id: r.id,
    templateId: r.template_id,
    label: r.label,
    description: r.description,
    weight: r.weight,
    type: r.type as 'boolean' | 'score_0_5' | 'text',
    required: r.required,
    position: r.position,
  }));

  // 2. Charger la transcription et le résumé de l'appel
  const callResult = await query(
    `SELECT t.text AS transcript, t.segments,
            cs.summary, cs.intent,
            c.duration, c.status, c.direction
     FROM calls c
     LEFT JOIN transcriptions t ON t.call_id = c.id
     LEFT JOIN call_summaries cs ON cs.call_id = c.id
     WHERE c.id = $1 AND c.company_id = $2`,
    [callId, companyId]
  );

  if (callResult.rows.length === 0) {
    throw new Error('Call not found or access denied');
  }

  const callData = callResult.rows[0];
  const transcript = callData.transcript || 'Aucune transcription disponible.';
  const intent = callData.intent || 'inconnu';

  // 3. Construire le prompt
  const filledPrompt = buildPrompt(template, criteria, transcript, intent);

  const systemPrompt = `Tu es un expert QA en centres d'appels. Tu évalues des appels téléphoniques selon des critères précis.
Réponds UNIQUEMENT avec un JSON valide, sans markdown ni texte autour. Format attendu :
{
  "scores": { "<criteria_id>": <true|false|0-5|"texte"> },
  "globalScore": <0-100>,
  "verbatims": { "<criteria_id>": "<extrait du transcript justifiant l'évaluation>" },
  "flags": ["<flag1>", "<flag2>"]
}
Les flags possibles : manquement_script, question_oubliee, promesse_non_tenue, client_irrite, transfert_rate, prospect_chaud, appel_exemplaire.`;

  // 4. Appel Mistral
  logger.info('QA analysis started', { callId, templateId });

  const rawResponse = await generateResponse(
    [{ role: 'user', content: filledPrompt }],
    systemPrompt,
    { model: 'mistral-small-latest', maxCompletionTokens: 1500, temperature: 0.1 }
  );

  // 5. Parser la réponse
  let parsed: Partial<QAAnalysisResult>;
  try {
    parsed = JSON.parse(extractJson(rawResponse));
  } catch (err) {
    logger.error('QA response parse error', { callId, rawResponse: rawResponse.slice(0, 200) });
    parsed = { scores: {}, verbatims: {}, flags: [] };
  }

  const scores = parsed.scores || {};
  const verbatims = parsed.verbatims || {};
  const flags = Array.isArray(parsed.flags) ? parsed.flags : [];

  // 6. Calculer le score global (indépendamment de ce que Mistral a fourni)
  const globalScore = computeGlobalScore(scores, criteria);

  const result: QAAnalysisResult = { scores, globalScore, verbatims, flags };

  // 7. Sauvegarder en base
  await query(
    `INSERT INTO call_analysis_results
       (call_id, template_id, template_version, scores, global_score, verbatims, flags)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      callId,
      templateId,
      template.version,
      JSON.stringify(scores),
      globalScore,
      JSON.stringify(verbatims),
      JSON.stringify(flags),
    ]
  );

  logger.info('QA analysis saved', { callId, templateId, globalScore });

  return result;
}

// ── Versioning ───────────────────────────────────────────────────────────────

export async function createNewTemplateVersion(
  existingTemplate: AnalysisTemplate,
  patch: {
    name?: string;
    callType?: string;
    promptTemplate?: string;
    outputSchema?: Record<string, unknown> | null;
  }
): Promise<AnalysisTemplate> {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Désactiver l'ancien
    await client.query(
      `UPDATE analysis_templates SET is_active = false WHERE id = $1`,
      [existingTemplate.id]
    );

    // Créer le nouveau (version + 1)
    const newResult = await client.query(
      `INSERT INTO analysis_templates
         (company_id, name, call_type, prompt_template, output_schema, version, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [
        existingTemplate.companyId,
        patch.name ?? existingTemplate.name,
        patch.callType ?? existingTemplate.callType,
        patch.promptTemplate ?? existingTemplate.promptTemplate,
        patch.outputSchema !== undefined ? JSON.stringify(patch.outputSchema) : existingTemplate.outputSchema,
        existingTemplate.version + 1,
      ]
    );

    const newTemplate = newResult.rows[0];

    // Pointer l'ancien vers le nouveau
    await client.query(
      `UPDATE analysis_templates SET superseded_by = $1 WHERE id = $2`,
      [newTemplate.id, existingTemplate.id]
    );

    // Copier les critères vers la nouvelle version
    await client.query(
      `INSERT INTO analysis_criteria
         (template_id, label, description, weight, type, required, position)
       SELECT $1, label, description, weight, type, required, position
       FROM analysis_criteria WHERE template_id = $2`,
      [newTemplate.id, existingTemplate.id]
    );

    await client.query('COMMIT');

    return {
      id: newTemplate.id,
      companyId: newTemplate.company_id,
      name: newTemplate.name,
      callType: newTemplate.call_type,
      promptTemplate: newTemplate.prompt_template,
      outputSchema: newTemplate.output_schema,
      version: newTemplate.version,
      isActive: newTemplate.is_active,
      supersededBy: newTemplate.superseded_by,
      createdAt: newTemplate.created_at,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
