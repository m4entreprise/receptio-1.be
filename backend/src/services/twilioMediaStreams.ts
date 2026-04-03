import { IncomingMessage, Server as HttpServer } from 'http';
import axios from 'axios';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { query } from '../config/database';
import { buildKnowledgeBaseContext, getCompanyOfferBSettings } from './offerB';
import { generateResponse, summarizeCall, textToSpeech, transcribeAudioBuffer } from './openai';
import logger from '../utils/logger';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
const OPENAI_REALTIME_ENABLED = process.env.OFFER_B_OPENAI_REALTIME_ENABLED === 'true';
const OPENAI_REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || 'gpt-4o-realtime-preview';
const OPENAI_REALTIME_VOICE = process.env.OPENAI_REALTIME_VOICE || process.env.OPENAI_TTS_VOICE || 'ash';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const STREAMING_ENABLED = process.env.OFFER_B_STREAMING_ENABLED !== 'false';
const SILENCE_THRESHOLD_MS = Number(process.env.OFFER_B_STREAMING_SILENCE_MS || 420);
const MIN_SPEECH_MS = Number(process.env.OFFER_B_STREAMING_MIN_SPEECH_MS || 180);
const BARGE_IN_MIN_SPEECH_MS = Number(process.env.OFFER_B_STREAMING_BARGE_IN_MS || 120);
const ENERGY_THRESHOLD = Number(process.env.OFFER_B_STREAMING_ENERGY_THRESHOLD || 500);
const ULaw_SAMPLE_RATE = 8000;
const ULaw_FRAME_BYTES = 160;
const ULaw_FRAME_DURATION_MS = 20;
const MAX_HISTORY_MESSAGES = 12;

interface StreamSessionState {
  assistantPlaybackUntil: number;
  callId: string;
  callSid: string;
  companyId: string;
  companyName: string;
  fallbackToVoicemail: boolean;
  finalized: boolean;
  greetingSent: boolean;
  initialized: boolean;
  openAiRealtimeSocket: WebSocket | null;
  greetingText: string;
  humanTransferNumber: string;
  knowledgeContext: string;
  lastIntent: string;
  pendingAudioChunks: Buffer[];
  pendingProcessScheduled: boolean;
  playbackGeneration: number;
  processingUtterance: boolean;
  realtimeActive: boolean;
  realtimeAssistantTranscriptBuffer: string;
  realtimeCloseAfterResponse: boolean;
  realtimeGreetingRequested: boolean;
  realtimePendingActionType: string;
  realtimePendingAssistantSource: string;
  realtimeReady: boolean;
  silenceDurationMs: number;
  speechDetected: boolean;
  speechDurationMs: number;
  streamSid: string;
  transcriptMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  twilioStartedAt: number | null;
}

interface TwilioStreamStartEvent {
  event?: string;
  start?: {
    callSid?: string;
    customParameters?: Record<string, string>;
    streamSid?: string;
  };
  streamSid?: string;
}

interface TwilioStreamMediaEvent {
  event?: string;
  media?: {
    payload?: string;
  };
}

interface TwilioStreamStopEvent {
  event?: string;
  stop?: {
    callSid?: string;
  };
  streamSid?: string;
}

export function attachTwilioMediaStreamsServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url || '/', 'http://localhost');

    if (requestUrl.pathname !== '/api/media-streams/twilio') {
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  });

  wss.on('connection', (twilioSocket, request) => {
    void handleTwilioConnection(twilioSocket, request);
  });
}

export function shouldUseOfferBStreamingPipeline(): boolean {
  return STREAMING_ENABLED && Boolean(OPENAI_API_KEY);
}

async function handleTwilioConnection(twilioSocket: WebSocket, request: IncomingMessage) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const callId = String(requestUrl.searchParams.get('callId') || '');
  const companyId = String(requestUrl.searchParams.get('companyId') || '');

  if (!OPENAI_API_KEY) {
    logger.warn('Twilio media stream rejected', { callId, companyId, hasOpenAiKey: Boolean(OPENAI_API_KEY) });
    twilioSocket.close();
    return;
  }

  const state: StreamSessionState = {
    assistantPlaybackUntil: 0,
    callId,
    callSid: '',
    companyId,
    companyName: '',
    fallbackToVoicemail: false,
    finalized: false,
    greetingSent: false,
    initialized: false,
    openAiRealtimeSocket: null,
    greetingText: '',
    humanTransferNumber: '',
    knowledgeContext: '',
    lastIntent: 'autre',
    pendingAudioChunks: [],
    pendingProcessScheduled: false,
    playbackGeneration: 0,
    processingUtterance: false,
    realtimeActive: false,
    realtimeAssistantTranscriptBuffer: '',
    realtimeCloseAfterResponse: false,
    realtimeGreetingRequested: false,
    realtimePendingActionType: 'agent_replied',
    realtimePendingAssistantSource: 'realtime_llm',
    realtimeReady: false,
    silenceDurationMs: 0,
    speechDetected: false,
    speechDurationMs: 0,
    streamSid: '',
    transcriptMessages: [],
    twilioStartedAt: null,
  };

  twilioSocket.on('message', (data) => {
    void handleTwilioMessage(data, twilioSocket, state);
  });

  twilioSocket.on('close', async () => {
    closeOpenAiRealtimeSocket(state);
    await finalizeStreamingCall(state, 'twilio_socket_closed');
  });

  twilioSocket.on('error', async (error) => {
    logger.error('Twilio media stream socket error', { error: error.message, callId: state.callId, companyId: state.companyId });
    closeOpenAiRealtimeSocket(state);
    await finalizeStreamingCall(state, 'twilio_socket_error');
  });

  if (callId && companyId) {
    try {
      await initializeStreamingSession(state, callId, companyId);
    } catch (error: any) {
      logger.error('Twilio media stream setup error', { error: error.message, callId, companyId });
      twilioSocket.close();
    }
  }
}

