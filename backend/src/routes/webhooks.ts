import { Router, Request, Response } from 'express';
import { query } from '../config/database';
import { sendTranscriptionEmail } from '../services/email';
import { detectIntent, generateResponse, summarizeCall, textToSpeech as mistralTextToSpeech, transcribeAudioUrlWithDiarization } from '../services/mistral';
import { buildKnowledgeBaseContext, defaultEscalationPolicy, getAiModelsSettings, getCompanyOfferBSettings, shouldUseRealtimeOfferAgent } from '../services/offerB';
import { resolveDispatchTarget } from '../services/dispatchService';
import { shouldUseOfferBStreamingPipeline } from '../services/twilioMediaStreams';
import logger from '../utils/logger';

const router = Router();

function isUnavailableSummary(summary: unknown): boolean {
  const value = typeof summary === 'string' ? summary.trim() : '';
  return !value || value === 'Résumé non disponible';
}

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
    const voiceStatusUrl = joinUrl(baseUrl, '/api/webhooks/twilio/voice-status');

    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [callId, 'twilio.voice.inbound', payload]
    );

    await query(
      `UPDATE calls SET status = $1, metadata = metadata || $2 WHERE id = $3`,
      ['answered', JSON.stringify({ voiceStatusUrl }), callId]
    );

    if (shouldUseRealtimeOfferAgent(offerBSettings)) {
      if (shouldUseOfferBStreamingPipeline(offerBSettings)) {
        await getOrCreateConversation(callId);

        await query(
          `INSERT INTO call_events (call_id, event_type, data)
           VALUES ($1, $2, $3)`,
          [callId, 'twilio.offer_b.started', { settings: offerBSettings, callSid: payload.CallSid }]
        );

        const streamUrl = buildOfferBStreamingUrl(baseUrl, callId, company.id);
        res.type('text/xml').send(buildOfferBStreamingTwiml(streamUrl, callId, company.id));
        return;
      }

      logger.warn('Voice pipeline enabled but streaming providers unavailable, falling back to Core voicemail', { companyId: company.id });
      // fall-through vers Core
    }

    if (offerBSettings.smartRoutingEnabled) {
      const routingQuestion = offerBSettings.routingQuestion || 'Quel est le motif de votre appel ?';
      const gatherUrl = joinUrl(baseUrl, `/api/webhooks/twilio/gather-reason?callId=${callId}&companyId=${company.id}`);
      const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}&routing=1&question=${encodeURIComponent(routingQuestion)}`);
      res.type('text/xml').send(buildOfferARoutingTwiml(greetingUrl, gatherUrl, voiceStatusUrl));
      return;
    }

    const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
    const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
    res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl, voiceStatusUrl));
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
    const aiModels = getAiModelsSettings(company.settings || {});
    const greetingText = company.settings?.twilioGreetingText || company.settings?.greetingText || `Bonjour, vous êtes bien chez ${company.name}. Merci de laisser votre message après le bip.`;
    const fullText = isRouting ? `${greetingText} ${routingQuestion}` : greetingText;
    const audio = await mistralTextToSpeech(fullText, 'mp3', 'fr', {
      model: aiModels.greetingTtsModel || 'voxtral-mini-tts-2603',
      voice: aiModels.greetingTtsVoice || 'c9cc6578-7734-4604-b2d3-51ce694f3afc',
    });

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

    if (speechResult) {
      setImmediate(async () => {
        try {
          const callRow = await query(
            `SELECT c.id, c.caller_number, c.created_at, c.company_id, co.email AS company_email, co.settings AS company_settings
             FROM calls c LEFT JOIN companies co ON co.id = c.company_id WHERE c.id = $1`,
            [callId]
          );
          if (callRow.rows.length === 0) return;
          const call = callRow.rows[0];
          const aiModelsGather = getAiModelsSettings(call.company_settings || {});

          const existing = await query('SELECT id FROM transcriptions WHERE call_id = $1', [callId]);
          if (existing.rows.length === 0) {
            await query(
              `INSERT INTO transcriptions (call_id, text, language, confidence) VALUES ($1, $2, $3, $4)`,
              [callId, speechResult, 'fr', 0.9]
            );
          }

          const [summary, intentData] = await Promise.all([
            summarizeCall(speechResult, aiModelsGather.summaryLlmModel || undefined),
            detectIntent(speechResult, companyId, aiModelsGather.intentLlmModel || undefined),
          ]);

          const existingSummary = await query('SELECT id, summary FROM call_summaries WHERE call_id = $1', [callId]);
          if (existingSummary.rows.length === 0) {
            await query(
              `INSERT INTO call_summaries (call_id, summary, intent, actions) VALUES ($1, $2, $3, $4)`,
              [callId, summary, intentData.intent, JSON.stringify([])]
            );
          } else if (!isUnavailableSummary(summary) || isUnavailableSummary(existingSummary.rows[0].summary)) {
            await query(
              'UPDATE call_summaries SET summary = $1, intent = $2 WHERE id = $3',
              [summary, intentData.intent, existingSummary.rows[0].id]
            );
          }

          if (call.company_email) {
            await sendTranscriptionEmail(call.company_email, {
              callerNumber: call.caller_number || 'Inconnu',
              transcription: speechResult,
              duration: 0,
              createdAt: call.created_at,
            }).catch((e: any) => logger.error('gather-reason email error', { error: e.message }));
          }

          logger.info('gather-reason: transcription + summary saved', { callId });
        } catch (aiError: any) {
          logger.error('gather-reason AI processing error', { callId, error: aiError.message });
        }
      });
    }
  }

  // Try to automatically dispatch the call via configured rules
  const baseUrl = getBaseUrl(req);
  const dispatchTarget = await resolveDispatchTarget(companyId, speechResult || undefined);

  if (dispatchTarget && callId) {
    await query(
      `UPDATE calls SET queue_status = 'dispatched', metadata = metadata || $1 WHERE id = $2`,
      [JSON.stringify({ dispatchRuleId: dispatchTarget.ruleId, dispatchRuleName: dispatchTarget.ruleName }), callId]
    ).catch((e: any) => logger.warn('dispatch metadata update failed', { error: e.message }));

    res.type('text/xml').send(buildDispatchTransferTwiml({
      numbers: dispatchTarget.numbers,
      simultaneous: dispatchTarget.strategy === 'simultaneous',
      announcement: speechResult
        ? 'Merci. Je vous mets en relation avec le bon interlocuteur.'
        : 'Je vous mets en relation avec un agent.',
      fallbackType: dispatchTarget.fallbackType,
      fallbackNumber: dispatchTarget.fallbackNumber,
      baseUrl,
      companyId,
      callId,
    }));
    return;
  }

  // No matching dispatch rule (outside hours or no rule configured): fallback to Receptio voicemail
  const greetingUrlFallback = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${encodeURIComponent(companyId)}`);
  const recordingCompleteUrlFallback = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
  res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrlFallback, recordingCompleteUrlFallback));
});

