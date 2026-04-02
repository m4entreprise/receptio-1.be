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
