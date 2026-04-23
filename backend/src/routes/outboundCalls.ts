import { Router, Request, Response } from 'express';
import { getTwilioClient, getTwilioApiBase } from '../services/twilioClient';
import axios from 'axios';
import { query } from '../config/database';
import { authenticateToken } from '../middleware/auth';
import { AuthRequest } from '../types';
import { AppError } from '../middleware/errorHandler';
import { canAccessOutboundForStaff, requireLinkedStaff, requirePermission } from '../utils/authz';
import logger from '../utils/logger';

const router = Router();

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(id: string, label = 'id') {
  if (!uuidPattern.test(id)) throw new AppError(`Invalid ${label}`, 400);
}

function getBaseUrl(req: Request): string {
  // PUBLIC_WEBHOOK_URL wins if set (handles cases where nginx doesn't forward X-Forwarded-Proto)
  if (process.env.PUBLIC_WEBHOOK_URL) return process.env.PUBLIC_WEBHOOK_URL;
  const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost:3000';
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
  return `${proto}://${host}`;
}

// ---------------------------------------------------------------------------
// POST /api/outbound-calls
// Initiates a new outbound call: Receptio dials the destination number, then
// bridges it to the chosen staff member once answered.
// ---------------------------------------------------------------------------
router.post('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'outboundCreate');
    const { companyId, role, staffId: actorStaffId, permissions } = req.user!;
    const { destinationNumber, staffId } = req.body as { destinationNumber?: string; staffId?: string };

    if (!destinationNumber || !staffId) {
      throw new AppError('destinationNumber and staffId are required', 400);
    }
    assertUuid(staffId, 'staffId');
    if (role === 'agent' && permissions.outboundScope !== 'all') {
      requireLinkedStaff(req);
      if (staffId !== actorStaffId) {
        throw new AppError('Un agent ne peut initier que ses propres appels sortants', 403);
      }
    }

    const [staffResult, companyResult] = await Promise.all([
      query('SELECT * FROM staff WHERE id = $1 AND company_id = $2 AND enabled = true', [staffId, companyId]),
      query('SELECT id, name, phone_number, settings, email FROM companies WHERE id = $1', [companyId]),
    ]);

    if (staffResult.rows.length === 0) throw new AppError('Staff member not found or disabled', 404);
    if (companyResult.rows.length === 0) throw new AppError('Company not found', 404);

    const staff = staffResult.rows[0];
    const company = companyResult.rows[0];

    if (!company.phone_number) throw new AppError('Company has no Twilio phone number configured', 400);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) throw new AppError('Twilio credentials not configured', 500);
    const apiKeySid = (process.env.TWILIO_API_KEY_SID || '').trim() || undefined;
    const apiKeySecret = (process.env.TWILIO_API_KEY_SECRET || '').trim() || undefined;
    const region = (process.env.TWILIO_REGION || '').trim() || undefined;
    const useApiKey = !!(region && apiKeySid && apiKeySecret);

    const callRecord = await query(
      `INSERT INTO calls (company_id, caller_number, destination_number, direction, status, initiated_by_staff_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        companyId,
        company.phone_number,
        destinationNumber,
        'outbound',
        'initiated',
        staffId,
        JSON.stringify({ staffName: `${staff.first_name} ${staff.last_name}`, provider: 'twilio' }),
      ]
    );

    const callId = callRecord.rows[0].id as string;
    const baseUrl = getBaseUrl(req);

    // Agent-first flow: Receptio calls the agent first, then dials the client
    // once the agent has picked up — the client never waits.
    const answerUrl = `${baseUrl}/api/webhooks/twilio/outbound-answer?callId=${encodeURIComponent(callId)}&destNumber=${encodeURIComponent(destinationNumber)}&companyId=${encodeURIComponent(companyId)}`;
    const statusCallbackUrl = `${baseUrl}/api/webhooks/twilio/outbound-status?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}`;

    const callsUrl = `${getTwilioApiBase()}/2010-04-01/Accounts/${accountSid}/Calls.json`;

    logger.info('Outbound call: creating Twilio call via REST', {
      from: company.phone_number,
      to: staff.phone_number,
      callsUrl,
      answerUrl,
    });

    let twilioSid: string;
    try {
      const params = new URLSearchParams({
        To: staff.phone_number,
        From: company.phone_number,
        Url: answerUrl,
        StatusCallback: statusCallbackUrl,
        StatusCallbackMethod: 'POST',
        'StatusCallbackEvent[0]': 'initiated',
        'StatusCallbackEvent[1]': 'ringing',
        'StatusCallbackEvent[2]': 'answered',
        'StatusCallbackEvent[3]': 'completed',
        'StatusCallbackEvent[4]': 'no-answer',
        'StatusCallbackEvent[5]': 'busy',
        'StatusCallbackEvent[6]': 'failed',
      });
      const twilioRes = await axios.post(callsUrl, params.toString(), {
        auth: useApiKey
          ? { username: apiKeySid!, password: apiKeySecret! }
          : { username: accountSid, password: authToken },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      });
      twilioSid = twilioRes.data.sid;
    } catch (twilioErr: any) {
      const status = twilioErr.response?.status;
      const twilioCode = twilioErr.response?.data?.code;
      const twilioMsg = twilioErr.response?.data?.message || twilioErr.message;
      logger.error('Twilio call creation failed', { callsUrl, status, twilioCode, twilioMsg, data: twilioErr.response?.data });
      if (status === 401 || twilioCode === 20003) {
        throw new AppError(
          `Authentification Twilio refusée (${callsUrl}) — vérifiez TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN et TWILIO_REGION`,
          500
        );
      }
      if (twilioCode === 21211 || twilioCode === 21214) {
        throw new AppError(`Numéro de destination invalide : ${destinationNumber}`, 400);
      }
      if (twilioCode === 21606) {
        throw new AppError(`Le numéro émetteur ${company.phone_number} n'est pas autorisé pour les appels sortants`, 400);
      }
      throw new AppError(`Erreur Twilio (${twilioCode ?? status ?? 'inconnu'}) : ${twilioMsg}`, 500);
    }

    await query(
      `UPDATE calls SET call_sid = $1, outbound_call_sid = $1 WHERE id = $2`,
      [twilioSid, callId]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [callId, 'outbound.initiated', { twilioCallSid: twilioSid, staffId, destinationNumber }]
    );

    logger.info('Outbound call initiated', { callId, twilioSid, destinationNumber, staffId });

    res.status(201).json({ callId, callSid: twilioSid, status: 'initiated' });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/outbound-calls (list for this tenant)