router.get('/twilio/agent-audio', async (req: Request, res: Response) => {
  try {
    const promptText = String(req.query.text || '').trim();

    if (!promptText) {
      res.status(400).send('Prompt text required');
      return;
    }

    const audio = await mistralTextToSpeech(promptText.slice(0, 500), 'wav');

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Content-Type', 'audio/wav');
    res.send(audio);
  } catch (error: any) {
    logger.error('Twilio agent audio generation error', { error: error.message });
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
    const aiModelsOfferB = getAiModelsSettings(offerBSettings);

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

      if (escalation.shouldTransfer) {
        const dispatchTarget = await resolveDispatchTarget(company.id, undefined);
        const transferNumber = dispatchTarget?.numbers[0] || offerBSettings.humanTransferNumber;

        if (transferNumber) {
          await registerOfferBAction(call.id, 'transfer_to_human', {
            reason: escalation.reason,
            transferNumber,
            dispatchRuleId: dispatchTarget?.ruleId,
          });
          res.type('text/xml').send(buildTransferTwiml(transferNumber));
          return;
        }

        if (offerBSettings.fallbackToVoicemail) {
          const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
          const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
          await registerOfferBAction(call.id, 'fallback_to_voicemail', { reason: escalation.reason });
          res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
          return;
        }
      }

      res.type('text/xml').send(
        buildOfferBFollowupTwiml(baseUrl, call.id, "Je n'ai rien entendu. Pouvez-vous répéter votre demande en une phrase ?")
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

      res.type('text/xml').send(buildOfferBFollowupTwiml(baseUrl, call.id, greetingReply));
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

      res.type('text/xml').send(buildOfferBHangupTwiml(baseUrl, goodbyeReply));
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
      model: aiModelsOfferB.offerBLlmModel || undefined,
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
            'Je n\u2019ai pas encore assez d\u2019informations pour r\u00e9pondre pr\u00e9cis\u00e9ment. Pouvez-vous reformuler ou pr\u00e9ciser votre demande ?'
          )
        );
        return;
      }

      if (escalation.shouldTransfer) {
        const dispatchTarget = await resolveDispatchTarget(company.id, speechResult);
        const transferNumber = dispatchTarget?.numbers[0] || offerBSettings.humanTransferNumber;

        if (transferNumber) {
          await registerOfferBAction(call.id, 'transfer_to_human', {
            reason: escalation.reason,
            transferNumber,
            intent: intentData.intent,
            dispatchRuleId: dispatchTarget?.ruleId,
          });
          res.type('text/xml').send(buildTransferTwiml(transferNumber));
          return;
        }
      }

      if (offerBSettings.fallbackToVoicemail) {
        const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${company.id}`);
        const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
        await registerOfferBAction(call.id, 'fallback_to_voicemail', { intent: intentData.intent });
        res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
        return;
      }

      res.type('text/xml').send(
        buildOfferBFollowupTwiml(baseUrl, call.id, 'Je préfère vous orienter vers un humain. Pouvez-vous reformuler une dernière fois votre besoin ?')
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

    res.type('text/xml').send(buildOfferBFollowupTwiml(baseUrl, call.id, agentReply));
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
      `SELECT c.id, c.caller_number, c.created_at, c.company_id, co.email AS company_email, co.settings AS company_settings
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
       SET recording_url = $1, duration = COALESCE(NULLIF($2, 0), duration), status = CASE WHEN status NOT IN ('transferred') THEN 'completed' ELSE status END, ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
       WHERE id = $3`,
      [recordingUrl, recordingDuration, call.id]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data)
       VALUES ($1, $2, $3)`,
      [call.id, 'twilio.recording.completed', payload]
    );

    // Respond immediately — transcription runs async
    res.status(200).send('ok');

    const aiModelsRec = getAiModelsSettings(call.company_settings || {});

    setImmediate(async () => {
      try {
        const existingT = await query(
          'SELECT id, text, segments FROM transcriptions WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
          [call.id]
        );

        type Segment = { role: 'agent' | 'client'; text: string; ts?: number };
        let segments: Segment[] | null = null;
        let fullText = '';
        let lang = 'fr';
        let confidence = 0.9;
        const motifInitial = existingT.rows.length > 0 ? (existingT.rows[0].text || '') : '';
        let hasExistingSegments = false;

        // 1. Segments déjà en DB (flush WebSocket)
        if (existingT.rows.length > 0 && existingT.rows[0].segments) {
          try {
            const raw = existingT.rows[0].segments;
            const parsed: Segment[] = Array.isArray(raw) ? raw : JSON.parse(raw);
            if (parsed.length > 0) {
              segments = parsed;
              fullText = existingT.rows[0].text || '';
              hasExistingSegments = true;
              logger.info('recording-complete: using existing WebSocket segments', { callId: call.id, count: segments.length });
            }
          } catch { /* ignore */ }
        }

        // 2. live_transcript JSON (stream audio en cours / flush récent)
        if (!hasExistingSegments) {
          const callRow = await query('SELECT live_transcript FROM calls WHERE id = $1', [call.id]);
          const liveRaw = callRow.rows[0]?.live_transcript;
          if (liveRaw) {
            try {
              const parsed: Segment[] = JSON.parse(liveRaw);
              if (Array.isArray(parsed) && parsed.length > 0 && 'role' in parsed[0]) {
                segments = parsed;
                const convText = parsed.map(s => `${s.role === 'agent' ? 'Agent' : 'Client'}: ${s.text}`).join('\n\n');
                fullText = motifInitial ? `[Motif initial] ${motifInitial}\n\n[Conversation avec l'agent]\n${convText}` : convText;
                logger.info('recording-complete: using live_transcript segments', { callId: call.id, count: segments.length });
              }
            } catch { /* ignore */ }
          }
        }

        // 3. Diarisation de l'enregistrement audio (fallback)
        if (!segments) {
          logger.info('recording-complete: running diarized transcription', { callId: call.id });
          const diarized = await transcribeAudioUrlWithDiarization(recordingUrl, 'fr', 'agent', aiModelsRec.transcriptionSttModel || undefined);
          segments = diarized.segments ?? null;
          lang = diarized.language;
          confidence = diarized.confidence;
          const convText = segments
            ? segments.map(s => `${s.role === 'agent' ? 'Agent' : 'Client'}: ${s.text}`).join('\n\n')
            : diarized.text;
          fullText = motifInitial ? `[Motif initial] ${motifInitial}\n\n[Conversation avec l'agent]\n${convText}` : convText;
        }

        if (!hasExistingSegments) {
          if (existingT.rows.length === 0) {
            await query(
              `INSERT INTO transcriptions (call_id, text, language, confidence, segments) VALUES ($1, $2, $3, $4, $5)`,
              [call.id, fullText, lang, confidence, segments ? JSON.stringify(segments) : null]
            );
          } else {
            if (segments) {
              await query(
                'UPDATE transcriptions SET text = $1, language = $2, confidence = $3, segments = $4 WHERE id = $5',
                [fullText, lang, confidence, JSON.stringify(segments), existingT.rows[0].id]
              );
            } else {
              await query(
                'UPDATE transcriptions SET text = $1, language = $2, confidence = $3 WHERE id = $4',
                [fullText, lang, confidence, existingT.rows[0].id]
              );
            }
          }
        }

        const [summary, intentData] = await Promise.all([
          summarizeCall(fullText, aiModelsRec.summaryLlmModel || undefined),
          detectIntent(fullText, call.company_id, aiModelsRec.intentLlmModel || undefined),
        ]);

        const existingSummary = await query('SELECT id, summary FROM call_summaries WHERE call_id = $1', [call.id]);
        if (existingSummary.rows.length > 0) {
          if (!isUnavailableSummary(summary) || isUnavailableSummary(existingSummary.rows[0].summary)) {
            await query('UPDATE call_summaries SET summary = $1, intent = $2 WHERE call_id = $3', [summary, intentData.intent, call.id]);
          }
        } else {
          await query(
            'INSERT INTO call_summaries (call_id, summary, intent, actions) VALUES ($1, $2, $3, $4)',
            [call.id, summary, intentData.intent, JSON.stringify([])]
          );
        }

        if (call.company_email) {
          await sendTranscriptionEmail(call.company_email, {
            callerNumber: call.caller_number || 'Inconnu',
            transcription: fullText,
            duration: recordingDuration,
            createdAt: call.created_at,
          }).catch((e: any) => logger.error('Twilio transcription email error', { error: e.message, callId: call.id }));
        }

        logger.info('recording-complete: transcription + summary done', { callId: call.id });
      } catch (err: any) {
        logger.error('recording-complete async processing error', { callId: call.id, error: err.message });
      }
    });
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
    `<Dial timeout="15" answerOnBridge="true"><Number>${escapeXml(staffPhone)}</Number></Dial>`
  );
  res.type('text/xml').send(twiml);
});