async function handleTwilioMessage(
  data: RawData,
  twilioSocket: WebSocket,
  state: StreamSessionState
) {
  const payload = parseSocketMessage(data);

  if (!payload || typeof payload !== 'object') {
    return;
  }

  const eventType = String((payload as { event?: string }).event || '');

  switch (eventType) {
    case 'start': {
      const startEvent = payload as TwilioStreamStartEvent;
      const customParameters = startEvent.start?.customParameters || {};
      const resolvedCallId = state.callId || String(customParameters.callId || '');
      const resolvedCompanyId = state.companyId || String(customParameters.companyId || '');

      if (!state.initialized) {
        if (!resolvedCallId || !resolvedCompanyId) {
          logger.warn('Twilio media stream rejected', {
            callId: resolvedCallId,
            companyId: resolvedCompanyId,
            hasOpenAiKey: Boolean(OPENAI_API_KEY),
          });
          twilioSocket.close();
          return;
        }

        try {
          await initializeStreamingSession(state, resolvedCallId, resolvedCompanyId);
        } catch (error: any) {
          logger.error('Twilio media stream setup error', {
            error: error.message,
            callId: resolvedCallId,
            companyId: resolvedCompanyId,
          });
          twilioSocket.close();
          return;
        }
      }

      state.streamSid = startEvent.start?.streamSid || startEvent.streamSid || '';
      state.callSid = startEvent.start?.callSid || state.callSid;
      state.twilioStartedAt = Date.now();

      await appendCallEvent(state.callId, 'twilio.media_stream.started', {
        callSid: state.callSid,
        streamSid: state.streamSid,
      });

      if (OPENAI_REALTIME_ENABLED) {
        await initializeOpenAiRealtimeBridge(twilioSocket, state);
      }

      if (!state.greetingSent && !state.realtimeActive) {
        state.greetingSent = true;
        void speakAssistantText(twilioSocket, state, state.greetingText, {
          actionType: 'agent_replied',
          closeAfterPlayback: false,
          persistTranscript: true,
          source: 'streaming_greeting',
        }).catch((error: any) => {
          logger.error('Twilio streaming greeting playback failed', {
            error: error.message,
            callId: state.callId,
            companyId: state.companyId,
          });
        });
      }
      break;
    }
    case 'media': {
      if (!state.initialized) {
        return;
      }

      const mediaEvent = payload as TwilioStreamMediaEvent;
      const audioPayload = String(mediaEvent.media?.payload || '');

      if (!audioPayload) {
        return;
      }

      const audioBuffer = Buffer.from(audioPayload, 'base64');

      if (audioBuffer.length === 0) {
        return;
      }

      if (state.realtimeActive && state.openAiRealtimeSocket?.readyState === WebSocket.OPEN) {
        sendOpenAiRealtimeEvent(state, {
          type: 'input_audio_buffer.append',
          audio: audioPayload,
        });
        return;
      }

      const frameEnergy = computeULawFrameEnergy(audioBuffer);
      const hasSpeech = frameEnergy >= ENERGY_THRESHOLD;

      if (hasSpeech) {
        state.speechDetected = true;
        state.speechDurationMs += ULaw_FRAME_DURATION_MS;
        state.silenceDurationMs = 0;

        if (
          state.assistantPlaybackUntil > Date.now()
          && state.speechDurationMs >= BARGE_IN_MIN_SPEECH_MS
          && state.streamSid
          && twilioSocket.readyState === WebSocket.OPEN
        ) {
          state.playbackGeneration += 1;
          state.assistantPlaybackUntil = 0;
          twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: state.streamSid }));
        }

        state.pendingAudioChunks.push(audioBuffer);
        return;
      }

      if (!state.speechDetected) {
        return;
      }

      state.pendingAudioChunks.push(audioBuffer);
      state.silenceDurationMs += ULaw_FRAME_DURATION_MS;

      if (
        state.silenceDurationMs >= SILENCE_THRESHOLD_MS
        && state.speechDurationMs >= MIN_SPEECH_MS
        && !state.pendingProcessScheduled
      ) {
        state.pendingProcessScheduled = true;
        void processBufferedUtterance(twilioSocket, state);
      }
      break;
    }
    case 'stop': {
      if (!state.initialized || !state.callId) {
        if (twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.close();
        }
        break;
      }

      const stopEvent = payload as TwilioStreamStopEvent;
      await appendCallEvent(state.callId, 'twilio.media_stream.stopped', {
        callSid: stopEvent.stop?.callSid || state.callSid,
        streamSid: stopEvent.streamSid || state.streamSid,
      });
      closeOpenAiRealtimeSocket(state);
      await finalizeStreamingCall(state, 'twilio_stop_event');
      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.close();
      }
      break;
    }
    default:
      break;
  }
}

