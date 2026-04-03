import { query } from '../config/database';
import { KnowledgeBaseEntry, OfferBSettings } from '../types';
import logger from '../utils/logger';

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
};

export async function getCompanyOfferBSettings(companyId: string): Promise<Required<OfferBSettings>> {
  const result = await query('SELECT settings FROM companies WHERE id = $1', [companyId]);
  const settings = (result.rows[0]?.settings || {}) as OfferBSettings;

  return {
    ...defaultOfferBSettings,
    ...settings,
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

export function shouldUseOfferBAgent(settings: OfferBSettings): boolean {
  return settings.offerMode === 'B' && Boolean(settings.agentEnabled);
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
