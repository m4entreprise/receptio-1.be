import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import {
  analyzeCall,
  createNewTemplateVersion,
  AnalysisTemplate,
} from '../services/qaAnalysis';

const router = Router();

// ── Helpers ──────────────────────────────────────────────────────────────────

function rowToTemplate(r: Record<string, unknown>): AnalysisTemplate {
  return {
    id: r.id as string,
    companyId: r.company_id as string,
    name: r.name as string,
    callType: r.call_type as string,
    promptTemplate: r.prompt_template as string,
    outputSchema: r.output_schema as Record<string, unknown> | null,
    version: r.version as number,
    isActive: r.is_active as boolean,
    supersededBy: r.superseded_by as string | null,
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

// ── Templates ─────────────────────────────────────────────────────────────────

// GET /api/qa/templates
router.get('/templates', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
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
    res.json({ templates: result.rows.map((row: Record<string, unknown>) => ({
      ...rowToTemplate(row),
      criteriaCount: Number(row.criteria_count),
      resultsCount: Number(row.results_count),
    })) });
  } catch (error) {
    next(error);
  }
});

// POST /api/qa/templates
router.post('/templates', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { name, callType = '*', promptTemplate, outputSchema = null } = req.body;

    if (!name || typeof name !== 'string') throw new AppError('name is required', 400);
    if (!promptTemplate || typeof promptTemplate !== 'string') throw new AppError('promptTemplate is required', 400);

    const result = await query(
      `INSERT INTO analysis_templates (company_id, name, call_type, prompt_template, output_schema)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [companyId, name.trim(), callType, promptTemplate, outputSchema ? JSON.stringify(outputSchema) : null]
    );
    res.status(201).json({ template: rowToTemplate(result.rows[0]) });
  } catch (error) {
    next(error);
  }
});

// GET /api/qa/templates/:id
router.get('/templates/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const tResult = await query(
      `SELECT * FROM analysis_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (tResult.rows.length === 0) throw new AppError('Template not found', 404);

    const cResult = await query(
      `SELECT * FROM analysis_criteria WHERE template_id = $1 ORDER BY position ASC`,
      [id]
    );

    res.json({ template: { ...rowToTemplate(tResult.rows[0]), criteria: cResult.rows } });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/qa/templates/:id
router.patch('/templates/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    const { name, callType, promptTemplate, isActive, outputSchema } = req.body;

    const tResult = await query(
      `SELECT * FROM analysis_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (tResult.rows.length === 0) throw new AppError('Template not found', 404);

    const existing = rowToTemplate(tResult.rows[0]);

    // Vérifier si le promptTemplate change et s'il y a des résultats existants
    const promptChanged = promptTemplate !== undefined && promptTemplate !== existing.promptTemplate;

    if (promptChanged) {
      const usageResult = await query(
        `SELECT COUNT(*) AS cnt FROM call_analysis_results WHERE template_id = $1`,
        [id]
      );
      const hasResults = Number(usageResult.rows[0].cnt) > 0;

      if (hasResults) {
        // Créer une nouvelle version
        const newTemplate = await createNewTemplateVersion(existing, {
          name, callType, promptTemplate, outputSchema,
        });
        res.json({ template: newTemplate, versioned: true });
        return;
      }
    }

    // Mise à jour directe (aucun résultat ou prompt inchangé)
    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (name !== undefined) { fields.push(`name = $${idx++}`); values.push(name); }
    if (callType !== undefined) { fields.push(`call_type = $${idx++}`); values.push(callType); }
    if (promptTemplate !== undefined) { fields.push(`prompt_template = $${idx++}`); values.push(promptTemplate); }
    if (isActive !== undefined) { fields.push(`is_active = $${idx++}`); values.push(isActive); }
    if (outputSchema !== undefined) { fields.push(`output_schema = $${idx++}`); values.push(JSON.stringify(outputSchema)); }

    if (fields.length === 0) {
      res.json({ template: existing });
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

// DELETE /api/qa/templates/:id
router.delete('/templates/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    const tResult = await query(
      `SELECT id FROM analysis_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (tResult.rows.length === 0) throw new AppError('Template not found', 404);

    const usageResult = await query(
      `SELECT COUNT(*) AS cnt FROM call_analysis_results WHERE template_id = $1`,
      [id]
    );
    const hasResults = Number(usageResult.rows[0].cnt) > 0;

    if (hasResults) {
      // Soft-delete
      await query(`UPDATE analysis_templates SET is_active = false WHERE id = $1`, [id]);
    } else {
      await query(`DELETE FROM analysis_templates WHERE id = $1`, [id]);
    }

    res.json({ success: true, softDeleted: hasResults });
  } catch (error) {
    next(error);
  }
});

// ── Critères ──────────────────────────────────────────────────────────────────

// GET /api/qa/templates/:id/criteria
router.get('/templates/:id/criteria', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    // Vérifier ownership
    const tResult = await query(
      `SELECT id FROM analysis_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (tResult.rows.length === 0) throw new AppError('Template not found', 404);

    const result = await query(
      `SELECT * FROM analysis_criteria WHERE template_id = $1 ORDER BY position ASC`,
      [id]
    );
    res.json({ criteria: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/qa/templates/:id/criteria
router.post('/templates/:id/criteria', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;
    const { label, description = null, weight = 10, type = 'boolean', required = false, position = 0 } = req.body;

    if (!label || typeof label !== 'string') throw new AppError('label is required', 400);

    const tResult = await query(
      `SELECT id FROM analysis_templates WHERE id = $1 AND company_id = $2`,
      [id, companyId]
    );
    if (tResult.rows.length === 0) throw new AppError('Template not found', 404);

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

// PATCH /api/qa/criteria/:id
router.patch('/criteria/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { id } = req.params;

    // Vérifier ownership via JOIN
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
    const updated = await query(
      `UPDATE analysis_criteria SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    res.json({ criterion: updated.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/qa/criteria/:id
router.delete('/criteria/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
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

// ── Analyse ───────────────────────────────────────────────────────────────────

// POST /api/qa/analyze/:callId
router.post('/analyze/:callId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { callId } = req.params;
    const { templateId } = req.body;

    if (!templateId) throw new AppError('templateId is required', 400);

    const result = await analyzeCall(callId, templateId, companyId);
    res.json({ result });
  } catch (error) {
    next(error);
  }
});

// ── Résultats ─────────────────────────────────────────────────────────────────

// GET /api/qa/results
router.get('/results', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
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
       JOIN analysis_templates t ON t.id = car.template_id
       WHERE c.company_id = $1
         AND car.processed_at >= $2
         AND car.processed_at <= $3${extraWhere}`,
      params
    );

    params.push(limit, offset);
    const dataResult = await query(
      `SELECT
         car.id, car.call_id, car.template_id, car.template_version,
         car.scores, car.global_score, car.verbatims, car.flags, car.processed_at,
         c.caller_number, c.created_at AS call_created_at, c.direction,
         t.name AS template_name, t.version AS template_current_version,
         s.first_name AS agent_first_name, s.last_name AS agent_last_name
       FROM call_analysis_results car
       JOIN calls c ON c.id = car.call_id
       JOIN analysis_templates t ON t.id = car.template_id
       LEFT JOIN staff s ON s.id = c.initiated_by_staff_id
       WHERE c.company_id = $1
         AND car.processed_at >= $2
         AND car.processed_at <= $3${extraWhere}
       ORDER BY car.processed_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );

    res.json({
      results: dataResult.rows,
      total: Number(countResult.rows[0].total),
      page,
      limit,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/qa/results/:callId
router.get('/results/:callId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { callId } = req.params;

    const result = await query(
      `SELECT
         car.id, car.call_id, car.template_id, car.template_version,
         car.scores, car.global_score, car.verbatims, car.flags, car.processed_at,
         t.name AS template_name, t.version AS template_current_version
       FROM call_analysis_results car
       JOIN calls c ON c.id = car.call_id
       JOIN analysis_templates t ON t.id = car.template_id
       WHERE car.call_id = $1 AND c.company_id = $2
       ORDER BY car.processed_at DESC`,
      [callId, companyId]
    );

    res.json({ results: result.rows });
  } catch (error) {
    next(error);
  }
});

export default router;