async function initializeStreamingSession(state: StreamSessionState, callId: string, companyId: string) {
  const [callContext, offerBSettings] = await Promise.all([
    getStreamingCallContext(callId, companyId),
    getCompanyOfferBSettings(companyId),
  ]);

  if (!callContext) {
    logger.warn('Twilio media stream call context missing', { callId, companyId });
    throw new Error('Streaming call context missing');
  }

  const knowledgeContext = offerBSettings.knowledgeBaseEnabled
    ? await buildKnowledgeBaseContext(companyId)
    : '';

  await ensureConversationExists(callId);
  await ensureCallSummaryExists(callId);
  await appendCallEvent(callId, 'twilio.media_stream.connection_opened', {
    companyId,
    provider: 'twilio',
    mode: OPENAI_REALTIME_ENABLED ? 'openai_realtime' : 'stt_llm_tts',
  });

  state.callId = callId;
  state.callSid = callContext.callSid;
  state.companyId = companyId;
  state.companyName = callContext.companyName;
  state.fallbackToVoicemail = offerBSettings.fallbackToVoicemail;
  state.greetingText = offerBSettings.greetingText || `Bonjour, vous êtes bien chez ${callContext.companyName}. Comment puis-je vous aider aujourd’hui ?`;
  state.humanTransferNumber = offerBSettings.humanTransferNumber;
  state.knowledgeContext = knowledgeContext;
  state.initialized = true;
}

async function initializeOpenAiRealtimeBridge(twilioSocket: WebSocket, state: StreamSessionState): Promise<boolean> {
  if (!OPENAI_REALTIME_ENABLED || !OPENAI_API_KEY) {
    return false;
  }

  if (state.openAiRealtimeSocket && state.openAiRealtimeSocket.readyState === WebSocket.OPEN) {
    state.realtimeActive = true;
    return true;
  }

  const realtimeSocket = new WebSocket(`wss://api.openai.com/v1/realtime?model=${encodeURIComponent(OPENAI_REALTIME_MODEL)}`, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'OpenAI-Beta': 'realtime=v1',
    },
  });

  state.openAiRealtimeSocket = realtimeSocket;

  return await new Promise<boolean>((resolve) => {
    let settled = false;

    const finish = (result: boolean) => {
      if (settled) {
        return;
      }

      settled = true;
      resolve(result);
    };

    const timeout = setTimeout(() => {
      logger.warn('OpenAI realtime initialization timed out', {
        callId: state.callId,
        companyId: state.companyId,
      });
      closeOpenAiRealtimeSocket(state);
      finish(false);
    }, 4000);

    realtimeSocket.on('open', () => {
      state.realtimeActive = true;

      sendOpenAiRealtimeEvent(state, {
        type: 'session.update',
        session: {
          modalities: ['audio', 'text'],
          instructions: buildRealtimeInstructions(state),
          voice: OPENAI_REALTIME_VOICE,
          input_audio_format: 'g711_ulaw',
          output_audio_format: 'g711_ulaw',
          input_audio_transcription: {
            model: OPENAI_STT_MODEL,
          },
          turn_detection: {
            type: 'server_vad',
            interrupt_response: true,
            create_response: false,
            prefix_padding_ms: 240,
            silence_duration_ms: SILENCE_THRESHOLD_MS,
          },
          temperature: 0.4,
        },
      });
    });

    realtimeSocket.on('message', (rawData) => {
      void handleOpenAiRealtimeMessage(rawData, twilioSocket, state, finish, timeout);
    });

    realtimeSocket.on('close', () => {
      clearTimeout(timeout);
      state.realtimeActive = false;
      state.realtimeReady = false;
      state.openAiRealtimeSocket = null;
      finish(false);
    });

    realtimeSocket.on('error', (error) => {
      logger.error('OpenAI realtime socket error', {
        error: error.message,
        callId: state.callId,
        companyId: state.companyId,
      });
      clearTimeout(timeout);
      closeOpenAiRealtimeSocket(state);
      finish(false);
    });
  });
}

