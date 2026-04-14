import { Request } from 'express';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    companyId: string;
    role: string;
  };
}

export interface Company {
  id: string;
  name: string;
  phoneNumber?: string;
  email: string;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface BbisAgentSettings {
  systemPrompt?: string;
  temperature?: number;
  llmProvider?: 'mistral';
  llmModel?: string;
  maxCompletionTokens?: number;
  silenceThresholdMs?: number;
  minSpeechMs?: number;
  bargeInMinSpeechMs?: number;
  sttProvider?: 'mistral' | 'gladia';
  sttModel?: string;
  ttsProvider?: 'mistral';
  ttsModel?: string;
  ttsVoice?: string;
}

export interface AiModelsSettings {
  offerBLlmModel?: string;
  transcriptionSttModel?: string;
  summaryLlmModel?: string;
  intentLlmModel?: string;
  greetingTtsModel?: string;
  greetingTtsVoice?: string;
}

export interface OfferBSettings {
  voicePipelineEnabled?: boolean;
  agentEnabled?: boolean;
  humanTransferNumber?: string;
  fallbackToVoicemail?: boolean;
  maxAgentFailures?: number;
  greetingText?: string;
  knowledgeBaseEnabled?: boolean;
  appointmentIntegrationEnabled?: boolean;
  smartRoutingEnabled?: boolean;
  routingQuestion?: string;
  transferMessage?: string;
  bbisAgent?: BbisAgentSettings;
  aiModels?: AiModelsSettings;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  passwordHash: string;
  firstName?: string;
  lastName?: string;
  role: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Call {
  id: string;
  companyId: string;
  callerNumber?: string;
  callerName?: string;
  direction: 'inbound' | 'outbound';
  status: string;
  duration: number;
  recordingUrl?: string;
  recordingPath?: string;
  callSid?: string;
  createdAt: Date;
  endedAt?: Date;
  metadata: Record<string, any>;
}

export interface Transcription {
  id: string;
  callId: string;
  text: string;
  language: string;
  confidence?: number;
  createdAt: Date;
}

export interface CallSummary {
  id: string;
  callId: string;
  summary?: string;
  intent?: string;
  sentiment?: string;
  actions: any[];
  createdAt: Date;
}

export interface Conversation {
  id: string;
  callId: string;
  state: string;
  context: Record<string, any>;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
}

export interface KnowledgeBaseEntry {
  id: string;
  companyId: string;
  title: string;
  category?: string;
  content: string;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface DaySchedule {
  enabled: boolean;
  open: string;  // "HH:MM"
  close: string; // "HH:MM"
}

export interface WeeklySchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

export interface StaffGroupMember {
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  role: string;
  enabled: boolean;
}

export interface StaffGroup {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  role?: string;
  schedule: WeeklySchedule;
  enabled: boolean;
  members: StaffGroupMember[];
  createdAt: Date;
  updatedAt: Date;
}

export interface DispatchRule {
  id: string;
  companyId: string;
  name: string;
  description?: string;
  priority: number;
  enabled: boolean;
  conditionType: 'always' | 'intent';
  conditions: Record<string, any>;
  targetType: 'group' | 'agent';
  targetGroupId?: string;
  targetStaffId?: string;
  distributionStrategy: 'sequential' | 'random' | 'simultaneous';
  agentOrder: string[];
  fallbackType: 'voicemail' | 'none' | 'group' | 'agent';
  fallbackGroupId?: string;
  fallbackStaffId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BusinessRule {
  id: string;
  companyId: string;
  ruleType: string;
  name: string;
  conditions: Record<string, any>;
  actions: Record<string, any>;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}