// Dispatch fallback — called by Twilio when a dispatched <Dial> ends
router.all('/twilio/dispatch-fallback', async (req: Request, res: Response) => {
  const companyId = String(req.query.companyId || '');
  const callId = String(req.query.callId || '');
  const fallback = String(req.query.fallback || 'voicemail');
  const fallbackNumber = String(req.query.number || '');
  const dialCallStatus = String(req.body?.DialCallStatus || '');
  const baseUrl = getBaseUrl(req);

  logger.info('dispatch-fallback', { companyId, callId, fallback, dialCallStatus });

  // If the agent answered and the call completed normally, just hang up
  if (dialCallStatus === 'completed') {
    if (callId) {
      await query(
        `UPDATE calls SET status = 'transferred', queue_status = 'dispatched', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $1`,
        [callId]
      ).catch(() => {});
    }
    res.type('text/xml').send(buildTwiml('<Hangup />'));
    return;
  }

  // No answer / busy / failed — apply the configured fallback
  if (fallback === 'transfer' && fallbackNumber) {
    res.type('text/xml').send(buildTwiml(
      `<Say language="fr-FR">Je vous transfère vers un autre collaborateur.</Say>` +
      `<Dial timeout="30">${escapeXml(fallbackNumber)}</Dial>`
    ));
    return;
  }

  if (fallback === 'none') {
    res.type('text/xml').send(buildTwiml(
      `<Say language="fr-FR">Nos équipes sont actuellement indisponibles. Merci de rappeler ultérieurement.</Say><Hangup />`
    ));
    return;
  }

  // Default fallback: voicemail
  const greetingUrl = joinUrl(baseUrl, `/api/webhooks/twilio/greeting?companyId=${encodeURIComponent(companyId)}`);
  const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
  res.type('text/xml').send(buildOfferAVoicemailTwiml(greetingUrl, recordingCompleteUrl));
});