async function handleOpenAiRealtimeMessage(
  rawData: RawData,
  twilioSocket: WebSocket,
  state: StreamSessionState,
  finishInitialization: (result: boolean) => void,
  initializationTimeout: NodeJS.Timeout
) {
  const payload = parseSocketMessage(rawData) as { [key: string]: any } | null;

  if (!payload || typeof payload !== 'object') {
    return;
  }

  const eventType = String(payload.type || '');

  switch (eventType) {
    case 'session.updated': {
      clearTimeout(initializationTimeout);
      state.realtimeReady = true;
      finishInitialization(true);

      if (!state.realtimeGreetingRequested && !state.greetingSent) {
        state.greetingSent = true;
        state.realtimeGreetingRequested = true;
        requestOpenAiRealtimeResponse(state, {
          actionType: 'agent_replied',
          closeAfterPlayback: false,
          instructions: `Commence l'appel maintenant en disant exactement : ${state.greetingText}`,
          source: 'realtime_greeting',
        });
      }
      break;
    }
    case 'input_audio_buffer.speech_started': {
      state.playbackGeneration += 1;
      state.assistantPlaybackUntil = 0;

      if (state.streamSid && twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: state.streamSid }));
      }

      sendOpenAiRealtimeEvent(state, { type: 'response.cancel' });
      break;
    }
    case 'conversation.item.input_audio_transcription.completed': {
      const callerText = normalizeCallerText(String(payload.transcript || ''));

      if (!callerText) {
        break;
      }

      await appendTranscriptLine(state.callId, 'Client', callerText);
      state.transcriptMessages.push({ role: 'user', content: callerText });
      trimConversationHistory(state);

      const detectedIntent = detectStreamingIntent(callerText);
      state.lastIntent = detectedIntent.summaryIntent;

      if (detectedIntent.kind === 'human_transfer' && state.humanTransferNumber) {
        await appendOfferBAction(state.callId, 'transfer_to_human', {
          input: callerText,
          transferNumber: state.humanTransferNumber,
          source: 'realtime_user_request',
        });
        await redirectTwilioCall(state.callSid, buildTransferTwiml(state.humanTransferNumber));
        closeOpenAiRealtimeSocket(state);
        await finalizeStreamingCall(state, 'human_transfer_requested');

        if (twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.close();
        }
        break;
      }

      if (detectedIntent.kind === 'goodbye') {
        sendOpenAiRealtimeEvent(state, { type: 'response.cancel' });
        requestOpenAiRealtimeResponse(state, {
          actionType: 'agent_closed_call',
          closeAfterPlayback: true,
          instructions: 'Réponds exactement : Merci, au revoir et bonne journée.',
          source: 'realtime_goodbye',
        });
        break;
      }

      if (detectedIntent.kind === 'greeting') {
        requestOpenAiRealtimeResponse(state, {
          actionType: 'agent_replied',
          closeAfterPlayback: false,
          instructions: `Réponds brièvement avec cette idée : Bonjour, je suis le réceptionniste de ${state.companyName}. Comment puis-je vous aider ?`,
          source: 'realtime_greeting_followup',
        });
        break;
      }

      requestOpenAiRealtimeResponse(state, {
        actionType: 'agent_replied',
        closeAfterPlayback: false,
        source: 'realtime_llm',
      });
      break;
    }
    case 'response.audio.delta': {
      const audioDelta = String(payload.delta || '');

      if (!audioDelta || !state.streamSid || twilioSocket.readyState !== WebSocket.OPEN) {
        break;
      }

      state.assistantPlaybackUntil = Date.now() + 400;
      twilioSocket.send(JSON.stringify({
        event: 'media',
        streamSid: state.streamSid,
        media: {
          payload: audioDelta,
        },
      }));
      break;
    }
    case 'response.audio_transcript.delta': {
      state.realtimeAssistantTranscriptBuffer += String(payload.delta || '');
      break;
    }
    case 'response.audio_transcript.done': {
      const assistantText = normalizeCallerText(String(payload.transcript || state.realtimeAssistantTranscriptBuffer || ''));
      state.realtimeAssistantTranscriptBuffer = '';

      if (!assistantText) {
        break;
      }

      await appendTranscriptLine(state.callId, 'IA', assistantText);
      state.transcriptMessages.push({ role: 'assistant', content: assistantText });
      trimConversationHistory(state);
      await appendOfferBAction(state.callId, state.realtimePendingActionType, {
        source: state.realtimePendingAssistantSource,
        transcript: assistantText,
      });
      break;
    }
    case 'response.done': {
      state.assistantPlaybackUntil = 0;

      if (state.realtimeCloseAfterResponse) {
        state.realtimeCloseAfterResponse = false;
        closeOpenAiRealtimeSocket(state);
        await finalizeStreamingCall(state, 'goodbye_completed');

        if (twilioSocket.readyState === WebSocket.OPEN) {
          twilioSocket.close();
        }
      }
      break;
    }
    case 'error': {
      logger.error('OpenAI realtime event error', {
        callId: state.callId,
        companyId: state.companyId,
        error: payload.error?.message || 'Unknown realtime error',
      });
      break;
    }
    default:
      break;
  }
}

async function processBufferedUtterance(twilioSocket: WebSocket, state: StreamSessionState) {
  if (state.processingUtterance || state.pendingAudioChunks.length === 0) {
    state.pendingProcessScheduled = false;
    return;
  }

  const utteranceBuffer = Buffer.concat(state.pendingAudioChunks);
  state.pendingAudioChunks = [];
  state.pendingProcessScheduled = false;
  state.processingUtterance = true;
  state.silenceDurationMs = 0;
  state.speechDurationMs = 0;
  state.speechDetected = false;

  try {
    const pcmBuffer = decodeULawToPcm16(utteranceBuffer);
    const wavBuffer = wrapPcm16AsWav(pcmBuffer, ULaw_SAMPLE_RATE, 1);
    const transcription = await transcribeAudioBuffer(wavBuffer, {
      fileName: 'twilio-stream.wav',
      language: 'fr',
      mimeType: 'audio/wav',
    });
    const callerText = normalizeCallerText(transcription.text);

    if (!callerText) {
      return;
    }

    await appendTranscriptLine(state.callId, 'Client', callerText);
    state.transcriptMessages.push({ role: 'user', content: callerText });
    trimConversationHistory(state);

    const detectedIntent = detectStreamingIntent(callerText);
    state.lastIntent = detectedIntent.summaryIntent;

    if (detectedIntent.kind === 'human_transfer' && state.humanTransferNumber) {
      await appendOfferBAction(state.callId, 'transfer_to_human', {
        input: callerText,
        transferNumber: state.humanTransferNumber,
        source: 'streaming_user_request',
      });
      await redirectTwilioCall(state.callSid, buildTransferTwiml(state.humanTransferNumber));
      await finalizeStreamingCall(state, 'human_transfer_requested');
      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.close();
      }
      return;
    }

    if (detectedIntent.kind === 'goodbye') {
      await speakAssistantText(twilioSocket, state, 'Merci, au revoir et bonne journée.', {
        actionType: 'agent_closed_call',
        closeAfterPlayback: true,
        persistTranscript: true,
        source: 'streaming_goodbye',
      });
      return;
    }

    if (detectedIntent.kind === 'greeting') {
      await speakAssistantText(twilioSocket, state, `Bonjour, je suis le réceptionniste de ${state.companyName}. Comment puis-je vous aider ?`, {
        actionType: 'agent_replied',
        closeAfterPlayback: false,
        persistTranscript: true,
        source: 'streaming_greeting_followup',
      });
      return;
    }

    const agentReply = await generateStreamingReply(state, callerText);

    if (agentReply === '__TRANSFER__' && state.humanTransferNumber) {
      await appendOfferBAction(state.callId, 'transfer_to_human', {
        input: callerText,
        transferNumber: state.humanTransferNumber,
        source: 'streaming_agent_decision',
      });
      await redirectTwilioCall(state.callSid, buildTransferTwiml(state.humanTransferNumber));
      await finalizeStreamingCall(state, 'agent_transfer_requested');
      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.close();
      }
      return;
    }

    const responseText = agentReply === '__TRANSFER__'
      ? 'Je n’ai pas assez d’informations pour répondre précisément. Pouvez-vous reformuler votre demande ?'
      : agentReply;

    await speakAssistantText(twilioSocket, state, responseText, {
      actionType: 'agent_replied',
      closeAfterPlayback: false,
      persistTranscript: true,
      source: 'streaming_llm',
    });
  } catch (error: any) {
    logger.error('Offer B STT-LLM-TTS pipeline error', { error: error.message, callId: state.callId });

    if (twilioSocket.readyState === WebSocket.OPEN) {
      await speakAssistantText(twilioSocket, state, 'Je rencontre un problème technique. Pouvez-vous répéter votre demande ?', {
        actionType: 'agent_needs_clarification',
        closeAfterPlayback: false,
        persistTranscript: true,
        source: 'streaming_error',
      });
    }
  } finally {
    state.processingUtterance = false;

    if (
      state.pendingAudioChunks.length > 0
      && state.speechDetected
      && state.silenceDurationMs >= SILENCE_THRESHOLD_MS
      && !state.pendingProcessScheduled
    ) {
      state.pendingProcessScheduled = true;
      void processBufferedUtterance(twilioSocket, state);
    }
  }
}

