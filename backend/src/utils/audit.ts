import { query } from '../config/database';
import { AuthRequest } from '../types';

interface AuditLogInput {
  companyId?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  targetLabel?: string | null;
  before?: unknown;
  after?: unknown;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export async function writeAuditLog(input: AuditLogInput) {
  await query(
    `INSERT INTO audit_logs (
      company_id, actor_user_id, actor_email, actor_role,
      action, entity_type, entity_id, target_label,
      before_json, after_json, metadata, ip_address, user_agent
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [
      input.companyId || null,
      input.actorUserId || null,
      input.actorEmail || null,
      input.actorRole || null,
      input.action,
      input.entityType,
      input.entityId || null,
      input.targetLabel || null,
      input.before ?? null,
      input.after ?? null,
      input.metadata || {},
      input.ipAddress || null,
      input.userAgent || null,
    ]
  );
}

export async function writeAuditLogFromRequest(
  req: AuthRequest,
  input: Omit<AuditLogInput, 'companyId' | 'actorUserId' | 'actorEmail' | 'actorRole' | 'ipAddress' | 'userAgent'>
) {
  await writeAuditLog({
    companyId: req.user?.companyId,
    actorUserId: req.user?.id,
    actorEmail: req.user?.email,
    actorRole: req.user?.role,
    ipAddress: req.ip,
    userAgent: req.get('user-agent') || null,
    ...input,
  });
}
