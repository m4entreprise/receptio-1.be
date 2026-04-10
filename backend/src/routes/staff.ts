import { Router, Request, Response } from 'express';
import { z } from 'zod';
import twilio from 'twilio';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
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
    const { companyId } = req.user!;
    const result = await query(
      `SELECT id, first_name, last_name, phone_number, role, voicemail_message, enabled, created_at
       FROM staff WHERE company_id = $1 ORDER BY first_name, last_name`,
      [companyId]
    );
    res.json({ staff: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/staff - create a staff member
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId, role } = req.user!;
    if (role !== 'admin') throw new AppError('Admin only', 403);

    const data = staffSchema.parse(req.body);

    const result = await query(
      `INSERT INTO staff (company_id, first_name, last_name, phone_number, role, voicemail_message)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [companyId, data.firstName, data.lastName, data.phoneNumber, data.role || 'secrétaire', data.voicemailMessage || null]
    );

    logger.info('Staff created', { companyId, staffId: result.rows[0].id });
    res.status(201).json({ staff: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/staff/:id - update a staff member
router.patch('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId, role } = req.user!;
    if (role !== 'admin') throw new AppError('Admin only', 403);

    const { id } = req.params;
    const data = staffSchema.partial().parse(req.body);

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
    res.json({ staff: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/staff/:id
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    const { companyId, role } = req.user!;
    if (role !== 'admin') throw new AppError('Admin only', 403);

    const { id } = req.params;
    const result = await query(
      'DELETE FROM staff WHERE id = $1 AND company_id = $2 RETURNING id',
      [id, companyId]
    );
    if (result.rows.length === 0) throw new AppError('Staff member not found', 404);
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
    if (!fromNumber) throw new AppError('Company has no Twilio phone number configured', 400);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) throw new AppError('Twilio credentials not configured', 500);

    const baseUrl = getBaseUrl(req);
    const transferUrl = `${baseUrl}/api/webhooks/twilio/transfer?staffPhone=${encodeURIComponent(staffMember.phone_number)}`;
    const voicemailMessage = staffMember.voicemail_message ||
      `Bonjour, ${staffMember.first_name} ${staffMember.last_name} de ${company.name} a essayé de vous joindre. N'hésitez pas à nous recontacter.`;
    const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/call-status?callId=${callId}&staffId=${staffId}&voicemailMessage=${encodeURIComponent(voicemailMessage)}`;

    const client = twilio(accountSid, authToken);
    const call = await client.calls.create({
      to: callerNumber,
      from: fromNumber,
      url: transferUrl,
      statusCallback: statusCallbackUrl,
      statusCallbackMethod: 'POST',
      statusCallbackEvent: ['no-answer', 'busy', 'failed'],
    });

    logger.info('Outbound call initiated', { callSid: call.sid, to: callerNumber, staffId, callId });

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [callId, 'click_to_call.initiated', { outboundCallSid: call.sid, staffId, staffName: `${staffMember.first_name} ${staffMember.last_name}` }]
    );

    res.json({ message: 'Call initiated', callSid: call.sid });
  } catch (error) {
    next(error);
  }
});

export default router;