async function generateStreamingReply(state: StreamSessionState, callerText: string): Promise<string> {
  const systemPrompt = buildStreamingSystemPrompt(state);

  const messages = [
    ...state.transcriptMessages,
    { role: 'user', content: callerText },
  ].map((message) => ({ role: message.role, content: message.content }));

  const response = await generateResponse(messages, systemPrompt);
  return response.trim();
}

async function speakAssistantText(
  twilioSocket: WebSocket,
  state: StreamSessionState,
  text: string,
  options: {
    actionType: string;
    closeAfterPlayback: boolean;
    persistTranscript: boolean;
    source: string;
  }
) {
  const cleanText = text.trim();

  if (!cleanText || !state.streamSid || twilioSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  try {
    if (options.persistTranscript) {
      await appendTranscriptLine(state.callId, 'IA', cleanText);
    }

    state.transcriptMessages.push({ role: 'assistant', content: cleanText });
    trimConversationHistory(state);

    await appendOfferBAction(state.callId, options.actionType, {
      source: options.source,
      transcript: cleanText,
    });

    const wavAudio = await textToSpeech(cleanText, 'wav');
    const ulawAudio = convertWavToULaw(wavAudio);
    const audioDurationMs = calculateAudioDurationMs(ulawAudio);
    const playbackGeneration = ++state.playbackGeneration;
    state.assistantPlaybackUntil = Date.now() + audioDurationMs + 120;
    await sendULawAudioToTwilio(twilioSocket, state.streamSid, ulawAudio, () => playbackGeneration === state.playbackGeneration);

    if (playbackGeneration === state.playbackGeneration && state.assistantPlaybackUntil < Date.now()) {
      state.assistantPlaybackUntil = 0;
    }

    if (options.closeAfterPlayback) {
      await wait(audioDurationMs + 250);
      await finalizeStreamingCall(state, 'goodbye_completed');

      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.close();
      }
    }
  } catch (error: any) {
    logger.error('Twilio assistant playback error', {
      error: error.message,
      callId: state.callId,
      companyId: state.companyId,
      source: options.source,
    });
    throw error;
  }
}

function buildStreamingSystemPrompt(state: StreamSessionState): string {
  return [
    `Tu es le réceptionniste téléphonique de ${state.companyName}.`,
    'Réponds en français, en deux phrases maximum, de manière utile et concise.',
    'Si le client demande explicitement un humain, un rappel ou un transfert, réponds exactement __TRANSFER__.',
    'Si une information manque, n’invente pas et pose une seule question courte de clarification.',
    state.knowledgeContext ? `Informations métier disponibles:\n${state.knowledgeContext}` : 'Aucune information métier fiable n’est disponible.',
    state.humanTransferNumber ? `Numéro humain disponible : ${state.humanTransferNumber}.` : 'Aucun numéro humain n’est configuré.',
  ].join('\n\n');
}

function buildRealtimeInstructions(state: StreamSessionState): string {
  return [
    `Tu es le réceptionniste téléphonique en temps réel de ${state.companyName}.`,
    'Réponds toujours en français avec des phrases courtes, naturelles et utiles.',
    'Ne dépasse pas deux phrases sauf nécessité absolue.',
    'Si une information manque, dis-le franchement et pose une seule question courte.',
    'Quand le client demande un humain, annonce brièvement que tu le transfères ; le backend gère techniquement le transfert.',
    'Évite les listes et les formulations trop longues car la réponse est lue à voix haute au téléphone.',
    state.knowledgeContext ? `Informations métier disponibles :\n${state.knowledgeContext}` : 'Aucune information métier fiable n’est disponible.',
    state.humanTransferNumber ? `Numéro humain disponible : ${state.humanTransferNumber}.` : 'Aucun numéro humain n’est configuré.',
  ].join('\n\n');
}

