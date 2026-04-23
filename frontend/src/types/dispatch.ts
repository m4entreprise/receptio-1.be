// =========================================================
// Dispatch V2 — Types partagés Frontend
// =========================================================

export type ConditionOperator = 'AND' | 'OR' | 'ALWAYS';

export type DistributionStrategy =
  | 'sequential'
  | 'simultaneous'
  | 'random'
  | 'round_robin';

// ─── Conditions ───────────────────────────────────────────────────────────────

export interface AlwaysCondition {
  id: string; type: 'always';
}
export interface ScheduleCondition {
  id: string; type: 'schedule';
  days: string[];
  time_start: string;
  time_end: string;
}
export interface HolidayCondition {
  id: string; type: 'holiday';
  country: 'BE' | 'FR' | 'LU' | 'NL' | 'DE' | 'CH';
  match: 'on_holiday' | 'not_on_holiday';
}
export interface LanguageCondition {
  id: string; type: 'language';
  languages: string[];
}
export interface CallerNumberCondition {
  id: string; type: 'caller_number';
  mode: 'equals' | 'starts_with' | 'contains';
  patterns: string[];
}
export interface IntentCondition {
  id: string; type: 'intent';
  intents: string[];
  match_mode: 'any' | 'all';
}
export interface AgentAvailabilityCondition {
  id: string; type: 'agent_availability';
  group_id: string;
  check: 'any_available' | 'all_unavailable';
}

export type Condition =
  | AlwaysCondition | ScheduleCondition | HolidayCondition
  | LanguageCondition | CallerNumberCondition | IntentCondition
  | AgentAvailabilityCondition;

export type ConditionType = Condition['type'];

// ─── Actions ──────────────────────────────────────────────────────────────────

export interface RetryConfig {
  max_attempts: number;
  ring_duration: number;
  between_attempts_delay: number;
}
export interface RouteGroupAction {
  type: 'route_group';
  group_id: string;
  distribution_strategy: DistributionStrategy;
  agent_order?: string[];
  retry: RetryConfig;
}
export interface RouteAgentAction {
  type: 'route_agent';
  agent_id: string;
  ring_duration: number;
}
export interface RouteExternalAction {
  type: 'route_external';
  phone_number: string;
  label?: string;
}
export interface PlayMessageAction {
  type: 'play_message';
  message_text: string;
}
export interface VoicemailAction {
  type: 'voicemail';
  greeting_text?: string;
}

export type LeafAction =
  | RouteGroupAction | RouteAgentAction | RouteExternalAction
  | PlayMessageAction | VoicemailAction;

export interface ConditionalBranch {
  id: string;
  label: string;
  condition: Condition;
  action: LeafAction;
}

export interface RouteConditionalAction {
  type: 'route_conditional';
  branches: ConditionalBranch[];
  default_action: LeafAction;
}

export type Action = LeafAction | RouteConditionalAction;

export type ActionType = Action['type'];

// ─── Chaîne de fallback ───────────────────────────────────────────────────────

export interface FallbackStep {
  id: string;
  label: string;
  action: Action;
  delay?: number;
}

// ─── Règle complète ───────────────────────────────────────────────────────────

export interface DispatchRule {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  priority: number;
  enabled: boolean;
  condition_operator: ConditionOperator;
  conditions: Condition[];
  action: Action;
  fallback_chain: FallbackStep[];
  node_positions: Record<string, { x: number; y: number }>;
  round_robin_index: number;
  created_at: string;
  updated_at: string;
}

// ─── Types de référence pour les formulaires ──────────────────────────────────

export const DAYS_FR: Record<string, string> = {
  monday: 'Lundi', tuesday: 'Mardi', wednesday: 'Mercredi',
  thursday: 'Jeudi', friday: 'Vendredi', saturday: 'Samedi', sunday: 'Dimanche',
};

export const DAYS_SHORT: Record<string, string> = {
  monday: 'L', tuesday: 'M', wednesday: 'Me',
  thursday: 'J', friday: 'V', saturday: 'S', sunday: 'D',
};

export const CONDITION_LABELS: Record<ConditionType, string> = {
  always:             'Toujours',
  schedule:           'Horaire',
  holiday:            'Jour férié',
  language:           'Langue',
  caller_number:      'Numéro appelant',
  intent:             'Intention IA',
  agent_availability: 'Disponibilité équipe',
};

export const ACTION_LABELS: Record<ActionType, string> = {
  route_group:       'Groupe d\'agents',
  route_agent:       'Agent spécifique',
  route_external:    'Numéro externe',
  play_message:      'Message vocal',
  voicemail:         'Messagerie vocale',
  route_conditional: 'Dispatch conditionnel',
};

export const STRATEGY_LABELS: Record<DistributionStrategy, { label: string; desc: string }> = {
  sequential:   { label: 'Séquentiel',  desc: 'Dans l\'ordre défini' },
  simultaneous: { label: 'Simultané',   desc: 'Tous en même temps' },
  random:       { label: 'Aléatoire',   desc: 'Au hasard' },
  round_robin:  { label: 'Round Robin', desc: 'Rotation équitable' },
};

export const COUNTRY_LABELS: Record<string, string> = {
  BE: 'Belgique', FR: 'France', LU: 'Luxembourg',
  NL: 'Pays-Bas', DE: 'Allemagne', CH: 'Suisse',
};

// ─── Valeurs par défaut pour les formulaires ──────────────────────────────────

export const DEFAULT_RETRY: RetryConfig = {
  max_attempts: 3,
  ring_duration: 25,
  between_attempts_delay: 3,
};

export const DEFAULT_ACTION: RouteGroupAction = {
  type: 'route_group',
  group_id: '',
  distribution_strategy: 'sequential',
  agent_order: [],
  retry: { ...DEFAULT_RETRY },
};

export const DEFAULT_VOICEMAIL: VoicemailAction = {
  type: 'voicemail',
  greeting_text: 'Veuillez laisser votre message après le bip. Nous vous rappellerons dès que possible.',
};

export function newConditionId(): string {
  return `cond-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function newFallbackId(): string {
  return `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}
