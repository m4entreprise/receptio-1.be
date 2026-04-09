import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { sendTranscriptionEmail } from '../services/email';
import { textToSpeech as deepgramTextToSpeech } from '../services/deepgram';
import { detectIntent, generateResponse, summarizeCall, textToSpeech, transcribeAudio } from '../services/openai';
import { buildKnowledgeBaseContext, defaultEscalationPolicy, getActiveOfferMode, getCompanyOfferBSettings, shouldUseRealtimeOfferAgent } from '../services/offerB';
import { shouldUseOfferBStreamingPipeline } from '../services/twilioMediaStreams';
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
    const offerBSettings = await getCompanyOfferBSettings(company.id);

    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [callId, 'twilio.voice.inbound', payload]
    );

    await query(
      `UPDATE calls SET status = $1 WHERE id = $2`,
      ['answered', callId]
    );

    if (shouldUseRealtimeOfferAgent(offerBSettings)) {
      await getOrCreateConversation(callId);

      await query(
        `INSERT INTO call_events (call_id, event_type, data)
         VALUES ($1, $2, $3)`,
        [callId, 'twilio.offer_b.started', { settings: offerBSettings, callSid: payload.CallSid }]
      );

      if (shouldUseOfferBStreamingPipeline(offerBSettings)) {
        const streamUrl = buildOfferBStreamingUrl(baseUrl, callId, company.id);
        res.type('text/xml').send(buildOfferBStreamingTwiml(streamUrl, callId, company.id));
        return;
      }

      res.type('text/xml').send(buildOfferBWelcomeTwiml(baseUrl, company, callId, offerBSettings));
      return;
    }

    if (offerBSettings.smartRoutingEnabled) {
      const routingQuestion = offerBSettings.routingQuestion || 'Quel est le motif de votre appel ?';
      const gatherUrl = joinUrl(baseUrl, `/api/webhooks/twilio/gather-reason?callId=${callId}&companyId=${company.id}`);
      const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}&routing=1&question=${encodeURIComponent(routingQuestion)}`);
      res.type('text/xml').send(buildOfferARoutingTwiml(greetingUrl, gatherUrl));
      return;
    }

    const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
    const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
    res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
  } catch (error: any) {
    logger.error('Twilio voice webhook error', { error: error.message });
    res.type('text/xml').send(buildTwiml('<Hangup />'));
  }
});

router.get('/twilio/greeting', async (req: Request, res: Response) => {
  try {
    const companyId = String(req.query.companyId || '');
    const isRouting = req.query.routing === '1';
    const routingQuestion = String(req.query.question || 'Quel est le motif de votre appel ?');

    const result = await query(
      'SELECT id, name, settings FROM companies WHERE id = $1',
      [companyId]
    );

    if (result.rows.length === 0) {
      res.status(404).send('Company not found');
      return;
    }

    const company = result.rows[0];
    const greetingText = company.settings?.greetingText || company.settings?.twilioGreetingText || `Bonjour, vous êtes bien chez ${company.name}. Merci de laisser votre message après le bip.`;
    const fullText = isRouting ? `${greetingText} ${routingQuestion}` : greetingText;
    const audio = await textToSpeech(fullText);

    res.setHeader('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (error: any) {
    logger.error('Twilio greeting generation error', { error: error.message });
    res.status(500).send('Greeting unavailable');
  }
});

router.all('/twilio/gather-reason', async (req: Request, res: Response) => {
  const callId = String(req.query.callId || '');
  const companyId = String(req.query.companyId || '');
  const speechResult = String(req.body.SpeechResult || req.query.SpeechResult || '').trim();
  const callSid = String(req.body.CallSid || '');

  logger.info('gather-reason received', { callId, companyId, speechResult: speechResult.slice(0, 80), callSid });

  if (callId) {
    try {
      await query(
        `UPDATE calls SET queue_status = $1, queue_reason = $2, queued_at = NOW(), status = $3 WHERE id = $4`,
        ['waiting', speechResult || null, 'queued', callId]
      );
      await query(
        `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
        [callId, 'twilio.routing.queued', { speechResult, callSid, companyId }]
      );
      logger.info('Call queued for transfer', { callId, speechResult: speechResult.slice(0, 80) });
    } catch (dbError: any) {
      logger.error('gather-reason DB error (columns may be missing — run migration)', { callId, error: dbError.message });
    }
  }

  res.type('text/xml').send(buildTwiml(
    `<Say language="fr-FR">Merci. Veuillez patienter, un agent va vous prendre en charge.</Say>` +
    `<Say language="fr-FR">...</Say>`.repeat(0) +
    `<Pause length="30"/><Say language="fr-FR">Nous vous remercions de votre patience.</Say><Pause length="30"/><Hangup />`
  ));
});