// Generic inbound call status callback — fired by Twilio on every status change
router.post('/twilio/voice-status', async (req: Request, res: Response) => {
  try {
    const callSid = String(req.body?.CallSid || '');
    const callStatus = String(req.body?.CallStatus || '');
    const callDuration = parseInt(req.body?.CallDuration || '0', 10);

    logger.info('Twilio voice-status callback', { callSid, callStatus, callDuration });

    if (!callSid) {
      res.sendStatus(200);
      return;
    }

    const terminalStatuses = ['completed', 'no-answer', 'busy', 'failed', 'canceled'];
    if (terminalStatuses.includes(callStatus)) {
      const mappedStatus = callStatus === 'completed' ? 'completed' : callStatus === 'no-answer' ? 'missed' : callStatus;

      await query(
        `UPDATE calls
         SET status = $1, duration = COALESCE(NULLIF($2, 0), duration), ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
             queue_status = CASE WHEN queue_status = 'waiting' THEN 'abandoned' ELSE queue_status END
         WHERE call_sid = $3 AND status NOT IN ('completed', 'missed', 'transferred')`,
        [mappedStatus, callDuration, callSid]
      );

      logger.info('Call status updated via voice-status', { callSid, mappedStatus, callDuration });

      // Fallback : if the caller hung up before any recording started (recording-complete never fires),
      // ensure a minimal summary exists so the call detail is not left completely empty.
      setImmediate(async () => {
        try {
          const callRow = await query(
            `SELECT id, recording_url FROM calls WHERE call_sid = $1`,
            [callSid]
          );
          if (callRow.rows.length === 0) return;

          const callId = callRow.rows[0].id;

          // Always wait 15s: gives Twilio time to store recording_url AND fire recording-complete
          await new Promise(resolve => setTimeout(resolve, 15000));

          // Re-fetch after waiting to get the up-to-date recording_url
          const freshRow = await query(`SELECT recording_url FROM calls WHERE id = $1`, [callId]);
          const recordingUrl = freshRow.rows[0]?.recording_url as string | null;
          const hasRecording = Boolean(recordingUrl);

          if (hasRecording) {

            const [existingSummary, existingTranscription] = await Promise.all([
              query('SELECT id, summary FROM call_summaries WHERE call_id = $1', [callId]),
              query('SELECT id, text FROM transcriptions WHERE call_id = $1', [callId]),
            ]);

            const isFallbackTranscription = existingTranscription.rows.length > 0 &&
              existingTranscription.rows[0].text?.includes('raccroché avant de laisser un message');
            const isFallbackSummary = existingSummary.rows.length > 0 &&
              existingSummary.rows[0].summary?.includes('raccroché avant de laisser un message');

            const needsTranscription = existingTranscription.rows.length === 0 || isFallbackTranscription;
            const needsSummary = existingSummary.rows.length === 0 || isFallbackSummary;

            if (needsTranscription || needsSummary) {
              logger.info('voice-status: recording exists but no real transcription yet, running now', { callId, callSid });

              const callDetailsRow = await query(
                `SELECT c.id, c.caller_number, c.created_at, c.company_id, co.email AS company_email, co.settings AS company_settings
                 FROM calls c LEFT JOIN companies co ON co.id = c.company_id WHERE c.id = $1`,
                [callId]
              );
              if (callDetailsRow.rows.length === 0) return;
              const call = callDetailsRow.rows[0];
              const aiModels = getAiModelsSettings(call.company_settings || {});

              const diarized = await transcribeAudioUrlWithDiarization(recordingUrl!, 'fr', 'agent', aiModels.transcriptionSttModel || undefined);
              const segments = diarized.segments ?? null;
              const fullText = segments
                ? segments.map((s: any) => `${s.role === 'agent' ? 'Agent' : 'Client'}: ${s.text}`).join('\n\n')
                : diarized.text;

              if (needsTranscription) {
                if (isFallbackTranscription) {
                  await query(
                    `UPDATE transcriptions SET text = $1, language = $2, confidence = $3, segments = $4 WHERE call_id = $5`,
                    [fullText, diarized.language, diarized.confidence, segments ? JSON.stringify(segments) : null, callId]
                  );
                } else {
                  await query(
                    `INSERT INTO transcriptions (call_id, text, language, confidence, segments) VALUES ($1, $2, $3, $4, $5)`,
                    [callId, fullText, diarized.language, diarized.confidence, segments ? JSON.stringify(segments) : null]
                  );
                }
              }

              if (needsSummary) {
                const [summary, intentData] = await Promise.all([
                  summarizeCall(fullText, aiModels.summaryLlmModel || undefined),
                  detectIntent(fullText, call.company_id, aiModels.intentLlmModel || undefined),
                ]);
                if (isFallbackSummary) {
                  await query(
                    `UPDATE call_summaries SET summary = $1, intent = $2 WHERE call_id = $3`,
                    [summary, intentData.intent, callId]
                  );
                } else {
                  await query(
                    `INSERT INTO call_summaries (call_id, summary, intent, actions) VALUES ($1, $2, $3, $4)`,
                    [callId, summary, intentData.intent, JSON.stringify([])]
                  );
                }
              }

              logger.info('voice-status: transcription + summary done from recording_url', { callId, callSid });
            }
          } else {
            // No recording at all — insert generic fallback
            const existingSummary = await query('SELECT id FROM call_summaries WHERE call_id = $1', [callId]);
            if (existingSummary.rows.length === 0) {
              const fallbackSummary = mappedStatus === 'missed'
                ? 'Appel manqué — aucun message laissé.'
                : 'Appel court — le correspondant a raccroché avant de laisser un message.';
              await query(
                `INSERT INTO call_summaries (call_id, summary, intent, actions) VALUES ($1, $2, $3, $4)`,
                [callId, fallbackSummary, 'autre', JSON.stringify([])]
              );
            }
            const existingTranscription = await query('SELECT id FROM transcriptions WHERE call_id = $1', [callId]);
            if (existingTranscription.rows.length === 0) {
              const fallbackTranscription = mappedStatus === 'missed'
                ? 'Appel manqué — aucun message laissé.'
                : 'Le correspondant a raccroché avant de laisser un message.';
              await query(
                `INSERT INTO transcriptions (call_id, text, language, confidence) VALUES ($1, $2, $3, $4)`,
                [callId, fallbackTranscription, 'fr', 1.0]
              );
            }
          }
        } catch (fallbackErr: any) {
          logger.warn('voice-status: fallback summary error', { callSid, error: fallbackErr.message });
        }
      });
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('voice-status webhook error', { error: error.message });
    res.sendStatus(200);
  }
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
    `/api/media-streams/twilio?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}&baseUrl=${encodeURIComponent(baseUrl)}`
  );
}

function buildOfferBStreamingTwiml(streamUrl: string, callId: string, companyId: string): string {
  return buildTwiml(
    `<Connect><Stream url="${escapeXml(streamUrl)}"><Parameter name="callId" value="${escapeXml(callId)}" /><Parameter name="companyId" value="${escapeXml(companyId)}" /></Stream></Connect>`
  );
}

function buildOfferAVoicemailTwiml(greetingUrl: string, recordingCompleteUrl: string, _statusCallbackUrl?: string): string {
  // Note: <Play> does NOT support statusCallback - only <Dial> does
  // Note: NO <Hangup> after <Record> - Record is non-blocking and Hangup would terminate the call immediately
  return buildTwiml(
    `<Play>${escapeXml(greetingUrl)}</Play><Record method="POST" playBeep="true" maxLength="120" trim="do-not-trim" recordingStatusCallback="${escapeXml(recordingCompleteUrl)}" recordingStatusCallbackMethod="POST" />`
  );
}

function buildOfferARoutingTwiml(greetingUrl: string, gatherUrl: string, _statusCallbackUrl?: string): string {
  // Note: <Gather> does NOT support statusCallback - only <Dial> and <Conference> do
  return buildTwiml(
    `<Gather input="speech" language="fr-FR" speechTimeout="auto" action="${escapeXml(gatherUrl)}" method="POST"><Play>${escapeXml(greetingUrl)}</Play></Gather><Redirect>${escapeXml(gatherUrl)}</Redirect>`
  );
}

function buildOfferBFollowupTwiml(baseUrl: string, callId: string, prompt: string): string {
  const actionUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-turn?callId=${encodeURIComponent(callId)}`);
  const promptUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-audio?text=${encodeURIComponent(prompt)}`);
  return buildGatherTwiml(actionUrl, promptUrl);
}