function requestOpenAiRealtimeResponse(
  state: StreamSessionState,
  options: {
    actionType: string;
    closeAfterPlayback: boolean;
    instructions?: string;
    source: string;
  }
): boolean {
  if (!state.openAiRealtimeSocket || state.openAiRealtimeSocket.readyState !== WebSocket.OPEN) {
    return false;
  }

  state.realtimeAssistantTranscriptBuffer = '';
  state.realtimeCloseAfterResponse = options.closeAfterPlayback;
  state.realtimePendingActionType = options.actionType;
  state.realtimePendingAssistantSource = options.source;

  const response: Record<string, unknown> = {
    modalities: ['audio', 'text'],
  };

  if (options.instructions) {
    response.instructions = options.instructions;
  }

  sendOpenAiRealtimeEvent(state, {
    type: 'response.create',
    response,
  });

  return true;
}

function sendOpenAiRealtimeEvent(state: StreamSessionState, payload: Record<string, unknown>) {
  if (!state.openAiRealtimeSocket || state.openAiRealtimeSocket.readyState !== WebSocket.OPEN) {
    return;
  }

  state.openAiRealtimeSocket.send(JSON.stringify(payload));
}

function closeOpenAiRealtimeSocket(state: StreamSessionState) {
  const realtimeSocket = state.openAiRealtimeSocket;
  state.openAiRealtimeSocket = null;
  state.realtimeActive = false;
  state.realtimeAssistantTranscriptBuffer = '';
  state.realtimeCloseAfterResponse = false;
  state.realtimeReady = false;

  if (!realtimeSocket) {
    return;
  }

  if (realtimeSocket.readyState === WebSocket.OPEN || realtimeSocket.readyState === WebSocket.CONNECTING) {
    realtimeSocket.close();
  }
}

function parseSocketMessage(data: RawData): unknown {
  try {
    return JSON.parse(data.toString());
  } catch (error: any) {
    logger.warn('Unable to parse socket message', { error: error.message });
    return null;
  }
}

