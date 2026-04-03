import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { sendTranscriptionEmail } from '../services/email';
import { detectIntent, summarizeCall, textToSpeech, transcribeAudio } from '../services/openai';
import logger from '../utils/logger';

const router = Router();

router.post('/telnyx/call', async (req: Request, res: Response, next) => {
  try {
    const event = req.body;
    logger.info('Telnyx webhook received', { eventType: event.data?.event_type });

    const eventType = event.data?.event_type;

    switch (eventType) {
      case 'call.initiated':
        await handleCallInitiated(event.data.payload);
        break;
      case 'call.answered':
        await handleCallAnswered(event.data.payload);
        break;
      case 'call.hangup':
        await handleCallHangup(event.data.payload);
        break;
      case 'call.recording.saved':
        await handleRecordingSaved(event.data.payload);
        break;
      default:
        logger.debug('Unhandled Telnyx event', { eventType });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
});

router.all('/twilio/voice', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const company = await findCompanyByPhoneNumber(payload.To);

    if (!company) {
      logger.warn('No company matched inbound Twilio number', { to: payload.To, callSid: payload.CallSid });
      res.type('text/xml').send(buildTwiml('<Pause length="1" /><Hangup />'));
      return;
    }

    const callId = await createOrUpdateTwilioCall(payload, company.id);
    const baseUrl = getBaseUrl(req);
    const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
    const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');

    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [callId, 'twilio.voice.inbound', payload]
    );

    await query(
      `UPDATE calls SET status = $1 WHERE id = $2`,
      ['answered', callId]
    );

    res.type('text/xml').send(
      buildTwiml(
        `<Play>${escapeXml(greetingUrl)}</Play><Record method="POST" playBeep="true" maxLength="120" trim="trim-silence" recordingStatusCallback="${escapeXml(recordingCompleteUrl)}" recordingStatusCallbackMethod="POST" /><Hangup />`
      )
    );
  } catch (error: any) {
    logger.error('Twilio voice webhook error', { error: error.message });
    res.type('text/xml').send(buildTwiml('<Hangup />'));
  }
});

