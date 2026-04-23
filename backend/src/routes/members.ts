import { Router, Response } from 'express';
import crypto from 'crypto';
import { z } from 'zod';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { AuthRequest } from '../types';
import { defaultAgentAccessPolicy, normalizeAgentAccessPolicy, requirePermission } from '../utils/authz';
import { writeAuditLogFromRequest } from '../utils/audit';

const router = Router();

const inviteStaffDataSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().optional(),
  role: z.string().optional(),
});

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'agent']),
  staffId: z.string().uuid().nullable().optional(),
  staffData: inviteStaffDataSchema.optional(),
}).refine(data => !(data.staffId && data.staffData), {
  message: 'staffId et staffData sont mutuellement exclusifs',
});

const updateMemberSchema = z.object({
  role: z.enum(['owner', 'admin', 'agent']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  staffId: z.string().uuid().nullable().optional(),
  deactivationReason: z.string().max(1000).optional(),
});

const accessPolicySchema = z.object({
  agent: z.object({
    callsRead: z.boolean(),
    callDetailRead: z.boolean(),
    callRecordingsRead: z.boolean(),
    callTransfer: z.boolean(),
    callDelete: z.boolean(),
    outboundRead: z.boolean(),
    outboundCreate: z.boolean(),
    outboundManage: z.boolean(),
    outboundAllRead: z.boolean(),
    analyticsRead: z.boolean(),
    staffManage: z.boolean(),
    knowledgeBaseManage: z.boolean(),
    settingsManage: z.boolean(),
    intentsManage: z.boolean(),
    qaManage: z.boolean(),
    auditLogsRead: z.boolean(),
    memberManage: z.boolean(),
    outboundScope: z.enum(['own', 'all']),
  }),
});

router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'memberManage');
    const { companyId } = req.user!;

    const [usersResult, invitationsResult, unlinkedStaffResult] = await Promise.all([
      query(
        `SELECT u.id, u.email, u.role, u.status, u.staff_id, u.first_name, u.last_name, u.invited_at,
                u.activated_at, u.disabled_at, u.last_login_at, u.created_at,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name,
                s.phone_number AS staff_phone, s.role AS staff_role, s.enabled AS staff_enabled
         FROM users u
         LEFT JOIN staff s ON s.id = u.staff_id
         WHERE u.company_id = $1
         ORDER BY CASE u.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, u.created_at ASC`,
        [companyId]
      ),
      query(
        `SELECT i.id, i.email, i.role, i.staff_id, i.status, i.expires_at, i.created_at, i.revoked_at,
                s.first_name AS staff_first_name, s.last_name AS staff_last_name,
                u.email AS invited_by_email
         FROM user_invitations i
         LEFT JOIN staff s ON s.id = i.staff_id
         LEFT JOIN users u ON u.id = i.invited_by_user_id
         WHERE i.company_id = $1 AND i.status = 'pending'
         ORDER BY i.created_at DESC`,
        [companyId]
      ),
      query(
        `SELECT id, first_name, last_name, phone_number, role, enabled, created_at
         FROM staff
         WHERE company_id = $1
           AND id NOT IN (
             SELECT staff_id FROM users WHERE company_id = $1 AND staff_id IS NOT NULL
           )
         ORDER BY first_name, last_name`,
        [companyId]
      ),
    ]);

    res.json({
      members: usersResult.rows,
      pendingInvitations: invitationsResult.rows,
      unlinkedStaff: unlinkedStaffResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/access-policy', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'memberManage');
    const { companyId } = req.user!;
    const result = await query('SELECT settings FROM companies WHERE id = $1', [companyId]);
    const settings = result.rows[0]?.settings || {};
    res.json({ agent: normalizeAgentAccessPolicy(settings?.memberAccessPolicy?.agent) });
  } catch (error) {
    next(error);
  }
});

