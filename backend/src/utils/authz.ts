import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';

export const AGENT_PERMISSION_KEYS = [
  'callsRead',
  'callDetailRead',
  'callRecordingsRead',
  'callTransfer',
  'callDelete',
  'outboundRead',
  'outboundCreate',
  'outboundManage',
  'outboundAllRead',
  'analyticsRead',
  'staffManage',
  'knowledgeBaseManage',
  'settingsManage',
  'intentsManage',
  'qaManage',
  'auditLogsRead',
  'memberManage',
] as const;

export type AgentPermissionKey = typeof AGENT_PERMISSION_KEYS[number];

export interface AgentAccessPolicy {
  callsRead: boolean;
  callDetailRead: boolean;
  callRecordingsRead: boolean;
  callTransfer: boolean;
  callDelete: boolean;
  outboundRead: boolean;
  outboundCreate: boolean;
  outboundManage: boolean;
  outboundAllRead: boolean;
  analyticsRead: boolean;
  staffManage: boolean;
  knowledgeBaseManage: boolean;
  settingsManage: boolean;
  intentsManage: boolean;
  qaManage: boolean;
  auditLogsRead: boolean;
  memberManage: boolean;
  outboundScope: 'own' | 'all';
}

export const defaultAgentAccessPolicy: AgentAccessPolicy = {
  callsRead: true,
  callDetailRead: true,
  callRecordingsRead: true,
  callTransfer: false,
  callDelete: false,
  outboundRead: true,
  outboundCreate: true,
  outboundManage: false,
  outboundAllRead: false,
  analyticsRead: false,
  staffManage: false,
  knowledgeBaseManage: false,
  settingsManage: false,
  intentsManage: false,
  qaManage: false,
  auditLogsRead: false,
  memberManage: false,
  outboundScope: 'own',
};

export function normalizeAgentAccessPolicy(raw: unknown): AgentAccessPolicy {
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    ...defaultAgentAccessPolicy,
    ...Object.fromEntries(
      AGENT_PERMISSION_KEYS.map((key) => [key, Boolean(source[key])])
    ),
    outboundScope: source.outboundScope === 'all' ? 'all' : 'own',
  };
}

export function isTenantAdminRole(role: string | null | undefined): boolean {
  return role === 'owner' || role === 'admin';
}

export function hasPermission(req: AuthRequest, permission: AgentPermissionKey): boolean {
  const user = req.user;
  if (!user) return false;
  if (isTenantAdminRole(user.role)) return true;
  return Boolean(user.permissions?.[permission]);
}

export function requirePermission(req: AuthRequest, permission: AgentPermissionKey, message = 'Forbidden') {
  if (!hasPermission(req, permission)) {
    throw new AppError(message, 403);
  }
}

export function canAccessOutboundForStaff(req: AuthRequest, initiatedByStaffId: string | null | undefined): boolean {
  const user = req.user;
  if (!user) return false;
  if (isTenantAdminRole(user.role)) return true;
  if (!user.permissions?.outboundRead) return false;
  if (user.permissions.outboundAllRead || user.permissions.outboundScope === 'all') return true;
  return Boolean(user.staffId && initiatedByStaffId && user.staffId === initiatedByStaffId);
}

export function requireLinkedStaff(req: AuthRequest) {
  if (!req.user?.staffId) {
    throw new AppError('Votre compte agent doit être lié à un membre du staff pour cette action', 403);
  }
}