router.get('/twilio/agent-audio', async (req: Request, res: Response) => {
  try {
    const promptText = String(req.query.text || '').trim();
    const offerMode = String(req.query.offerMode || 'B');

    if (!promptText) {
      res.status(400).send('Prompt text required');
      return;
    }

    const audio = offerMode === 'Bbis'
      ? await deepgramTextToSpeech(promptText.slice(0, 500), 'wav')
      : await textToSpeech(promptText.slice(0, 500));

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', offerMode === 'Bbis' ? 'audio/wav' : 'audio/mpeg');
    res.send(audio);
  } catch (error: any) {
    logger.error('Twilio Offer B prompt generation error', { error: error.message });
    res.status(500).send('Prompt unavailable');
  }
});

router.all('/twilio/agent-turn', async (req: Request, res: Response) => {
  try {
    const { callId } = req.query;
    const speechResult = String(req.body.SpeechResult || '').trim();
    const callResult = await query(
      `SELECT c.id, c.call_sid, c.company_id, c.caller_number, co.name AS company_name, co.settings
       FROM calls c
       INNER JOIN companies co ON co.id = c.company_id
       WHERE c.id = $1`,
      [String(callId || '')]
    );

    if (callResult.rows.length === 0) {
      res.type('text/xml').send(buildTwiml('<Hangup />'));
      return;
    }

    const call = callResult.rows[0];
    const company = {
      id: call.company_id,
      name: call.company_name,
      settings: call.settings || {},
    };
    const baseUrl = getBaseUrl(req);
    const offerBSettings = await getCompanyOfferBSettings(company.id);
    const activeOfferMode = getActiveOfferMode(offerBSettings);
    const responseOfferMode: 'B' | 'Bbis' = activeOfferMode === 'Bbis' ? 'Bbis' : 'B';

    if (!shouldUseRealtimeOfferAgent(offerBSettings)) {
      const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
      const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
      res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
      return;
    }

    const conversation = await getOrCreateConversation(call.id);
    const consecutiveFailures = Number(conversation.context?.consecutiveFailures || 0);
    const fastIntent = detectOfferBIntent(speechResult);
    const requestedByCaller = fastIntent.intent === 'human_transfer';

    if (!speechResult) {
      const escalation = defaultEscalationPolicy.evaluate({
        requestedByCaller: false,
        consecutiveFailures: consecutiveFailures + 1,
        maxAgentFailures: offerBSettings.maxAgentFailures,
      });

      await persistConversationTurn(call.id, conversation, '', '', {
        consecutiveFailures: consecutiveFailures + 1,
        lastAction: escalation.shouldTransfer ? 'transfer_requested_after_silence' : 'reprompt_after_silence',
      });

      if (escalation.shouldTransfer && offerBSettings.humanTransferNumber) {
        await registerOfferBAction(call.id, 'transfer_to_human', {
          reason: escalation.reason,
          transferNumber: offerBSettings.humanTransferNumber,
        });
        res.type('text/xml').send(buildTransferTwiml(offerBSettings.humanTransferNumber));
        return;
      }

      if (escalation.shouldTransfer && offerBSettings.fallbackToVoicemail) {
        const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
        const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
        await registerOfferBAction(call.id, 'fallback_to_voicemail', { reason: escalation.reason });
        res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
        return;
      }

      res.type('text/xml').send(
        buildOfferBFollowupTwiml(baseUrl, call.id, 'Je n’ai rien entendu. Pouvez-vous répéter votre demande en une phrase ?', responseOfferMode)
      );
      return;
    }

    if (fastIntent.intent === 'greeting') {
      const greetingReply = `Bonjour, je suis le réceptionniste de ${company.name}. Comment puis-je vous aider ?`;

      await persistConversationTurn(call.id, conversation, speechResult, greetingReply, {
        consecutiveFailures: 0,
        lastIntent: 'autre',
        lastAction: 'agent_replied',
      });
      await upsertOfferBSummary(call.id, speechResult, 'autre');
      await registerOfferBAction(call.id, 'agent_replied', { intent: 'autre', input: speechResult });

      res.type('text/xml').send(buildOfferBFollowupTwiml(baseUrl, call.id, greetingReply, responseOfferMode));
      return;
    }

    if (fastIntent.intent === 'goodbye') {
      const goodbyeReply = 'Merci, au revoir et bonne journée.';

      await persistConversationTurn(call.id, conversation, speechResult, goodbyeReply, {
        consecutiveFailures: 0,
        lastIntent: 'autre',
        lastAction: 'call_closed_by_agent',
      });
      await upsertOfferBSummary(call.id, speechResult, 'autre');
      await registerOfferBAction(call.id, 'agent_closed_call', { input: speechResult });
      await query(
        `UPDATE calls
         SET status = $1, ended_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        ['completed', call.id]
      );

      res.type('text/xml').send(buildOfferBHangupTwiml(baseUrl, goodbyeReply, responseOfferMode));
      return;
    }

    const knowledgeContext = offerBSettings.knowledgeBaseEnabled
      ? await buildKnowledgeBaseContext(company.id, speechResult)
      : '';

    const intentData = {
      intent: mapFastIntentToSummaryIntent(fastIntent.intent),
      confidence: fastIntent.confidence,
      entities: {},
    };
    const agentReply = await generateOfferBReply({
      companyName: company.name,
      callerInput: speechResult,
      knowledgeContext,
      humanTransferNumber: offerBSettings.humanTransferNumber,
    });

    if (agentReply === '__TRANSFER__') {
      const escalation = defaultEscalationPolicy.evaluate({
        requestedByCaller,
        consecutiveFailures: consecutiveFailures + 1,
        maxAgentFailures: offerBSettings.maxAgentFailures,
      });

      await persistConversationTurn(call.id, conversation, speechResult, '', {
        consecutiveFailures: consecutiveFailures + 1,
        lastIntent: intentData.intent,
        lastAction: escalation.shouldTransfer ? 'transfer_requested_by_agent' : 'agent_blocked',
      });

      if (!requestedByCaller && !escalation.shouldTransfer) {
        await registerOfferBAction(call.id, 'agent_needs_clarification', {
          intent: intentData.intent,
          input: speechResult,
        });
        res.type('text/xml').send(
          buildOfferBFollowupTwiml(
            baseUrl,
            call.id,
            'Je n’ai pas encore assez d’informations pour répondre précisément. Pouvez-vous reformuler ou préciser votre demande ?',
            responseOfferMode
          )
        );
        return;
      }

      if (escalation.shouldTransfer && offerBSettings.humanTransferNumber) {
        await registerOfferBAction(call.id, 'transfer_to_human', {
          reason: escalation.reason,
          transferNumber: offerBSettings.humanTransferNumber,
          intent: intentData.intent,
        });
        res.type('text/xml').send(buildTransferTwiml(offerBSettings.humanTransferNumber));
        return;
      }

      if (offerBSettings.fallbackToVoicemail) {
        const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
        const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
        await registerOfferBAction(call.id, 'fallback_to_voicemail', { intent: intentData.intent });
        res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
        return;
      }

      res.type('text/xml').send(
        buildOfferBFollowupTwiml(baseUrl, call.id, 'Je préfère vous orienter vers un humain. Pouvez-vous reformuler une dernière fois votre besoin ?', responseOfferMode)
      );
      return;
    }

    await persistConversationTurn(call.id, conversation, speechResult, agentReply, {
      consecutiveFailures: 0,
      lastIntent: intentData.intent,
      lastAction: 'agent_replied',
    });
    await upsertOfferBSummary(call.id, speechResult, intentData.intent);
    await registerOfferBAction(call.id, 'agent_replied', { intent: intentData.intent, input: speechResult });

    res.type('text/xml').send(buildOfferBFollowupTwiml(baseUrl, call.id, agentReply, responseOfferMode));
  } catch (error: any) {
    logger.error('Twilio Offer B agent turn error', { error: error.message });

    try {
      const { callId } = req.query;
      const fallbackCallResult = await query(
        `SELECT c.id, c.company_id
         FROM calls c
         WHERE c.id = $1`,
        [String(callId || '')]
      );

      if (fallbackCallResult.rows.length > 0) {
        const call = fallbackCallResult.rows[0];
        const baseUrl = getBaseUrl(req);
        const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${call.company_id}`);
        const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');

        await registerOfferBAction(call.id, 'fallback_to_voicemail', { reason: 'agent_turn_error' });
        res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
        return;
      }
    } catch (fallbackError: any) {
      logger.error('Twilio Offer B fallback error', { error: fallbackError.message });
    }

    res.type('text/xml').send(buildTwiml('<Say language="fr-FR" voice="alice">Une erreur est survenue. Merci de rappeler plus tard.</Say><Hangup />'));
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

// Click-to-call: when the original caller picks up, Twilio calls this URL
// and we bridge them to the staff member's phone.
router.all('/twilio/transfer', async (req: Request, res: Response) => {
  const staffPhone = String(req.query.staffPhone || req.body?.staffPhone || '');

  if (!staffPhone) {
    res.type('text/xml').send(buildTwiml('<Say language="fr-FR">Une erreur est survenue. Veuillez réessayer.</Say><Hangup />'));
    return;
  }

  const twiml = buildTwiml(
    `<Dial timeout="30" answerOnBridge="true"><Number>${escapeXml(staffPhone)}</Number></Dial>`
  );
  res.type('text/xml').send(twiml);
});

// Click-to-call: status callback — if no-answer / busy / failed, leave a voicemail
router.post('/twilio/call-status', async (req: Request, res: Response) => {
  const callStatus = String(req.body?.CallStatus || '');
  const voicemailMessage = String(req.query.voicemailMessage || req.body?.voicemailMessage || '');
  const callId = String(req.query.callId || '');
  const staffId = String(req.query.staffId || '');

  logger.info('Click-to-call status callback', { callStatus, callId, staffId });

  if (['no-answer', 'busy', 'failed'].includes(callStatus) && voicemailMessage) {
    const twiml = buildTwiml(
      `<Say language="fr-FR">${escapeXml(voicemailMessage)}</Say><Hangup />`
    );
    res.type('text/xml').send(twiml);
    return;
  }

  res.type('text/xml').send(buildTwiml('<Hangup />'));
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

function toWebSocketBaseUrl(baseUrl: string): string {
  if (baseUrl.startsWith('https://')) {
    return `wss://${baseUrl.slice('https://'.length)}`;
  }

  if (baseUrl.startsWith('http://')) {
    return `ws://${baseUrl.slice('http://'.length)}`;
  }

  return baseUrl;
}

function buildOfferBStreamingUrl(baseUrl: string, callId: string, companyId: string): string {
  return joinUrl(
    toWebSocketBaseUrl(baseUrl),
    `/api/media-streams/twilio?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}`
  );
}

function buildOfferBStreamingTwiml(streamUrl: string, callId: string, companyId: string): string {
  return buildTwiml(
    `<Connect><Stream url="${escapeXml(streamUrl)}"><Parameter name="callId" value="${escapeXml(callId)}" /><Parameter name="companyId" value="${escapeXml(companyId)}" /></Stream></Connect>`
  );
}

function buildOfferAVoicemailTwiml(greetingUrl: string, recordingCompleteUrl: string): string {
  return buildTwiml(
    `<Play>${escapeXml(greetingUrl)}</Play><Record method="POST" playBeep="true" maxLength="120" trim="trim-silence" recordingStatusCallback="${escapeXml(recordingCompleteUrl)}" recordingStatusCallbackMethod="POST" /><Hangup />`
  );
}

function buildOfferARoutingTwiml(greetingUrl: string, gatherUrl: string): string {
  return buildTwiml(
    `<Gather input="speech" language="fr-FR" speechTimeout="auto" action="${escapeXml(gatherUrl)}" method="POST"><Play>${escapeXml(greetingUrl)}</Play></Gather><Redirect>${escapeXml(gatherUrl)}</Redirect>`
  );
}

function buildOfferBWelcomeTwiml(baseUrl: string, company: any, callId: string, settings: any): string {
  const actionUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-turn?callId=${encodeURIComponent(callId)}`);
  const greeting = settings.greetingText || `Bonjour, vous êtes bien chez ${company.name}. Comment puis-je vous aider aujourd’hui ?`;
  const activeOfferMode = getActiveOfferMode(settings);
  const promptUrl = joinUrl(
    baseUrl,
    `/api/webhooks/twilio/agent-audio?offerMode=${encodeURIComponent(activeOfferMode)}&text=${encodeURIComponent(greeting)}`
  );
  return buildGatherTwiml(actionUrl, promptUrl);
}

function buildOfferBFollowupTwiml(baseUrl: string, callId: string, prompt: string, offerMode: 'B' | 'Bbis' = 'B'): string {
  const actionUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-turn?callId=${encodeURIComponent(callId)}`);
  const promptUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-audio?offerMode=${encodeURIComponent(offerMode)}&text=${encodeURIComponent(prompt)}`);
  return buildGatherTwiml(actionUrl, promptUrl);
}

function buildOfferBHangupTwiml(baseUrl: string, prompt: string, offerMode: 'B' | 'Bbis' = 'B'): string {
  const promptUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-audio?offerMode=${encodeURIComponent(offerMode)}&text=${encodeURIComponent(prompt)}`);
  return buildTwiml(`<Play>${escapeXml(promptUrl)}</Play><Hangup />`);
}

function buildGatherTwiml(actionUrl: string, promptUrl: string): string {
  return buildTwiml(
    `<Gather input="speech" action="${escapeXml(actionUrl)}" actionOnEmptyResult="true" method="POST" language="fr-FR" speechTimeout="auto" timeout="5"><Play>${escapeXml(promptUrl)}</Play></Gather>`
  );
}

function buildTransferTwiml(targetNumber: string): string {
  return buildTwiml(`<Say language="fr-FR" voice="alice">Je vous transfère vers un collaborateur.</Say><Dial>${escapeXml(targetNumber)}</Dial>`);
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

async function getOrCreateConversation(callId: string) {
  const existingConversation = await query(
    'SELECT id, state, context, messages FROM conversations WHERE call_id = $1',
    [callId]
  );

  if (existingConversation.rows.length > 0) {
    return existingConversation.rows[0];
  }

  const result = await query(
    `INSERT INTO conversations (call_id, state, context, messages)
     VALUES ($1, $2, $3, $4)
     RETURNING id, state, context, messages`,
    [callId, 'active', JSON.stringify({ consecutiveFailures: 0 }), JSON.stringify([])]
  );

  return result.rows[0];
}

async function persistConversationTurn(
  callId: string,
  conversation: any,
  userText: string,
  assistantText: string,
  contextPatch: Record<string, unknown>
) {
  const messages = Array.isArray(conversation.messages) ? [...conversation.messages] : [];

  if (userText) {
    messages.push({ role: 'caller', content: userText, timestamp: new Date().toISOString() });
  }

  if (assistantText) {
    messages.push({ role: 'assistant', content: assistantText, timestamp: new Date().toISOString() });
  }

  const nextContext = {
    ...(conversation.context || {}),
    ...contextPatch,
    updatedAt: new Date().toISOString(),
  };

  await query(
    `UPDATE conversations
     SET context = $1, messages = $2, updated_at = CURRENT_TIMESTAMP
     WHERE call_id = $3`,
    [JSON.stringify(nextContext), JSON.stringify(messages), callId]
  );

  const transcriptParts = [userText ? `Client: ${userText}` : '', assistantText ? `IA: ${assistantText}` : '']
    .filter(Boolean)
    .join('\n');

  if (transcriptParts) {
    const transcriptionResult = await query(
      'SELECT id, text FROM transcriptions WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
      [callId]
    );

    if (transcriptionResult.rows.length === 0) {
      await query(
        `INSERT INTO transcriptions (call_id, text, language, confidence)
         VALUES ($1, $2, $3, $4)`,
        [callId, transcriptParts, 'fr', 1]
      );
    } else {
      const existingText = transcriptionResult.rows[0].text || '';
      const nextText = existingText ? `${existingText}\n${transcriptParts}` : transcriptParts;
      await query(
        'UPDATE transcriptions SET text = $1 WHERE id = $2',
        [nextText, transcriptionResult.rows[0].id]
      );
    }
  }
}

async function upsertOfferBSummary(callId: string, callerInput: string, intent: string) {
  const summaryText = `Dernière demande détectée : ${callerInput}`;
  const summaryResult = await query(
    'SELECT id, actions FROM call_summaries WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
    [callId]
  );

  if (summaryResult.rows.length === 0) {
    await query(
      `INSERT INTO call_summaries (call_id, summary, intent, actions)
       VALUES ($1, $2, $3, $4)`,
      [callId, summaryText, intent, JSON.stringify([{ type: 'agent_replied', description: 'Réponse temps réel générée par l’agent.' }])]
    );
    return;
  }

  await query(
    `UPDATE call_summaries
     SET summary = $1, intent = $2
     WHERE id = $3`,
    [summaryText, intent, summaryResult.rows[0].id]
  );
}

async function registerOfferBAction(callId: string, eventType: string, data: Record<string, unknown>) {
  await query(
    `INSERT INTO call_events (call_id, event_type, data)
     VALUES ($1, $2, $3)`,
    [callId, eventType, data]
  );

  const actionDescriptions: Record<string, string> = {
    transfer_to_human: 'Transfert vers un humain demandé ou décidé par l’agent.',
    fallback_to_voicemail: 'Retour automatique vers la messagerie de l’offre A.',
    agent_replied: 'Réponse temps réel fournie par le réceptionniste IA.',
    agent_needs_clarification: 'L’agent a demandé une reformulation au lieu d’escalader immédiatement.',
    agent_closed_call: 'L’agent a conclu l’appel après une formule de clôture.',
  };

  const summaryResult = await query(
    'SELECT id, actions FROM call_summaries WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
    [callId]
  );

  if (summaryResult.rows.length === 0) {
    return;
  }

  const existingActions = Array.isArray(summaryResult.rows[0].actions)
    ? [...summaryResult.rows[0].actions]
    : [];

  existingActions.push({
    type: eventType,
    description: actionDescriptions[eventType] || 'Action Offer B enregistrée.',
    data,
  });

  await query(
    'UPDATE call_summaries SET actions = $1 WHERE id = $2',
    [JSON.stringify(existingActions), summaryResult.rows[0].id]
  );
}

async function generateOfferBReply(params: {
  companyName: string;
  callerInput: string;
  knowledgeContext: string;
  humanTransferNumber?: string;
}) {
  const systemPrompt = [
    `Tu es le réceptionniste téléphonique de ${params.companyName}.`,
    'Réponds en français, avec deux phrases maximum, ton professionnel et utile.',
    'Si le client demande explicitement un humain, un rappel ou un transfert, réponds exactement __TRANSFER__.',
    'Si l’information manque, n’invente pas et ne transfère pas automatiquement : demande une précision en une phrase courte.',
    'N’invente pas : utilise uniquement les informations métier fournies si elles existent.',
    params.knowledgeContext ? `Informations métier disponibles:\n${params.knowledgeContext}` : 'Aucune information métier fiable n’est disponible.',
    params.humanTransferNumber ? `Un numéro humain est configuré : ${params.humanTransferNumber}.` : 'Aucun numéro humain n’est configuré.',
  ].join('\n\n');

  const response = await generateResponse(
    [{ role: 'user', content: params.callerInput }],
    systemPrompt
  );

  return response.trim();
}

function detectOfferBIntent(text: string): { intent: 'greeting' | 'goodbye' | 'human_transfer' | 'info' | 'other'; confidence: number } {
  const normalizedText = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (!normalizedText) {
    return { intent: 'other', confidence: 0 };
  }

  if (/^(salut|bonjour|bonsoir|allo|hello)[ !?.]*$/.test(normalizedText)) {
    return { intent: 'greeting', confidence: 0.95 };
  }

  if (/(au revoir|a bientot|a plus|merci au revoir|bonne journee|bye)/.test(normalizedText)) {
    return { intent: 'goodbye', confidence: 0.95 };
  }

  if (/(humain|personne|conseiller|rappel|rappeler|transfer|transfert|collegue)/.test(normalizedText)) {
    return { intent: 'human_transfer', confidence: 0.95 };
  }

  if (/(horaire|heure|ouvert|ouverture|ferme|adresse|service|prix|tarif|rendez-vous|rdv|information|infos)/.test(normalizedText)) {
    return { intent: 'info', confidence: 0.8 };
  }

  return { intent: 'other', confidence: 0.5 };
}

function mapFastIntentToSummaryIntent(intent: 'greeting' | 'goodbye' | 'human_transfer' | 'info' | 'other'): string {
  switch (intent) {
    case 'human_transfer':
      return 'autre';
    case 'info':
      return 'info';
    default:
      return 'autre';
  }
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