router.put('/access-policy', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'memberManage');
    const { companyId } = req.user!;
    const data = accessPolicySchema.parse(req.body);
    const normalized = normalizeAgentAccessPolicy(data.agent);

    const currentResult = await query('SELECT settings FROM companies WHERE id = $1', [companyId]);
    if (currentResult.rows.length === 0) throw new AppError('Company not found', 404);
    const currentSettings = currentResult.rows[0].settings || {};
    const updatedSettings = {
      ...currentSettings,
      memberAccessPolicy: {
        ...(currentSettings.memberAccessPolicy || {}),
        agent: normalized,
      },
    };

    await query('UPDATE companies SET settings = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [updatedSettings, companyId]);
    await writeAuditLogFromRequest(req, {
      action: 'member_access_policy.updated',
      entityType: 'company_settings',
      targetLabel: 'Politique d\'accès agent',
      before: currentSettings.memberAccessPolicy?.agent || defaultAgentAccessPolicy,
      after: normalized,
      metadata: { section: 'memberAccessPolicy' },
    });

    res.json({ agent: normalized });
  } catch (error) {
    next(error);
  }
});

router.get('/audit-logs', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'auditLogsRead');
    const { companyId } = req.user!;
    const limit = Math.min(Number(req.query.limit || 100), 200);
    const result = await query(
      `SELECT id, actor_email, actor_role, action, entity_type, entity_id, target_label,
              before_json, after_json, metadata, created_at
       FROM audit_logs
       WHERE company_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [companyId, limit]
    );
    res.json({ logs: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/invite', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'memberManage');
    const actor = req.user!;
    const data = inviteSchema.parse(req.body);
    const normalizedEmail = data.email.trim().toLowerCase();

    if (data.role === 'admin' && actor.role !== 'owner') {
      throw new AppError('Seul le propriétaire peut inviter un administrateur', 403);
    }

    const existingUser = await query('SELECT id FROM users WHERE lower(email) = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) throw new AppError('Un utilisateur existe déjà avec cet email', 400);

    const pendingInvitation = await query(
      `SELECT id FROM user_invitations WHERE company_id = $1 AND lower(email) = $2 AND status = 'pending'`,
      [actor.companyId, normalizedEmail]
    );
    if (pendingInvitation.rows.length > 0) throw new AppError('Une invitation en attente existe déjà', 400);

    let resolvedStaffId: string | null = data.staffId || null;

    if (data.staffId) {
      const staffResult = await query(
        'SELECT id FROM staff WHERE id = $1 AND company_id = $2',
        [data.staffId, actor.companyId]
      );
      if (staffResult.rows.length === 0) throw new AppError('Membre du staff introuvable', 404);

      const alreadyLinked = await query(
        'SELECT id FROM users WHERE staff_id = $1 AND company_id = $2',
        [data.staffId, actor.companyId]
      );
      if (alreadyLinked.rows.length > 0) throw new AppError('Ce membre du staff est déjà assigné à un utilisateur', 400);
    }

    if (data.staffData) {
      const createdStaff = await query(
        `INSERT INTO staff (company_id, first_name, last_name, phone_number, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          actor.companyId,
          data.staffData.firstName,
          data.staffData.lastName,
          data.staffData.phoneNumber || null,
          data.staffData.role || 'secrétaire',
        ]
      );
      resolvedStaffId = createdStaff.rows[0].id;
    }

    const token = crypto.randomBytes(24).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const invitationResult = await query(
      `INSERT INTO user_invitations (company_id, email, role, staff_id, token_hash, invited_by_user_id, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, email, role, staff_id, status, expires_at, created_at`,
      [actor.companyId, normalizedEmail, data.role, resolvedStaffId, tokenHash, actor.id, expiresAt.toISOString()]
    );

    const publicUrl = (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, '');
    const inviteUrl = process.env.NODE_ENV === 'production'
      ? `${publicUrl}/#/accept-invitation?token=${encodeURIComponent(token)}`
      : `${publicUrl}/?inviteToken=${encodeURIComponent(token)}`;

    await writeAuditLogFromRequest(req, {
      action: 'member.invited',
      entityType: 'user_invitation',
      entityId: invitationResult.rows[0].id,
      targetLabel: normalizedEmail,
      after: invitationResult.rows[0],
      metadata: { inviteUrl, role: data.role, staffId: data.staffId || null },
    });

    res.status(201).json({ invitation: invitationResult.rows[0], inviteUrl, token });
  } catch (error) {
    next(error);
  }
});

