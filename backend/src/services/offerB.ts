import { query } from '../config/database';
import { BbisAgentSettings, KnowledgeBaseEntry, OfferBSettings } from '../types';
import logger from '../utils/logger';

export type ActiveOfferMode = 'A' | 'B' | 'Bbis';

export interface TelephonyProvider {
  provider: string;
  transferCall(targetNumber: string): Promise<void>;
}

export interface RealtimeLLMProvider {
  provider: string;
  generateReply(input: string, context: string): Promise<string>;
}

export interface KnowledgeProvider {
  getRelevantEntries(companyId: string, search?: string): Promise<KnowledgeBaseEntry[]>;
}

export interface EscalationDecision {
  shouldTransfer: boolean;
  reason?: string;
}

export interface EscalationPolicy {
  evaluate(params: {
    requestedByCaller: boolean;
    consecutiveFailures: number;
    maxAgentFailures: number;
  }): EscalationDecision;
}

const defaultOfferBSettings: Required<OfferBSettings> = {
  offerMode: 'A',
  agentEnabled: false,
  humanTransferNumber: '',
  fallbackToVoicemail: true,
  maxAgentFailures: 2,
  greetingText: '',
  knowledgeBaseEnabled: false,
  appointmentIntegrationEnabled: false,
  bbisAgent: {
    systemPrompt: '',
    temperature: 0.4,
    llmModel: '',
    maxCompletionTokens: 120,
    silenceThresholdMs: 260,
    minSpeechMs: 120,
    bargeInMinSpeechMs: 80,
    sttModel: '',
    ttsModel: '',
    ttsVoice: '',
  },
};

const defaultBbisAgentSettings: Required<BbisAgentSettings> = {
  systemPrompt: '',
  temperature: 0.4,
  llmModel: '',
  maxCompletionTokens: 120,
  silenceThresholdMs: 260,
  minSpeechMs: 120,
  bargeInMinSpeechMs: 80,
  sttModel: '',
  ttsModel: '',
  ttsVoice: '',
};

export async function getCompanyOfferBSettings(companyId: string): Promise<Required<OfferBSettings>> {
  const result = await query('SELECT settings FROM companies WHERE id = $1', [companyId]);
  const settings = (result.rows[0]?.settings || {}) as OfferBSettings;

  return {
    ...defaultOfferBSettings,
    ...settings,
    bbisAgent: {
      ...defaultBbisAgentSettings,
      ...(settings.bbisAgent || {}),
    },
  };
}

export function getBbisAgentSettings(settings: OfferBSettings): Required<BbisAgentSettings> {
  return {
    ...defaultBbisAgentSettings,
    ...(settings.bbisAgent || {}),
  };
}

export async function getKnowledgeBaseEntries(companyId: string, search?: string): Promise<KnowledgeBaseEntry[]> {
  try {
    if (search?.trim()) {
      const result = await query(
        `SELECT id, company_id AS "companyId", title, category, content, priority, enabled, created_at AS "createdAt", updated_at AS "updatedAt"
         FROM knowledge_base_entries
         WHERE company_id = $1
           AND enabled = true
           AND (
             title ILIKE $2
             OR COALESCE(category, '') ILIKE $2
             OR content ILIKE $2
           )
         ORDER BY priority DESC, updated_at DESC
         LIMIT 8`,
        [companyId, `%${search.trim()}%`]
      );

      return result.rows;
    }

    const result = await query(
      `SELECT id, company_id AS "companyId", title, category, content, priority, enabled, created_at AS "createdAt", updated_at AS "updatedAt"
       FROM knowledge_base_entries
       WHERE company_id = $1 AND enabled = true
       ORDER BY priority DESC, updated_at DESC`,
      [companyId]
    );

    return result.rows;
  } catch (error: any) {
    if (error?.code === '42P01') {
      logger.warn('Knowledge base table missing, skipping Offer B company lookup', { companyId });
      return [];
    }

    throw error;
  }
}

export async function buildKnowledgeBaseContext(companyId: string, search?: string): Promise<string> {
  const entries = await getKnowledgeBaseEntries(companyId, search);

  if (entries.length === 0) {
    return '';
  }

  return entries
    .map((entry) => {
      const category = entry.category ? ` [${entry.category}]` : '';
      return `${entry.title}${category}: ${entry.content}`;
    })
    .join('\n');
}

export function getActiveOfferMode(settings: OfferBSettings): ActiveOfferMode {
  if (settings.offerMode === 'Bbis') {
    return 'Bbis';
  }

  if (settings.offerMode === 'B') {
    return 'B';
  }

  return 'A';
}

export function shouldUseOfferBAgent(settings: OfferBSettings): boolean {
  return getActiveOfferMode(settings) === 'B' && Boolean(settings.agentEnabled);
}

export function shouldUseOfferBBisAgent(settings: OfferBSettings): boolean {
  return getActiveOfferMode(settings) === 'Bbis' && Boolean(settings.agentEnabled);
}

export function shouldUseRealtimeOfferAgent(settings: OfferBSettings): boolean {
  return Boolean(settings.agentEnabled) && getActiveOfferMode(settings) !== 'A';
}

export const defaultEscalationPolicy: EscalationPolicy = {
  evaluate({ requestedByCaller, consecutiveFailures, maxAgentFailures }) {
    if (requestedByCaller) {
      return { shouldTransfer: true, reason: 'caller_requested_human' };
    }

    if (consecutiveFailures >= maxAgentFailures) {
      return { shouldTransfer: true, reason: 'agent_failure_threshold_reached' };
    }

    return { shouldTransfer: false };
  },
};