// ---------------------------------------------------------------------------
router.get('/', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'outboundRead');
    const { companyId, role, staffId, permissions } = req.user!;
    const { limit = 50, offset = 0 } = req.query;

    const scopedToOwn = role === 'agent' && !permissions.outboundAllRead && permissions.outboundScope !== 'all';
    if (scopedToOwn) {
      requireLinkedStaff(req);
    }

    const result = await query(
      `SELECT c.*, cs.summary AS ai_summary, cs.intent,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name,
              t.text AS transcription_text, t.segments AS transcription_segments
       FROM calls c
       LEFT JOIN call_summaries cs ON cs.call_id = c.id
       LEFT JOIN staff s ON s.id = c.initiated_by_staff_id
       LEFT JOIN transcriptions t ON t.call_id = c.id
       WHERE c.company_id = $1 AND c.direction = 'outbound'${scopedToOwn ? ' AND c.initiated_by_staff_id = $4' : ''}
       ORDER BY c.created_at DESC
       LIMIT $2 OFFSET $3`,
      scopedToOwn ? [companyId, limit, offset, staffId] : [companyId, limit, offset]
    );

    res.json({ calls: result.rows });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// GET /api/outbound-calls/:id — detail + live transcript/summary polling
// ---------------------------------------------------------------------------
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'outboundRead');
    const { companyId } = req.user!;
    const { id } = req.params;
    assertUuid(id);

    const result = await query(
      `SELECT c.*, cs.summary AS ai_summary, cs.intent, cs.actions,
              s.first_name AS staff_first_name, s.last_name AS staff_last_name,
              t.text AS transcription_text, t.segments AS transcription_segments
       FROM calls c
       LEFT JOIN call_summaries cs ON cs.call_id = c.id
       LEFT JOIN staff s ON s.id = c.initiated_by_staff_id
       LEFT JOIN transcriptions t ON t.call_id = c.id
       WHERE c.id = $1 AND c.company_id = $2 AND c.direction = 'outbound'`,
      [id, companyId]
    );

    if (result.rows.length === 0) throw new AppError('Outbound call not found', 404);
    if (!canAccessOutboundForStaff(req, result.rows[0].initiated_by_staff_id || null)) {
      throw new AppError('Accès refusé à cet appel sortant', 403);
    }

    const eventsResult = await query(
      'SELECT * FROM call_events WHERE call_id = $1 ORDER BY timestamp ASC',
      [id]
    );

    res.json({ call: result.rows[0], events: eventsResult.rows });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/outbound-calls/:id/transfer