router.post('/invitations/:id/revoke', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'memberManage');
    const { companyId } = req.user!;
    const { id } = req.params;

    const invitationResult = await query(
      `UPDATE user_invitations
       SET status = 'revoked', revoked_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND company_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, companyId]
    );
    if (invitationResult.rows.length === 0) throw new AppError('Invitation introuvable', 404);

    await writeAuditLogFromRequest(req, {
      action: 'member.invitation_revoked',
      entityType: 'user_invitation',
      entityId: invitationResult.rows[0].id,
      targetLabel: invitationResult.rows[0].email,
      before: invitationResult.rows[0],
      after: { ...invitationResult.rows[0], status: 'revoked' },
    });

    res.json({ invitation: invitationResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'memberManage');
    const actor = req.user!;
    const { id } = req.params;
    const data = updateMemberSchema.parse(req.body);

    const memberResult = await query(
      `SELECT id, email, role, status, staff_id, company_id
       FROM users
       WHERE id = $1 AND company_id = $2`,
      [id, actor.companyId]
    );
    if (memberResult.rows.length === 0) throw new AppError('Membre introuvable', 404);
    const member = memberResult.rows[0];

    if (data.role === 'owner') {
      if (actor.role !== 'owner') throw new AppError('Seul le propriétaire peut transférer la propriété', 403);
      if (member.id === actor.id) throw new AppError('Vous êtes déjà propriétaire', 400);

      await query('UPDATE users SET role = $1 WHERE id = $2 AND company_id = $3', ['admin', actor.id, actor.companyId]);
      await query('UPDATE users SET role = $1 WHERE id = $2 AND company_id = $3', ['owner', member.id, actor.companyId]);

      await writeAuditLogFromRequest(req, {
        action: 'member.ownership_transferred',
        entityType: 'user',
        entityId: member.id,
        targetLabel: member.email,
        before: { previousOwnerId: actor.id, previousOwnerEmail: actor.email, targetRole: member.role },
        after: { newOwnerId: member.id, newOwnerEmail: member.email },
      });

      res.json({ success: true });
      return;
    }

    if (data.role === 'admin' && actor.role !== 'owner') {
      throw new AppError('Seul le propriétaire peut promouvoir un administrateur', 403);
    }

    if (member.role === 'owner' && actor.id !== member.id) {
      throw new AppError('Le propriétaire doit être transféré, pas modifié ici', 400);
    }

    if (data.staffId) {
      const staffResult = await query('SELECT id FROM staff WHERE id = $1 AND company_id = $2', [data.staffId, actor.companyId]);
      if (staffResult.rows.length === 0) throw new AppError('Membre du staff introuvable', 404);

      const conflict = await query(
        'SELECT id FROM users WHERE staff_id = $1 AND company_id = $2 AND id != $3',
        [data.staffId, actor.companyId, id]
      );
      if (conflict.rows.length > 0) throw new AppError('Ce profil d\'agent est déjà assigné à un autre membre', 400);
    }

    const fields: string[] = [];
    const values: unknown[] = [];
    let idx = 1;

    if (data.role !== undefined) {
      fields.push(`role = $${idx++}`);
      values.push(data.role);
    }
    if (data.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(data.status);
      fields.push(`disabled_at = ${data.status === 'disabled' ? 'CURRENT_TIMESTAMP' : 'NULL'}`);
      fields.push(`deactivation_reason = $${idx++}`);
      values.push(data.status === 'disabled' ? data.deactivationReason || null : null);
      fields.push(`disabled_by_user_id = $${idx++}`);
      values.push(data.status === 'disabled' ? actor.id : null);
    }
    if (data.staffId !== undefined) {
      fields.push(`staff_id = $${idx++}`);
      values.push(data.staffId);
    }

    if (fields.length === 0) throw new AppError('Aucune modification fournie', 400);

    values.push(id, actor.companyId);
    const updatedResult = await query(
      `UPDATE users SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE id = $${idx++} AND company_id = $${idx++}
       RETURNING id, email, role, status, staff_id`,
      values
    );

    await writeAuditLogFromRequest(req, {
      action: 'member.updated',
      entityType: 'user',
      entityId: id,
      targetLabel: member.email,
      before: member,
      after: updatedResult.rows[0],
    });

    res.json({ member: updatedResult.rows[0] });
  } catch (error) {
    next(error);
  }
});

export default router;