function buildOfferBHangupTwiml(baseUrl: string, prompt: string): string {
  const promptUrl = joinUrl(baseUrl, `/api/webhooks/twilio/agent-audio?text=${encodeURIComponent(prompt)}`);
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

interface BuildDispatchTransferTwimlParams {
  numbers: string[];
  simultaneous: boolean;
  announcement: string;
  fallbackType: string;
  fallbackNumber?: string;
  baseUrl: string;
  companyId: string;
  callId: string;
}

function buildDispatchTransferTwiml(params: BuildDispatchTransferTwimlParams): string {
  const { numbers, simultaneous: _simultaneous, announcement, fallbackType, fallbackNumber, baseUrl, companyId, callId } = params;

  const numberTags = numbers.map(n => `<Number>${escapeXml(n)}</Number>`).join('');

  let fallbackParam = 'voicemail';
  if (fallbackType === 'none') fallbackParam = 'none';
  else if ((fallbackType === 'group' || fallbackType === 'agent') && fallbackNumber) fallbackParam = 'transfer';

  const fallbackQs = fallbackParam === 'transfer' && fallbackNumber
    ? `&fallback=transfer&number=${encodeURIComponent(fallbackNumber)}`
    : `&fallback=${fallbackParam}`;

  const dialActionUrl = joinUrl(
    baseUrl,
    `/api/webhooks/twilio/dispatch-fallback?companyId=${encodeURIComponent(companyId)}&callId=${encodeURIComponent(callId)}${fallbackQs}`
  );

  const recordingCompleteUrl = joinUrl(baseUrl, '/api/webhooks/twilio/recording-complete');
  const wsBaseUrl = toWebSocketBaseUrl(baseUrl);
  const streamUrl = joinUrl(wsBaseUrl, `/api/media-streams/outbound?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}`);

  return buildTwiml(
    `<Say language="fr-FR">${escapeXml(announcement)}</Say>` +
    `<Start><Stream url="${escapeXml(streamUrl)}" track="both_tracks"><Parameter name="callId" value="${escapeXml(callId)}" /><Parameter name="companyId" value="${escapeXml(companyId)}" /></Stream></Start>` +
    `<Dial timeout="15" answerOnBridge="true" action="${escapeXml(dialActionUrl)}" method="POST" record="record-from-answer-dual" recordingStatusCallback="${escapeXml(recordingCompleteUrl)}" recordingStatusCallbackMethod="POST">${numberTags}</Dial>`
  );
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

  const rawFrom = String(payload.From || '').trim();
  const callerNumber = rawFrom && !/^(anonymous|private|unknown|restricted)$/i.test(rawFrom) ? rawFrom : null;

  const result = await query(
    `INSERT INTO calls (company_id, call_sid, caller_number, direction, status, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [
      companyId,
      payload.CallSid,
      callerNumber,
      'inbound',
      payload.CallStatus || 'initiated',
      { to: payload.To || null, provider: 'twilio', callerPrivate: !callerNumber },
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
      [callId, summaryText, intent, JSON.stringify([{ type: 'agent_replied', description: "Réponse temps réel générée par l'agent." }])]
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
    transfer_to_human: "Transfert vers un humain demandé ou décidé par l'agent.",
    fallback_to_voicemail: "Retour automatique vers la messagerie de l'offre A.",
    agent_replied: "Réponse temps réel fournie par le réceptionniste IA.",
    agent_needs_clarification: "L'agent a demandé une reformulation au lieu d'escalader immédiatement.",
    agent_closed_call: "L'agent a conclu l'appel après une formule de clôture.",
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
  model?: string;
}) {
  const systemPrompt = [
    `Tu es le réceptionniste téléphonique de ${params.companyName}.`,
    'Réponds en français, avec deux phrases maximum, ton professionnel et utile.',
    'Si le client demande explicitement un humain, un rappel ou un transfert, réponds exactement __TRANSFER__.',
    "Si l'information manque, n'invente pas et ne transfère pas automatiquement : demande une précision en une phrase courte.",
    "N'invente pas : utilise uniquement les informations métier fournies si elles existent.",
    params.knowledgeContext ? `Informations métier disponibles:\n${params.knowledgeContext}` : "Aucune information métier fiable n'est disponible.",
    params.humanTransferNumber ? `Un numéro humain est configuré : ${params.humanTransferNumber}.` : "Aucun numéro humain n'est configuré.",
  ].join('\n\n');

  const response = await generateResponse(
    [{ role: 'user', content: params.callerInput }],
    systemPrompt,
    { model: params.model || undefined }
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
    `SELECT c.id, c.caller_number, c.created_at, c.company_id, co.email AS company_email, co.settings AS company_settings
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
        const aiModelsTelnyx = getAiModelsSettings(call.company_settings || {});
        const transcription = await transcribeAudioUrlWithDiarization(recordingUrl, 'fr', 'agent', aiModelsTelnyx.transcriptionSttModel || undefined);
        const [summary, intentData] = await Promise.all([
          summarizeCall(transcription.text, aiModelsTelnyx.summaryLlmModel || undefined),
          detectIntent(transcription.text, call.company_id, aiModelsTelnyx.intentLlmModel || undefined),
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

// ---------------------------------------------------------------------------
// Offer B streaming call: recording complete callback
// POST /api/webhooks/twilio/streaming-recording
// ---------------------------------------------------------------------------
router.post('/twilio/streaming-recording', async (req: Request, res: Response) => {
  try {
    const callId = String(req.query.callId || '');
    const recordingSid = req.body?.RecordingSid;
    const recordingUrl = req.body?.RecordingUrl;
    const recordingDuration = Number(req.body?.RecordingDuration || 0);
    const recordingStatus = req.body?.RecordingStatus;

    logger.info('Streaming recording callback', { callId, recordingSid, recordingStatus, recordingDuration });

    if (!callId) {
      res.sendStatus(200);
      return;
    }

    // Only process completed recordings
    if (recordingStatus === 'completed' && recordingUrl) {
      const fullUrl = String(recordingUrl).endsWith('.mp3') ? String(recordingUrl) : `${String(recordingUrl)}.mp3`;

      await query(
        `UPDATE calls SET recording_url = $1, duration = COALESCE(NULLIF($2, 0), duration) WHERE id = $3`,
        [fullUrl, recordingDuration, callId]
      );

      await query(
        `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
        [callId, 'twilio.streaming.recording.completed', { recordingUrl: fullUrl, recordingSid, recordingDuration }]
      );

      logger.info('Streaming recording saved', { callId, recordingUrl: fullUrl });
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Streaming recording callback error', { error: error.message });
    res.sendStatus(200);
  }
});

// ---------------------------------------------------------------------------
// Outbound call (agent-first): agent answered → now dial the client
// GET/POST /api/webhooks/twilio/outbound-answer
// ---------------------------------------------------------------------------
router.all('/twilio/outbound-answer', async (req: Request, res: Response) => {
  try {
    const callId = String(req.query.callId || '');
    const destNumber = String(req.query.destNumber || '');
    const companyId = String(req.query.companyId || '');
    const callStatus = String(req.body?.CallStatus || req.query.callStatus || '');

    logger.info('Outbound answer webhook (agent picked up, now dialling client)', { callId, callStatus, destNumber });

    if (!destNumber) {
      res.type('text/xml').send(buildTwiml('<Say language="fr-FR">Une erreur de configuration est survenue.</Say><Hangup />'));
      return;
    }

    if (callId) {
      await query(
        `UPDATE calls SET status = 'answered' WHERE id = $1 AND direction = 'outbound'`,
        [callId]
      ).catch(() => {});

      await query(
        `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
        [callId, 'outbound.agent_answered', { destNumber, callStatus }]
      ).catch(() => {});
    }

    const baseUrl = getBaseUrl(req);
    const recordingCompleteUrl = joinUrl(baseUrl, `/api/webhooks/twilio/outbound-recording?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}`);
    const wsBaseUrl = toWebSocketBaseUrl(baseUrl);
    const streamUrl = joinUrl(wsBaseUrl, `/api/media-streams/outbound?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}`);
    const clientEndUrl = joinUrl(baseUrl, `/api/webhooks/twilio/outbound-client-end?callId=${encodeURIComponent(callId)}&companyId=${encodeURIComponent(companyId)}`);

    // Announce to the agent, then dial the client
    const twiml = buildTwiml(
      `<Say language="fr-FR">Connexion en cours avec le client. Veuillez patienter.</Say>` +
      `<Start><Stream url="${escapeXml(streamUrl)}" track="both_tracks"><Parameter name="callId" value="${escapeXml(callId)}" /><Parameter name="companyId" value="${escapeXml(companyId)}" /></Stream></Start>` +
      `<Dial record="record-from-answer" recordingStatusCallback="${escapeXml(recordingCompleteUrl)}" recordingStatusCallbackMethod="POST" timeout="30" answerOnBridge="true" action="${escapeXml(clientEndUrl)}" method="POST">` +
      `<Number>${escapeXml(destNumber)}</Number></Dial>`
    );
    res.type('text/xml').send(twiml);
  } catch (error: any) {
    logger.error('Outbound answer webhook error', { error: error.message });
    res.type('text/xml').send(buildTwiml('<Hangup />'));
  }
});

// ---------------------------------------------------------------------------
// Outbound call: client-side dial ended (no-answer, busy, completed…)
// POST /api/webhooks/twilio/outbound-client-end
// ---------------------------------------------------------------------------
router.all('/twilio/outbound-client-end', async (req: Request, res: Response) => {
  try {
    const callId = String(req.query.callId || '');
    const dialCallStatus = String(req.body?.DialCallStatus || '');

    logger.info('Outbound client-end', { callId, dialCallStatus });

    if (callId && dialCallStatus !== 'completed') {
      await query(
        `UPDATE calls SET status = 'missed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $1`,
        [callId]
      ).catch(() => {});
      await query(
        `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
        [callId, 'outbound.client_no_answer', { dialCallStatus }]
      ).catch(() => {});
    }

    if (dialCallStatus === 'no-answer' || dialCallStatus === 'busy') {
      res.type('text/xml').send(buildTwiml(
        `<Say language="fr-FR">Le client n'a pas répondu. Au revoir.</Say><Hangup />`
      ));
    } else {
      res.type('text/xml').send(buildTwiml('<Hangup />'));
    }
  } catch (error: any) {
    logger.error('Outbound client-end webhook error', { error: error.message });
    res.type('text/xml').send(buildTwiml('<Hangup />'));
  }
});

// ---------------------------------------------------------------------------
// Outbound call: status callback (ringing, no-answer, completed, etc.)
// POST /api/webhooks/twilio/outbound-status
// ---------------------------------------------------------------------------
router.post('/twilio/outbound-status', async (req: Request, res: Response) => {
  try {
    const callId = String(req.query.callId || '');
    const callStatus = String(req.body?.CallStatus || '');
    const callDuration = parseInt(req.body?.CallDuration || '0', 10);

    logger.info('Outbound status callback', { callId, callStatus, callDuration });

    if (!callId) {
      res.sendStatus(200);
      return;
    }

    const terminalStatuses = ['completed', 'no-answer', 'busy', 'failed', 'canceled'];

    if (callStatus === 'no-answer' || callStatus === 'busy' || callStatus === 'failed') {
      // Agent-first flow: this status refers to the initial call TO THE AGENT.
      // If the agent doesn't answer, simply mark the call as missed — no voicemail on the agent's phone.
      await query(
        `UPDATE calls SET status = 'missed', duration = $1, ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $2`,
        [callDuration, callId]
      );

      await query(
        `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
        [callId, `outbound.agent_${callStatus}`, { callDuration }]
      );

      logger.info('Outbound call missed — agent did not answer', { callId, callStatus });
      res.sendStatus(200);
      return;
    }

    if (terminalStatuses.includes(callStatus)) {
      await query(
        `UPDATE calls SET status = 'completed', duration = COALESCE(NULLIF($1, 0), duration), ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $2 AND direction = 'outbound'`,
        [callDuration, callId]
      );
    }

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Outbound status callback error', { error: error.message });
    res.sendStatus(200);
  }
});

// ---------------------------------------------------------------------------
// Outbound call: recording complete → transcribe + summarize
// POST /api/webhooks/twilio/outbound-recording
// ---------------------------------------------------------------------------
router.post('/twilio/outbound-recording', async (req: Request, res: Response) => {
  try {
    const callId = String(req.query.callId || '');
    const rawRecordingUrl = req.body?.RecordingUrl;
    const recordingDuration = Number(req.body?.RecordingDuration || 0);

    if (!callId || !rawRecordingUrl) {
      res.sendStatus(200);
      return;
    }

    const recordingUrl = String(rawRecordingUrl).endsWith('.mp3') ? String(rawRecordingUrl) : `${String(rawRecordingUrl)}.mp3`;

    await query(
      `UPDATE calls SET recording_url = $1, duration = COALESCE(NULLIF($2, 0), duration), status = CASE WHEN status NOT IN ('missed', 'transferred') THEN 'completed' ELSE status END, ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP) WHERE id = $3`,
      [recordingUrl, recordingDuration, callId]
    );

    await query(
      `INSERT INTO call_events (call_id, event_type, data) VALUES ($1, $2, $3)`,
      [callId, 'outbound.recording.completed', { recordingUrl, recordingDuration }]
    );

    // Wait a bit for the WebSocket to flush final transcript segments
    await new Promise(r => setTimeout(r, 3000));

    setImmediate(async () => {
      try {
        // Check if transcription already exists with structured segments (from WebSocket flush)
        const existingT = await query('SELECT id, text, segments FROM transcriptions WHERE call_id = $1 LIMIT 1', [callId]);
        const callCompanyRow = await query('SELECT company_id FROM calls WHERE id = $1', [callId]);
        const outboundCompanyId: string | undefined = callCompanyRow.rows[0]?.company_id ?? undefined;

        const outboundCompanySettings = outboundCompanyId
          ? await query('SELECT settings FROM companies WHERE id = $1', [outboundCompanyId])
          : null;
        const aiModelsOut = getAiModelsSettings(outboundCompanySettings?.rows[0]?.settings || {});

        let transcriptionText = '';
        let transcriptionSegments: Array<{ role: 'agent' | 'client'; text: string; ts?: number }> | null = null;
        let transcriptionLanguage = 'fr';
        let transcriptionConfidence = 0.9;
        let hasExistingSegments = false;

        if (existingT.rows.length > 0 && existingT.rows[0].segments) {
          // Transcription with segments already exists from WebSocket flush - don't overwrite
          // Note: JSONB columns are auto-parsed by pg into JS objects, handle both cases
          const rawSegments = existingT.rows[0].segments;
          try {
            transcriptionSegments = Array.isArray(rawSegments)
              ? rawSegments
              : JSON.parse(rawSegments);
            if (Array.isArray(transcriptionSegments) && transcriptionSegments.length > 0) {
              hasExistingSegments = true;
              transcriptionText = existingT.rows[0].text || '';
              logger.info('Using existing transcription segments from WebSocket', { callId, segmentsCount: transcriptionSegments.length });
            }
          } catch { /* ignore parse error */ }
        }

        if (!hasExistingSegments) {
          // Check for live transcript with speaker roles
          const callResult = await query('SELECT live_transcript FROM calls WHERE id = $1', [callId]);
          const liveTranscript = callResult.rows[0]?.live_transcript;

          if (liveTranscript) {
            try {
              const segments = JSON.parse(liveTranscript);
              if (Array.isArray(segments) && segments.length > 0 && 'role' in segments[0]) {
                transcriptionSegments = segments;
                transcriptionText = segments
                  .map((seg: { role: string; text: string }) => {
                    const label = seg.role === 'agent' ? 'Agent' : 'Client';
                    return `${label}: ${seg.text}`;
                  })
                  .join('\n\n');
                logger.info('Using structured live transcript with speaker separation', { callId, segmentsCount: segments.length });
              } else {
                // Fallback to diarized recording transcription
                const transcription = await transcribeAudioUrlWithDiarization(recordingUrl, 'fr', 'agent', aiModelsOut.transcriptionSttModel || undefined);
                transcriptionSegments = transcription.segments;
                transcriptionText = transcription.segments
                  ? transcription.segments.map(s => `${s.role === 'agent' ? 'Agent' : 'Client'}: ${s.text}`).join('\n\n')
                  : transcription.text;
                transcriptionLanguage = transcription.language;
                transcriptionConfidence = transcription.confidence;
              }
            } catch {
              const transcription = await transcribeAudioUrlWithDiarization(recordingUrl, 'fr', 'agent', aiModelsOut.transcriptionSttModel || undefined);
              transcriptionSegments = transcription.segments;
              transcriptionText = transcription.segments
                ? transcription.segments.map(s => `${s.role === 'agent' ? 'Agent' : 'Client'}: ${s.text}`).join('\n\n')
                : transcription.text;
              transcriptionLanguage = transcription.language;
              transcriptionConfidence = transcription.confidence;
            }
          } else {
            // No live transcript available, use diarized recording transcription
            const transcription = await transcribeAudioUrlWithDiarization(recordingUrl, 'fr', 'agent', aiModelsOut.transcriptionSttModel || undefined);
            transcriptionSegments = transcription.segments;
            transcriptionText = transcription.segments
              ? transcription.segments.map(s => `${s.role === 'agent' ? 'Agent' : 'Client'}: ${s.text}`).join('\n\n')
              : transcription.text;
            transcriptionLanguage = transcription.language;
            transcriptionConfidence = transcription.confidence;
          }
        }

        // Only insert/update if we don't have existing segments
        if (!hasExistingSegments) {
          if (existingT.rows.length === 0) {
            await query(
              `INSERT INTO transcriptions (call_id, text, language, confidence, segments) VALUES ($1, $2, $3, $4, $5)`,
              [callId, transcriptionText, transcriptionLanguage, transcriptionConfidence, transcriptionSegments ? JSON.stringify(transcriptionSegments) : null]
            );
          } else {
            // Only update segments if we have new ones; never overwrite existing segments with null
            if (transcriptionSegments) {
              await query('UPDATE transcriptions SET text = $1, language = $2, confidence = $3, segments = $4 WHERE id = $5',
                [transcriptionText, transcriptionLanguage, transcriptionConfidence, JSON.stringify(transcriptionSegments), existingT.rows[0].id]);
            } else {
              await query('UPDATE transcriptions SET text = $1, language = $2, confidence = $3 WHERE id = $4',
                [transcriptionText, transcriptionLanguage, transcriptionConfidence, existingT.rows[0].id]);
            }
          }
        }

        const [summary, intentData] = await Promise.all([
          summarizeCall(transcriptionText, aiModelsOut.summaryLlmModel || undefined),
          detectIntent(transcriptionText, outboundCompanyId, aiModelsOut.intentLlmModel || undefined),
        ]);

        const existingS = await query('SELECT id, summary FROM call_summaries WHERE call_id = $1', [callId]);
        if (existingS.rows.length === 0) {
          await query(
            `INSERT INTO call_summaries (call_id, summary, intent, actions) VALUES ($1, $2, $3, $4)`,
            [callId, summary, intentData.intent, JSON.stringify([])]
          );
        } else {
          if (!isUnavailableSummary(summary) || isUnavailableSummary(existingS.rows[0].summary)) {
            await query('UPDATE call_summaries SET summary = $1, intent = $2 WHERE id = $3', [summary, intentData.intent, existingS.rows[0].id]);
          }
        }

        await query('UPDATE calls SET live_summary = $1 WHERE id = $2', [summary, callId]);

        logger.info('Outbound recording transcribed and summarized', { callId });
      } catch (err: any) {
        logger.error('Outbound recording processing error', { callId, error: err.message });
      }
    });

    res.sendStatus(200);
  } catch (error: any) {
    logger.error('Outbound recording webhook error', { error: error.message });
    res.sendStatus(200);
  }
});

export default router;
