import { Router, Response } from 'express';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

const bbisAgentSettingsSchema = z.object({
  systemPrompt: z.string().max(10000).optional(),
  temperature: z.number().min(0).max(2).optional(),
  llmProvider: z.enum(['openai', 'mistral']).optional(),
  llmModel: z.string().max(200).optional(),
  maxCompletionTokens: z.number().int().min(20).max(500).optional(),
  silenceThresholdMs: z.number().int().min(60).max(1500).optional(),
  minSpeechMs: z.number().int().min(40).max(1500).optional(),
  bargeInMinSpeechMs: z.number().int().min(40).max(1000).optional(),
  sttProvider: z.enum(['deepgram', 'mistral']).optional(),
  sttModel: z.string().max(200).optional(),
  ttsProvider: z.enum(['deepgram', 'mistral']).optional(),
  ttsModel: z.string().max(200).optional(),
  ttsVoice: z.string().max(200).optional(),
});

const offerBSettingsSchema = z.object({
  voicePipelineEnabled: z.boolean().optional(),
  agentEnabled: z.boolean().optional(),
  humanTransferNumber: z.string().optional(),
  fallbackToVoicemail: z.boolean().optional(),
  maxAgentFailures: z.number().int().min(1).max(10).optional(),
  greetingText: z.string().optional(),
  knowledgeBaseEnabled: z.boolean().optional(),
  appointmentIntegrationEnabled: z.boolean().optional(),
  transferMessage: z.string().max(500).optional(),
  bbisAgent: bbisAgentSettingsSchema.optional(),
});

const updateCompanySchema = z.object({
  name: z.string().min(2).optional(),
  phoneNumber: z.string().optional(),
  settings: offerBSettingsSchema.partial().passthrough().optional(),
});

router.get('/me', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;

    const result = await query(
      'SELECT id, name, phone_number, email, settings, created_at FROM companies WHERE id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      throw new AppError('Company not found', 404);
    }

    res.json({ company: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const data = updateCompanySchema.parse(req.body);
    const currentCompanyResult = await query(
      'SELECT settings FROM companies WHERE id = $1',
      [companyId]
    );

    if (currentCompanyResult.rows.length === 0) {
      throw new AppError('Company not found', 404);
    }

    const updates: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (data.name) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }

    if (data.phoneNumber !== undefined) {
      updates.push(`phone_number = $${paramCount++}`);
      values.push(data.phoneNumber);
    }

    if (data.settings) {
      const currentSettings = currentCompanyResult.rows[0].settings || {};
      const mergedSettings = {
        ...currentSettings,
        ...data.settings,
        bbisAgent: data.settings.bbisAgent
          ? {
            ...(currentSettings.bbisAgent || {}),
            ...data.settings.bbisAgent,
          }
          : currentSettings.bbisAgent,
      };
      updates.push(`settings = $${paramCount++}`);
      values.push(mergedSettings);
    }

    if (updates.length === 0) {
      throw new AppError('No valid fields to update', 400);
    }

    values.push(companyId);

    const result = await query(
      `UPDATE companies SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $${paramCount} 
       RETURNING id, name, phone_number, email, settings`,
      values
    );

    res.json({ company: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
