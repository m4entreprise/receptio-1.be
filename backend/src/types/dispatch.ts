// =========================================================
// Dispatch V2 — Modèle de données
// =========================================================

// ─── Opérateur de conditions ───────────────────────────────────────────────
export type ConditionOperator = 'AND' | 'OR' | 'ALWAYS';

// ─── Stratégies de distribution ───────────────────────────────────────────
export type DistributionStrategy =
  | 'sequential'    // Dans l'ordre défini
  | 'simultaneous'  // Tous en même temps (ring group)
  | 'random'        // Agent aléatoire
  | 'round_robin';  // Rotation équitable

// ─── Types de conditions ───────────────────────────────────────────────────

export interface AlwaysCondition {
  id: string;
  type: 'always';
}

/** Plage horaire + jours de la semaine */
export interface ScheduleCondition {
  id: string;
  type: 'schedule';
  days: ('monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday')[];
  time_start: string; // "HH:MM"
  time_end: string;   // "HH:MM"
}

/** Jours fériés nationaux */
export interface HolidayCondition {
  id: string;
  type: 'holiday';
  country: 'BE' | 'FR' | 'LU' | 'NL' | 'DE' | 'CH';
  match: 'on_holiday' | 'not_on_holiday';
}

/** Langue détectée de l'appelant */
export interface LanguageCondition {
  id: string;
  type: 'language';
  languages: string[]; // codes ISO 639-1 : 'fr', 'nl', 'en'...
}

/** Numéro de l'appelant */
export interface CallerNumberCondition {
  id: string;
  type: 'caller_number';
  mode: 'equals' | 'starts_with' | 'contains';
  patterns: string[];
}

/** Intention détectée par l'IA dans la parole */
export interface IntentCondition {
  id: string;
  type: 'intent';
  intents: string[];
  match_mode: 'any' | 'all';
}

/** Disponibilité d'un groupe d'agents */
export interface AgentAvailabilityCondition {
  id: string;
  type: 'agent_availability';
  group_id: string;
  check: 'any_available' | 'all_unavailable';
}

export type Condition =
  | AlwaysCondition
  | ScheduleCondition
  | HolidayCondition
  | LanguageCondition
  | CallerNumberCondition
  | IntentCondition
  | AgentAvailabilityCondition;

// ─── Configuration des tentatives de sonnerie ──────────────────────────────
export interface RetryConfig {
  max_attempts: number;           // 0 = infini
  ring_duration: number;          // secondes par tentative
  between_attempts_delay: number; // secondes entre tentatives
}

// ─── Types d'actions ───────────────────────────────────────────────────────

/** Transfert vers un groupe d'agents */
export interface RouteGroupAction {
  type: 'route_group';
  group_id: string;
  distribution_strategy: DistributionStrategy;
  agent_order?: string[]; // UUIDs ordonnés (pour sequential)
  retry: RetryConfig;
}

/** Transfert vers un agent spécifique */
export interface RouteAgentAction {
  type: 'route_agent';
  agent_id: string;
  ring_duration: number;
}

/** Transfert vers un numéro externe */
export interface RouteExternalAction {
  type: 'route_external';
  phone_number: string;
  label?: string;
}

/** Lecture d'un message vocal puis raccroché */
export interface PlayMessageAction {
  type: 'play_message';
  message_text: string;
}

/** Messagerie vocale */
export interface VoicemailAction {
  type: 'voicemail';
  greeting_text?: string;
}

export type Action =
  | RouteGroupAction
  | RouteAgentAction
  | RouteExternalAction
  | PlayMessageAction
  | VoicemailAction;

// ─── Étape de la chaîne de fallback ───────────────────────────────────────
export interface FallbackStep {
  id: string;
  label: string; // Libellé lisible ("Responsable", "Messagerie vocale"...)
  action: Action;
  delay?: number; // Secondes d'attente avant cette étape (optionnel)
}

// ─── Règle de dispatch complète ───────────────────────────────────────────
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

// ─── Contexte d'appel (pour l'évaluation des conditions) ──────────────────
export interface CallContext {
  companyId: string;
  callerNumber?: string;
  calledNumber?: string;
  language?: string;
  speechText?: string;
  timezone: string;
  now: Date;
}

// ─── Résultat du dispatch ──────────────────────────────────────────────────
export interface DispatchTarget {
  numbers: string[];
  strategy: 'sequential' | 'random' | 'simultaneous';
  ruleId: string;
  ruleName: string;
  fallbackType: 'voicemail' | 'none' | 'external' | 'message';
  fallbackNumber?: string;
  fallbackMessage?: string;
}