// Transfers an active outbound call to a different staff member.
// ---------------------------------------------------------------------------
router.post('/:id/transfer', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'outboundManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    assertUuid(id);

    const { staffId } = req.body as { staffId?: string };
    if (!staffId) throw new AppError('staffId is required', 400);
    assertUuid(staffId, 'staffId');

    const [callResult, staffResult] = await Promise.all([
      query(
        `SELECT c.call_sid, c.status, c.initiated_by_staff_id FROM calls WHERE id = $1 AND company_id = $2 AND direction = 'outbound'`,
        [id, companyId]
      ),
      query('SELECT * FROM staff WHERE id = $1 AND company_id = $2 AND enabled = true', [staffId, companyId]),
    ]);

    if (callResult.rows.length === 0) throw new AppError('Outbound call not found', 404);
    if (staffResult.rows.length === 0) throw new AppError('Staff member not found', 404);
    if (!canAccessOutboundForStaff(req, callResult.rows[0].initiated_by_staff_id || null)) {
      throw new AppError('Accès refusé à cet appel sortant', 403);
    }

    const { call_sid: callSid, status } = callResult.rows[0];
    const staff = staffResult.rows[0];

    if (!callSid) throw new AppError('No active call SID found', 400);
    if (!['answered', 'in-progress'].includes(status)) throw new AppError('Call is not active', 400);

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!accountSid || !authToken) throw new AppError('Twilio credentials not configured', 500);

    const client = getTwilioClient();
    await client.calls(callSid).update({
      twiml: `<Response><Say language="fr-FR">Nous vous transférons vers un autre collaborateur. Veuillez patienter.</Say><Dial><Number>${staff.phone_number}</Number></Dial></Response>`,
    });

    await query(
      `UPDATE calls SET initiated_by_staff_id = $1, metadata = metadata || $2 WHERE id = $3`,
      [staffId, JSON.stringify({ transferredToStaff: `${staff.first_name} ${staff.last_name}` }), id]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [id, 'outbound.transferred', { toStaffId: staffId, staffName: `${staff.first_name} ${staff.last_name}`, staffPhone: staff.phone_number }]
    );

    logger.info('Outbound call transferred', { callId: id, toStaffId: staffId });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// ---------------------------------------------------------------------------
// POST /api/outbound-calls/:id/hangup — force-terminate
// ---------------------------------------------------------------------------
router.post('/:id/hangup', authenticateToken, async (req: AuthRequest, res: Response, next) => {
  try {
    requirePermission(req, 'outboundManage');
    const { companyId } = req.user!;
    const { id } = req.params;
    assertUuid(id);

    const callResult = await query(
      `SELECT call_sid, initiated_by_staff_id FROM calls WHERE id = $1 AND company_id = $2 AND direction = 'outbound'`,
      [id, companyId]
    );

    if (callResult.rows.length === 0) throw new AppError('Outbound call not found', 404);
    if (!canAccessOutboundForStaff(req, callResult.rows[0].initiated_by_staff_id || null)) {
      throw new AppError('Accès refusé à cet appel sortant', 403);
    }
    const { call_sid: callSid } = callResult.rows[0];

    if (callSid) {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      if (accountSid && authToken) {
        try {
          const client = getTwilioClient();
          await client.calls(callSid).update({ status: 'completed' });
        } catch (e: any) {
          logger.warn('Twilio hangup error (may already be completed)', { callId: id, error: e.message });
        }
      }
    }

    await query(
      `UPDATE calls SET status = 'completed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $1`,
      [id]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [id, 'outbound.hangup_by_agent', { companyId }]
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