router.get('/twilio/greeting', async (req: Request, res: Response) => {
  try {
    const companyId = String(req.query.companyId || '');
    const result = await query(
      'SELECT id, name, settings FROM companies WHERE id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      res.status(404).send('Company not found');
      return;
    }

    const company = result.rows[0];
    const greetingText = company.settings?.twilioGreetingText || `Bonjour, vous êtes bien chez ${company.name}. Merci de laisser votre message après le bip.`;
    const audio = await textToSpeech(greetingText);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (error: any) {
    logger.error('Twilio greeting generation error', { error: error.message });
    res.status(500).send('Greeting unavailable');
  }
});

router.post('/twilio/recording-complete', async (req: Request, res: Response) => {
  try {
    const payload = req.body;
    const callSid = payload.CallSid;
    const rawRecordingUrl = payload.RecordingUrl;
    const recordingDuration = Number(payload.RecordingDuration || 0);

    if (!callSid || !rawRecordingUrl) {
      res.status(200).send('ok');
      return;
    }

    const recordingUrl = String(rawRecordingUrl).endsWith('.mp3') ? String(rawRecordingUrl) : `${String(rawRecordingUrl)}.mp3`;
    const callResult = await query(
      `SELECT c.id, c.caller_number, c.created_at, c.company_id, co.email AS company_email
       FROM calls c
       LEFT JOIN companies co ON co.id = c.company_id
       WHERE c.call_sid = $1`,
      [callSid]
    );

    if (callResult.rows.length === 0) {
      logger.warn('Twilio recording received for unknown call', { callSid });
      res.status(200).send('ok');
      return;
    }

    const call = callResult.rows[0];

    await query(
      `UPDATE calls
       SET recording_url = $1, duration = $2, status = $3, ended_at = CURRENT_TIMESTAMP
       WHERE id = $4`,
      [recordingUrl, recordingDuration, 'completed', call.id]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [call.id, 'twilio.recording.completed', payload]
    );

    const transcription = await transcribeAudio(recordingUrl, 'fr');

    await query(
      `INSERT INTO transcriptions (call_id, text, language, confidence)
       VALUES ($1, $2, $3, $4)`,
      [call.id, transcription.text, transcription.language, transcription.confidence]
    );

    const [summary, intentData] = await Promise.all([
      summarizeCall(transcription.text),
      detectIntent(transcription.text),
    ]);

    await query(
      `INSERT INTO call_summaries (call_id, summary, intent, actions)
       VALUES ($1, $2, $3, $4)`,
      [call.id, summary, intentData.intent, JSON.stringify([])]
    );

    if (call.company_email) {
      try {
        await sendTranscriptionEmail(call.company_email, {
          callerNumber: call.caller_number || 'Inconnu',
          transcription: transcription.text,
          duration: recordingDuration,
          createdAt: call.created_at,
        });
      } catch (error: any) {
        logger.error('Twilio transcription email error', { error: error.message, callId: call.id });
      }
    }

    res.status(200).send('ok');
  } catch (error: any) {
    logger.error('Twilio recording webhook error', { error: error.message });
    res.status(200).send('ok');
  }
});

function buildTwiml(body: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

function normalizePhoneNumber(value: string | null | undefined): string {
  return String(value || '').replace(/\D/g, '');
}

function getBaseUrl(req: Request): string {
  return (process.env.PUBLIC_WEBHOOK_URL || `${req.protocol}://${req.get('host')}`).replace(/\/+$/, '');
}

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function findCompanyByPhoneNumber(phoneNumber: string) {
  const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
  const result = await query(
    'SELECT id, name, email, phone_number, settings FROM companies WHERE phone_number IS NOT NULL'
  );

  return result.rows.find((company: any) => normalizePhoneNumber(company.phone_number) === normalizedPhoneNumber) || null;
}

async function createOrUpdateTwilioCall(payload: any, companyId: string): Promise<string> {
  const existingCall = await query(
    'SELECT id FROM calls WHERE call_sid = $1',
    [payload.CallSid]
  );

  if (existingCall.rows.length > 0) {
    return existingCall.rows[0].id;
  }

  const result = await query(
    `INSERT INTO calls (company_id, call_sid, caller_number, direction, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      companyId,
      payload.CallSid,
      payload.From || null,
      'inbound',
      payload.CallStatus || 'initiated',
      { to: payload.To || null, provider: 'twilio' },
    ]
  );

  return result.rows[0].id;
}

async function handleCallInitiated(payload: any) {
  const { call_control_id, call_session_id, from, to } = payload;

  const result = await query(
    `INSERT INTO calls (call_sid, caller_number, direction, status, metadata)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [call_control_id, from, 'inbound', 'initiated', { call_session_id, to, provider: 'telnyx' }]
  );

  await query(
    `INSERT INTO call_events (call_id, event_type, data)
     VALUES ($1, $2, $3)`,
    [result.rows[0].id, 'call.initiated', payload]
  );

  logger.info('Call initiated', { callId: result.rows[0].id, from });
}

async function handleCallAnswered(payload: any) {
  const { call_control_id } = payload;

  await query(
    `UPDATE calls SET status = $1 WHERE call_sid = $2`,
    ['answered', call_control_id]
  );

  const callResult = await query(
    'SELECT id FROM calls WHERE call_sid = $1',
    [call_control_id]
  );

  if (callResult.rows.length > 0) {
    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [callResult.rows[0].id, 'call.answered', payload]
    );
  }

  logger.info('Call answered', { callSid: call_control_id });
}

async function handleCallHangup(payload: any) {
  const { call_control_id, hangup_cause, call_duration_secs } = payload;

  await query(
    `UPDATE calls SET status = $1, duration = $2, ended_at = CURRENT_TIMESTAMP
     WHERE call_sid = $3`,
    ['completed', call_duration_secs || 0, call_control_id]
  );

  const callResult = await query(
    'SELECT id FROM calls WHERE call_sid = $1',
    [call_control_id]
  );

  if (callResult.rows.length > 0) {
    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [callResult.rows[0].id, 'call.hangup', { hangup_cause, duration: call_duration_secs }]
    );
  }

  logger.info('Call hangup', { callSid: call_control_id, duration: call_duration_secs });
}

async function handleRecordingSaved(payload: any) {
  const { call_control_id, recording_urls } = payload;
  const recordingUrl = recording_urls?.mp3 || recording_urls?.wav;

  await query(
    `UPDATE calls SET recording_url = $1 WHERE call_sid = $2`,
    [recordingUrl, call_control_id]
  );

  const callResult = await query(
    `SELECT c.id, c.caller_number, c.created_at, c.company_id, co.email AS company_email
     FROM calls c
     LEFT JOIN companies co ON co.id = c.company_id
     WHERE c.call_sid = $1`,
    [call_control_id]
  );

  if (callResult.rows.length > 0) {
    const call = callResult.rows[0];

    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [call.id, 'recording.saved', { recording_url: recordingUrl }]
    );

    if (recordingUrl) {
      try {
        const transcription = await transcribeAudio(recordingUrl, 'fr');
        const [summary, intentData] = await Promise.all([
          summarizeCall(transcription.text),
          detectIntent(transcription.text),
        ]);

        await query(
          `INSERT INTO transcriptions (call_id, text, language, confidence)
           VALUES ($1, $2, $3, $4)`,
          [call.id, transcription.text, transcription.language, transcription.confidence]
        );

        await query(
          `INSERT INTO call_summaries (call_id, summary, intent, actions)
           VALUES ($1, $2, $3, $4)`,
          [call.id, summary, intentData.intent, JSON.stringify([])]
        );

        if (call.company_email) {
          try {
            await sendTranscriptionEmail(call.company_email, {
              callerNumber: call.caller_number || 'Inconnu',
              transcription: transcription.text,
              duration: 0,
              createdAt: call.created_at,
            });
          } catch (error: any) {
            logger.error('Telnyx transcription email error', { error: error.message, callId: call.id });
          }
        }
      } catch (error: any) {
        logger.error('Telnyx recording processing error', { error: error.message, callId: call.id });
      }
    }
  }

  logger.info('Recording saved', { callSid: call_control_id, recordingUrl });
}

export default router;