async function getStreamingCallContext(callId: string, companyId: string): Promise<{ callSid: string; companyName: string } | null> {
  const result = await query(
    `SELECT c.call_sid, co.name AS company_name
     FROM calls c
     INNER JOIN companies co ON co.id = c.company_id
     WHERE c.id = $1 AND c.company_id = $2`,
    [callId, companyId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    callSid: result.rows[0].call_sid,
    companyName: result.rows[0].company_name,
  };
}

async function ensureConversationExists(callId: string) {
  const existingConversation = await query(
    'SELECT id FROM conversations WHERE call_id = $1',
    [callId]
  );

  if (existingConversation.rows.length > 0) {
    return;
  }

  await query(
    `INSERT INTO conversations (call_id, state, context, messages)
     VALUES ($1, $2, $3, $4)`,
    [callId, 'active', JSON.stringify({ mode: 'streaming_stt_llm_tts' }), JSON.stringify([])]
  );
}

async function ensureCallSummaryExists(callId: string) {
  const summaryResult = await query(
    'SELECT id FROM call_summaries WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
    [callId]
  );

  if (summaryResult.rows.length > 0) {
    return;
  }

  await query(
    `INSERT INTO call_summaries (call_id, summary, intent, actions)
     VALUES ($1, $2, $3, $4)`,
    [callId, 'Résumé en attente de clôture de l’appel.', 'autre', JSON.stringify([])]
  );
}

async function appendTranscriptLine(callId: string, speaker: 'Client' | 'IA', text: string) {
  const transcript = `${speaker}: ${text.trim()}`;
  const transcriptionResult = await query(
    'SELECT id, text FROM transcriptions WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
    [callId]
  );

  if (transcriptionResult.rows.length === 0) {
    await query(
      `INSERT INTO transcriptions (call_id, text, language, confidence)
       VALUES ($1, $2, $3, $4)`,
      [callId, transcript, 'fr', 1]
    );
    return;
  }

  const existingText = String(transcriptionResult.rows[0].text || '');
  const nextText = existingText ? `${existingText}\n${transcript}` : transcript;

  await query(
    'UPDATE transcriptions SET text = $1 WHERE id = $2',
    [nextText, transcriptionResult.rows[0].id]
  );
}

async function appendOfferBAction(callId: string, eventType: string, data: Record<string, unknown>) {
  await appendCallEvent(callId, eventType, data);

  const actionDescriptions: Record<string, string> = {
    agent_replied: 'Réponse fournie par le réceptionniste IA via pipeline streaming STT-LLM-TTS.',
    agent_closed_call: 'L’agent a conclu l’appel à la fin de la conversation.',
    agent_needs_clarification: 'L’agent a demandé une reformulation après un problème de traitement.',
    transfer_to_human: 'Transfert vers un humain demandé ou décidé pendant le streaming.',
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

async function appendCallEvent(callId: string, eventType: string, data: Record<string, unknown>) {
  await query(
    `INSERT INTO call_events (call_id, event_type, data)
     VALUES ($1, $2, $3)`,
    [callId, eventType, data]
  );
}

async function finalizeStreamingCall(state: StreamSessionState, reason: string) {
  if (state.finalized || !state.callId) {
    return;
  }

  state.finalized = true;

  const durationSeconds = state.twilioStartedAt
    ? Math.max(1, Math.round((Date.now() - state.twilioStartedAt) / 1000))
    : 0;

  await query(
    `UPDATE calls
     SET status = $1,
         duration = GREATEST(COALESCE(duration, 0), $2),
         ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP)
     WHERE id = $3`,
    ['completed', durationSeconds, state.callId]
  );

  await persistFinalSummary(state.callId, state.lastIntent);
  await appendCallEvent(state.callId, 'twilio.media_stream.finalized', {
    durationSeconds,
    reason,
  });
}

async function persistFinalSummary(callId: string, intent: string) {
  const [summaryResult, transcriptionResult] = await Promise.all([
    query('SELECT id, actions FROM call_summaries WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1', [callId]),
    query('SELECT text FROM transcriptions WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1', [callId]),
  ]);

  const transcriptionText = String(transcriptionResult.rows[0]?.text || '').trim();
  const summary = await summarizeCall(transcriptionText);

  if (summaryResult.rows.length === 0) {
    await query(
      `INSERT INTO call_summaries (call_id, summary, intent, actions)
       VALUES ($1, $2, $3, $4)`,
      [callId, summary, intent, JSON.stringify([])]
    );
    return;
  }

  await query(
    'UPDATE call_summaries SET summary = $1, intent = $2 WHERE id = $3',
    [summary, intent, summaryResult.rows[0].id]
  );
}

async function redirectTwilioCall(callSid: string, twiml: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !callSid) {
    logger.warn('Twilio transfer skipped because configuration is incomplete', { callSid, hasSid: Boolean(TWILIO_ACCOUNT_SID) });
    return;
  }

  const body = new URLSearchParams({ Twiml: twiml });

  await axios.post(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Calls/${callSid}.json`,
    body.toString(),
    {
      auth: {
        username: TWILIO_ACCOUNT_SID,
        password: TWILIO_AUTH_TOKEN,
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );
}

async function sendULawAudioToTwilio(
  twilioSocket: WebSocket,
  streamSid: string,
  ulawBuffer: Buffer,
  shouldContinue: () => boolean
) {
  for (let offset = 0; offset < ulawBuffer.length; offset += ULaw_FRAME_BYTES) {
    if (twilioSocket.readyState !== WebSocket.OPEN || !shouldContinue()) {
      return;
    }

    const chunk = ulawBuffer.subarray(offset, Math.min(offset + ULaw_FRAME_BYTES, ulawBuffer.length));
    const paddedChunk = chunk.length === ULaw_FRAME_BYTES
      ? chunk
      : Buffer.concat([chunk, Buffer.alloc(ULaw_FRAME_BYTES - chunk.length, 0xff)]);
    twilioSocket.send(
      JSON.stringify({
        event: 'media',
        streamSid,
        media: {
          payload: paddedChunk.toString('base64'),
        },
      })
    );

    await wait(ULaw_FRAME_DURATION_MS);
  }
}

function normalizeCallerText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function trimConversationHistory(state: StreamSessionState) {
  if (state.transcriptMessages.length <= MAX_HISTORY_MESSAGES) {
    return;
  }

  state.transcriptMessages = state.transcriptMessages.slice(-MAX_HISTORY_MESSAGES);
}

function detectStreamingIntent(text: string): { kind: 'greeting' | 'goodbye' | 'human_transfer' | 'info' | 'other'; summaryIntent: string } {
  const normalizedText = normalizeText(text);

  if (/^(salut|bonjour|bonsoir|allo|hello)[ !?.]*$/.test(normalizedText)) {
    return { kind: 'greeting', summaryIntent: 'autre' };
  }

  if (/(au revoir|a bientot|a plus|merci au revoir|bonne journee|bye)/.test(normalizedText)) {
    return { kind: 'goodbye', summaryIntent: 'autre' };
  }

  if (/(humain|personne|conseiller|rappel|rappeler|transfer|transfert|collegue)/.test(normalizedText)) {
    return { kind: 'human_transfer', summaryIntent: 'autre' };
  }

  if (/(horaire|heure|ouvert|ouverture|ferme|adresse|service|prix|tarif|information|infos|rdv|rendez vous|rendez-vous)/.test(normalizedText)) {
    return { kind: 'info', summaryIntent: 'info' };
  }

  return { kind: 'other', summaryIntent: 'autre' };
}

function computeULawFrameEnergy(ulawBuffer: Buffer): number {
  if (ulawBuffer.length === 0) {
    return 0;
  }

  let sum = 0;

  for (const byte of ulawBuffer) {
    sum += Math.abs(decodeULawSample(byte));
  }

  return Math.round(sum / ulawBuffer.length);
}

function decodeULawToPcm16(ulawBuffer: Buffer): Buffer {
  const pcmBuffer = Buffer.alloc(ulawBuffer.length * 2);

  for (let index = 0; index < ulawBuffer.length; index += 1) {
    pcmBuffer.writeInt16LE(decodeULawSample(ulawBuffer[index]), index * 2);
  }

  return pcmBuffer;
}

function wrapPcm16AsWav(pcmBuffer: Buffer, sampleRate: number, channels: number): Buffer {
  const header = Buffer.alloc(44);
  const byteRate = sampleRate * channels * 2;
  const blockAlign = channels * 2;

  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);

  return Buffer.concat([header, pcmBuffer]);
}

function convertWavToULaw(wavBuffer: Buffer): Buffer {
  const parsed = parseWavPcm16(wavBuffer);
  const monoSamples = parsed.channels === 1
    ? parsed.samples
    : extractFirstChannel(parsed.samples, parsed.channels);
  const resampled = parsed.sampleRate === ULaw_SAMPLE_RATE
    ? monoSamples
    : resamplePcm16(monoSamples, parsed.sampleRate, ULaw_SAMPLE_RATE);

  return encodePcm16ToULaw(resampled);
}

function parseWavPcm16(wavBuffer: Buffer): { channels: number; sampleRate: number; samples: Int16Array } {
  if (wavBuffer.length < 44 || wavBuffer.subarray(0, 4).toString('ascii') !== 'RIFF' || wavBuffer.subarray(8, 12).toString('ascii') !== 'WAVE') {
    throw new Error('Invalid WAV buffer for Twilio streaming conversion');
  }

  let fmtChunkOffset = -1;
  let fmtChunkLength = 0;
  let dataChunkOffset = -1;
  let dataChunkLength = 0;
  let cursor = 12;

  while (cursor + 8 <= wavBuffer.length) {
    const chunkId = wavBuffer.subarray(cursor, cursor + 4).toString('ascii');
    const chunkSize = wavBuffer.readUInt32LE(cursor + 4);
    const chunkDataOffset = cursor + 8;

    if (chunkId === 'fmt ') {
      fmtChunkOffset = chunkDataOffset;
      fmtChunkLength = chunkSize;
    } else if (chunkId === 'data') {
      dataChunkOffset = chunkDataOffset;
      dataChunkLength = chunkSize;
      break;
    }

    cursor = chunkDataOffset + chunkSize + (chunkSize % 2);
  }

  if (fmtChunkOffset === -1 || fmtChunkLength < 16) {
    throw new Error('Invalid WAV buffer: fmt chunk not found');
  }

  if (dataChunkOffset === -1 || dataChunkLength <= 0) {
    throw new Error('Invalid WAV buffer: data chunk not found');
  }

  const audioFormat = wavBuffer.readUInt16LE(fmtChunkOffset);
  const channels = wavBuffer.readUInt16LE(fmtChunkOffset + 2);
  const sampleRate = wavBuffer.readUInt32LE(fmtChunkOffset + 4);
  const bitsPerSample = wavBuffer.readUInt16LE(fmtChunkOffset + 14);

  if (audioFormat !== 1 || bitsPerSample !== 16) {
    throw new Error(`Unsupported WAV format for Twilio streaming conversion: format=${audioFormat}, bits=${bitsPerSample}`);
  }

  const availableDataLength = Math.min(dataChunkLength, wavBuffer.length - dataChunkOffset);
  const sampleCount = Math.floor(availableDataLength / 2);
  const samples = new Int16Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    samples[index] = wavBuffer.readInt16LE(dataChunkOffset + (index * 2));
  }

  return { channels, sampleRate, samples };
}

function extractFirstChannel(samples: Int16Array, channels: number): Int16Array {
  const mono = new Int16Array(Math.floor(samples.length / channels));

  for (let index = 0; index < mono.length; index += 1) {
    mono[index] = samples[index * channels];
  }

  return mono;
}

function resamplePcm16(samples: Int16Array, inputRate: number, outputRate: number): Int16Array {
  if (inputRate === outputRate) {
    return samples;
  }

  const outputLength = Math.max(1, Math.round(samples.length * outputRate / inputRate));
  const output = new Int16Array(outputLength);

  if (inputRate > outputRate) {
    for (let index = 0; index < outputLength; index += 1) {
      const sourceStart = Math.floor(index * inputRate / outputRate);
      const sourceEnd = Math.min(
        samples.length,
        Math.max(sourceStart + 1, Math.floor((index + 1) * inputRate / outputRate))
      );
      let sum = 0;

      for (let sampleIndex = sourceStart; sampleIndex < sourceEnd; sampleIndex += 1) {
        sum += samples[sampleIndex] || 0;
      }

      output[index] = Math.round(sum / Math.max(1, sourceEnd - sourceStart));
    }

    return output;
  }

  for (let index = 0; index < outputLength; index += 1) {
    const sourcePosition = index * (inputRate / outputRate);
    const leftIndex = Math.floor(sourcePosition);
    const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
    const interpolation = sourcePosition - leftIndex;
    const leftSample = samples[leftIndex] || 0;
    const rightSample = samples[rightIndex] || leftSample;
    output[index] = Math.round(leftSample + ((rightSample - leftSample) * interpolation));
  }

  return output;
}

function encodePcm16ToULaw(samples: Int16Array): Buffer {
  const output = Buffer.alloc(samples.length);

  for (let index = 0; index < samples.length; index += 1) {
    output[index] = encodeULawSample(samples[index]);
  }

  return output;
}

function calculateAudioDurationMs(ulawBuffer: Buffer): number {
  return Math.ceil((ulawBuffer.length / ULaw_SAMPLE_RATE) * 1000);
}

function decodeULawSample(value: number): number {
  const ulaw = ~value & 0xff;
  const sign = ulaw & 0x80;
  const exponent = (ulaw >> 4) & 0x07;
  const mantissa = ulaw & 0x0f;
  const sample = (((mantissa << 3) + 0x84) << exponent) - 0x84;

  return sign ? -sample : sample;
}

function encodeULawSample(sample: number): number {
  const BIAS = 0x84;
  const CLIP = 32635;
  let pcm = Math.max(-CLIP, Math.min(CLIP, sample));
  const sign = pcm < 0 ? 0x80 : 0;

  if (pcm < 0) {
    pcm = -pcm;
  }

  pcm += BIAS;

  let exponent = 7;
  for (let mask = 0x4000; (pcm & mask) === 0 && exponent > 0; mask >>= 1) {
    exponent -= 1;
  }

  const mantissa = (pcm >> (exponent + 3)) & 0x0f;
  return (~(sign | (exponent << 4) | mantissa)) & 0xff;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function buildTransferTwiml(targetNumber: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Dial>${escapeXml(targetNumber)}</Dial></Response>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/'/g, '&apos;');
}

function wait(durationMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}
