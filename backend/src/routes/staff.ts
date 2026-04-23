import { Router, Request, Response } from 'express';
import { z } from 'zod';
import axios from 'axios';
import { getTelnyxApiKey } from '../services/telnyxClient';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { isTenantAdminRole, requirePermission } from '../utils/authz';
import { writeAuditLogFromRequest } from '../utils/audit';
import logger from '../utils/logger';

const router = Router();

const staffSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phoneNumber: z.string().min(5),
  role: z.string().optional(),
  voicemailMessage: z.string().optional(),
});

const getBaseUrl = (req: Request): string => {
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  return `${proto}://${host}`;
};

// GET /api/staff - list all staff for the tenant
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId, staffId } = req.user!;
    const canManage = isTenantAdminRole(req.user!.role) || req.user!.permissions.staffManage;
    const result = await query(
      `SELECT id, first_name, last_name, phone_number, role, voicemail_message, enabled, created_at
       FROM staff
       WHERE company_id = $1${canManage ? '' : ' AND id = $2'}
       ORDER BY first_name, last_name`,
      canManage ? [companyId] : [companyId, staffId || null]
    );
    res.json({ staff: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/staff - create a staff member
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;

    const data = staffSchema.parse(req.body);

    const result = await query(
      `INSERT INTO staff (company_id, first_name, last_name, phone_number, role, voicemail_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, data.firstName, data.lastName, data.phoneNumber, data.role || 'secrétaire', data.voicemailMessage || null]
    );

    await writeAuditLogFromRequest(req, {
      action: 'staff.created',
      entityType: 'staff',
      entityId: result.rows[0].id,
      targetLabel: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
      after: result.rows[0],
    });
    logger.info('Staff created', { companyId, staffId: result.rows[0].id });
    res.status(201).json({ staff: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/staff/:id - update a staff member
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;

    const { id } = req.params;
    const data = staffSchema.partial().parse(req.body);
    const beforeResult = await query('SELECT * FROM staff WHERE id = $1 AND company_id = $2', [id, companyId]);
    if (beforeResult.rows.length === 0) throw new AppError('Staff member not found', 404);

    const fields: string[] = [];
    const params: any[] = [];

    if (data.firstName !== undefined) { fields.push(`first_name = $${params.length + 1}`); params.push(data.firstName); }
    if (data.lastName !== undefined) { fields.push(`last_name = $${params.length + 1}`); params.push(data.lastName); }
    if (data.phoneNumber !== undefined) { fields.push(`phone_number = $${params.length + 1}`); params.push(data.phoneNumber); }
    if (data.role !== undefined) { fields.push(`role = $${params.length + 1}`); params.push(data.role); }
    if (data.voicemailMessage !== undefined) { fields.push(`voicemail_message = $${params.length + 1}`); params.push(data.voicemailMessage); }
    if (req.body.enabled !== undefined) { fields.push(`enabled = $${params.length + 1}`); params.push(req.body.enabled); }

    if (fields.length === 0) throw new AppError('No fields to update', 400);

    params.push(id, companyId);
    const result = await query(
      `UPDATE staff SET ${fields.join(', ')} WHERE id = $${params.length - 1} AND company_id = $${params.length} RETURNING *`,
      params
    );

    if (result.rows.length === 0) throw new AppError('Staff member not found', 404);
    await writeAuditLogFromRequest(req, {
      action: 'staff.updated',
      entityType: 'staff',
      entityId: id,
      targetLabel: `${result.rows[0].first_name} ${result.rows[0].last_name}`,
      before: beforeResult.rows[0],
      after: result.rows[0],
    });
    res.json({ staff: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'staffManage');
    const { companyId } = req.user!;

    const { id } = req.params;
    const beforeResult = await query('SELECT * FROM staff WHERE id = $1 AND company_id = $2', [id, companyId]);
    const result = await query(
      'DELETE FROM staff WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );
    if (result.rows.length === 0) throw new AppError('Staff member not found', 404);
    await writeAuditLogFromRequest(req, {
      action: 'staff.deleted',
      entityType: 'staff',
      entityId: id,
      targetLabel: beforeResult.rows[0] ? `${beforeResult.rows[0].first_name} ${beforeResult.rows[0].last_name}` : id,
      before: beforeResult.rows[0] || null,
    });
    res.json({ message: 'Staff member deleted' });
  } catch (error) {
    next(error);
  }
});

// POST /api/staff/:staffId/call/:callId
// Initiates an outbound Twilio call to the original caller, then transfers to the staff member.
// If no answer → voicemail message.
router.post('/:staffId/call/:callId', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId } = req.user!;
    const { staffId, callId } = req.params;

    const staffResult = await query(
      'SELECT * FROM staff WHERE id = $1 AND company_id = $2 AND enabled = true',
      [staffId, companyId]
    );
    if (staffResult.rows.length === 0) throw new AppError('Staff member not found', 404);
    const staffMember = staffResult.rows[0];

    const callResult = await query(
      'SELECT caller_number FROM calls WHERE id = $1 AND company_id = $2',
      [callId, companyId]
    );
    if (callResult.rows.length === 0) throw new AppError('Call not found', 404);
    const callerNumber = callResult.rows[0].caller_number;
    if (!callerNumber) throw new AppError('No caller number on this call', 400);

    const companyResult = await query(
      'SELECT name, phone_number FROM companies WHERE id = $1',
      [companyId]
    );
    if (companyResult.rows.length === 0) throw new AppError('Company not found', 404);
    const company = companyResult.rows[0];
    const fromNumber = company.phone_number;
    if (!fromNumber) throw new AppError('Company has no phone number configured', 400);

    const telnyxApiKey = getTelnyxApiKey();
    const telnyxAppId = process.env.TELNYX_APP_ID;
    if (!telnyxAppId) throw new AppError('TELNYX_APP_ID not configured', 500);

    const baseUrl = getBaseUrl(req);
    const transferUrl = `${baseUrl}/api/webhooks/telnyx/transfer?staffPhone=${encodeURIComponent(staffMember.phone_number)}`;
    const voicemailMessage = staffMember.voicemail_message ||
      `Bonjour, ${staffMember.first_name} ${staffMember.last_name} de ${company.name} a essayé de vous joindre. N'hésitez pas à nous recontacter.`;
    const statusCallbackUrl = `${baseUrl}/api/webhooks/telnyx/call-status?callId=${callId}&staffId=${staffId}&voicemailMessage=${encodeURIComponent(voicemailMessage)}`;

    const callsUrl = `https://api.telnyx.com/v2/texml/calls/${telnyxAppId}`;
    const params = new URLSearchParams({
      To: callerNumber,
      From: fromNumber,
      Url: transferUrl,
      StatusCallback: statusCallbackUrl,
      StatusCallbackMethod: 'POST',
    });
    const telnyxRes = await axios.post(callsUrl, params.toString(), {
      headers: {
        Authorization: `Bearer ${telnyxApiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    const callSid = telnyxRes.data.sid || telnyxRes.data.call_control_id || telnyxRes.data.CallSid;

    logger.info('Outbound call initiated', { callSid, to: callerNumber, staffId, callId });

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [callId, 'click_to_call.initiated', { outboundCallSid: callSid, staffId, staffName: `${staffMember.first_name} ${staffMember.last_name}` }]
    );

    res.json({ message: 'Call initiated', callSid });
  } catch (error) {
    next(error);
  }
});

export default router;
