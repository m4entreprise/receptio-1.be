import { IncomingMessage, Server as HttpServer } from 'http';
import axios from 'axios';
import { RawData, WebSocket, WebSocketServer } from 'ws';
import { query } from '../config/database';
import { OfferBSettings } from '../types';
import { buildKnowledgeBaseContext, getBbisAgentSettings, getCompanyOfferBSettings } from './offerB';
import { textToSpeech as deepgramTextToSpeech, transcribeAudioBuffer as deepgramTranscribeAudioBuffer } from './deepgram';
import { generateResponse as mistralGenerateResponse, summarizeCall as mistralSummarizeCall, textToSpeech as mistralTextToSpeech, transcribeAudioBuffer as mistralTranscribeAudioBuffer } from './mistral';
import { generateResponse, summarizeCall, transcribeAudioBuffer } from './openai';
import logger from '../utils/logger';
import Twilio from 'twilio';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const STREAMING_ENABLED = process.env.OFFER_B_STREAMING_ENABLED !== 'false';
const ENERGY_THRESHOLD = Number(process.env.OFFER_B_STREAMING_ENERGY_THRESHOLD || 500);
const BBIS_SILENCE_THRESHOLD_MS = Number(process.env.OFFER_BBIS_STREAMING_SILENCE_MS || 260);
const BBIS_MIN_SPEECH_MS = Number(process.env.OFFER_BBIS_STREAMING_MIN_SPEECH_MS || 120);
const BBIS_BARGE_IN_MIN_SPEECH_MS = Number(process.env.OFFER_BBIS_STREAMING_BARGE_IN_MS || 80);
const STREAMING_RESPONSE_MAX_TOKENS = Number(process.env.OFFER_STREAMING_MAX_COMPLETION_TOKENS || 120);
const ULaw_SAMPLE_RATE = 8000;
const ULaw_FRAME_BYTES = 160;
const ULaw_FRAME_DURATION_MS = 20;
const MAX_HISTORY_MESSAGES = 12;

function isUnavailableSummary(summary: unknown): boolean {
  const value = typeof summary === 'string' ? summary.trim() : '';
  return !value || value === 'Résumé non disponible';
}

interface StreamSessionState {
  baseUrl: string;
  assistantPlaybackUntil: number;
  bbisBargeInMinSpeechMs: number;
  bbisLlmModel: string;
  bbisLlmProvider: 'openai' | 'mistral';
  bbisMaxCompletionTokens: number;
  bbisMinSpeechMs: number;
  bbisSilenceThresholdMs: number;
  bbisSttModel: string;
  bbisSttProvider: 'deepgram' | 'mistral';
  bbisSystemPrompt: string;
  bbisTemperature: number;
  bbisTtsModel: string;
  bbisTtsProvider: 'deepgram' | 'mistral';
  bbisTtsVoice: string;
  callId: string;
  callSid: string;
  companyId: string;
  companyName: string;
  fallbackToVoicemail: boolean;
  finalized: boolean;
  greetingSent: boolean;
  initialized: boolean;
  greetingText: string;
  humanTransferNumber: string;
  transferMessage: string;
  knowledgeContext: string;
  lastIntent: string;
  pendingAudioChunks: Buffer[];
  pendingBargeInTriggered: boolean;
  pendingProcessScheduled: boolean;
  playbackGeneration: number;
  processingUtterance: boolean;
  silenceDurationMs: number;
  speechDetected: boolean;
  speechDurationMs: number;
  streamSid: string;
  transcriptMessages: Array<{ role: 'user' | 'assistant'; content: string }>;
  turnCounter: number;
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
    track?: string;
  };
}

interface TwilioStreamStopEvent {
  event?: string;
  stop?: {
    callSid?: string;
  };
  streamSid?: string;
}

interface AssistantPlaybackMetrics {
  audioDurationMs: number;
  playbackStartedAt: number;
  ttsProvider: 'deepgram' | 'mistral' | 'openai';
  ttsDurationMs: number;
}

export function attachTwilioMediaStreamsServer(server: HttpServer) {
  const wss = new WebSocketServer({ noServer: true });
  const wssOutbound = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const requestUrl = new URL(request.url || '/', 'http://localhost');

    if (requestUrl.pathname === '/api/media-streams/twilio') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    } else if (requestUrl.pathname === '/api/media-streams/outbound') {
      wssOutbound.handleUpgrade(request, socket, head, (ws) => {
        wssOutbound.emit('connection', ws, request);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', (twilioSocket, request) => {
    void handleTwilioConnection(twilioSocket, request);
  });

  wssOutbound.on('connection', (twilioSocket, request) => {
    void handleOutboundTranscriptionConnection(twilioSocket, request);
  });
}

// ---------------------------------------------------------------------------
// Outbound transcription-only WebSocket handler
// Receives Twilio Media Streams audio, runs STT, persists live_transcript
// ---------------------------------------------------------------------------
const OUTBOUND_FLUSH_INTERVAL_MS = 2000;
const OUTBOUND_MIN_SPEECH_MS = 150;
const OUTBOUND_SILENCE_THRESHOLD_MS = 500;
const OUTBOUND_ENERGY_THRESHOLD = 200;
const OUTBOUND_MAX_UTTERANCE_MS = 8000;

interface OutboundTrackState {
  pendingAudioChunks: Buffer[];
  speechDetected: boolean;
  speechDurationMs: number;
  silenceDurationMs: number;
  pendingProcessScheduled: boolean;
  lastSpeechFrameAt: number;
}

interface OutboundTranscriptSegment {
  role: 'client' | 'agent';
  text: string;
  ts: number;
}

interface OutboundStreamState {
  callId: string;
  companyId: string;
  initialized: boolean;
  tracks: Record<string, OutboundTrackState>;
  segments: OutboundTranscriptSegment[];
  lastFlushAt: number;
}

function makeTrackState(): OutboundTrackState {
  return {
    pendingAudioChunks: [],
    speechDetected: false,
    speechDurationMs: 0,
    silenceDurationMs: 0,
    pendingProcessScheduled: false,
    lastSpeechFrameAt: 0,
  };
}

async function handleOutboundTranscriptionConnection(ws: WebSocket, request: IncomingMessage) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const callId = String(requestUrl.searchParams.get('callId') || '');
  const companyId = String(requestUrl.searchParams.get('companyId') || '');

  const state: OutboundStreamState = {
    callId,
    companyId,
    initialized: false,
    tracks: {
      inbound: makeTrackState(),
      outbound: makeTrackState(),
    },
    segments: [],
    lastFlushAt: Date.now(),
  };

  if (!callId || !companyId) {
    logger.warn('Outbound media stream rejected: missing callId or companyId');
    ws.close();
    return;
  }

  state.initialized = true;
  logger.info('Outbound transcription stream connected', { callId, companyId });

  const silenceCheckInterval = setInterval(() => {
    const now = Date.now();
    for (const track of Object.keys(state.tracks)) {
      const ts = state.tracks[track];
      if (
        ts.speechDetected
        && !ts.pendingProcessScheduled
        && ts.lastSpeechFrameAt > 0
        && (now - ts.lastSpeechFrameAt) >= OUTBOUND_SILENCE_THRESHOLD_MS
        && ts.speechDurationMs >= OUTBOUND_MIN_SPEECH_MS
      ) {
        ts.pendingProcessScheduled = true;
        void processOutboundTrackUtterance(state, track);
      }
    }
  }, 100);

  const flushInterval = setInterval(() => {
    void flushOutboundTranscript(state);
  }, OUTBOUND_FLUSH_INTERVAL_MS);

  ws.on('message', (data: RawData) => {
    void handleOutboundStreamMessage(data, state);
  });

  ws.on('close', async () => {
    clearInterval(silenceCheckInterval);
    clearInterval(flushInterval);
    for (const track of Object.keys(state.tracks)) {
      if (state.tracks[track].pendingAudioChunks.length > 0) {
        await processOutboundTrackUtterance(state, track);
      }
    }
    await flushOutboundTranscript(state);
    logger.info('Outbound transcription stream closed', { callId: state.callId });
  });

  ws.on('error', (error) => {
    clearInterval(silenceCheckInterval);
    clearInterval(flushInterval);
    logger.error('Outbound transcription stream error', { callId: state.callId, error: error.message });
  });
}

async function handleOutboundStreamMessage(data: RawData, state: OutboundStreamState) {
  const payload = parseSocketMessage(data);
  if (!payload || typeof payload !== 'object') return;

  const eventType = String((payload as { event?: string }).event || '');

  if (eventType === 'start') {
    const startEvent = payload as TwilioStreamStartEvent;
    const customParams = startEvent.start?.customParameters || {};
    if (!state.callId && customParams.callId) state.callId = customParams.callId;
    if (!state.companyId && customParams.companyId) state.companyId = customParams.companyId;
    logger.info('Outbound stream started', { callId: state.callId });
    return;
  }

  if (eventType === 'media') {
    const mediaEvent = payload as TwilioStreamMediaEvent;
    const audioPayload = String(mediaEvent.media?.payload || '');
    const rawTrack = String(mediaEvent.media?.track || 'inbound');
    const track = rawTrack === 'outbound' ? 'outbound' : 'inbound';
    if (!audioPayload) return;

    const audioBuffer = Buffer.from(audioPayload, 'base64');
    if (audioBuffer.length === 0) return;

    const ts = state.tracks[track];
    const frameEnergy = computeULawFrameEnergy(audioBuffer);
    const hasSpeech = frameEnergy >= OUTBOUND_ENERGY_THRESHOLD;

    if (hasSpeech) {
      ts.speechDetected = true;
      ts.speechDurationMs += ULaw_FRAME_DURATION_MS;
      ts.silenceDurationMs = 0;
      ts.lastSpeechFrameAt = Date.now();
      ts.pendingAudioChunks.push(audioBuffer);

      if (ts.speechDurationMs >= OUTBOUND_MAX_UTTERANCE_MS && !ts.pendingProcessScheduled) {
        ts.pendingProcessScheduled = true;
        void processOutboundTrackUtterance(state, track);
      }
      return;
    }

    if (!ts.speechDetected) return;
    return;
  }

  if (eventType === 'stop') {
    for (const track of Object.keys(state.tracks)) {
      if (state.tracks[track].pendingAudioChunks.length > 0) {
        await processOutboundTrackUtterance(state, track);
      }
    }
    await flushOutboundTranscript(state);
  }
}

async function processOutboundTrackUtterance(state: OutboundStreamState, track: string) {
  const ts = state.tracks[track];
  if (!ts || ts.pendingAudioChunks.length === 0) {
    if (ts) ts.pendingProcessScheduled = false;
    return;
  }

  const utteranceBuffer = Buffer.concat(ts.pendingAudioChunks);
  ts.pendingAudioChunks = [];
  ts.pendingProcessScheduled = false;
  ts.silenceDurationMs = 0;
  ts.speechDurationMs = 0;
  ts.speechDetected = false;

  try {
    const pcmBuffer = decodeULawToPcm16(utteranceBuffer);
    const wavBuffer = wrapPcm16AsWav(pcmBuffer, ULaw_SAMPLE_RATE, 1);

    const transcription = DEEPGRAM_API_KEY
      ? await deepgramTranscribeAudioBuffer(wavBuffer, { language: 'fr', mimeType: 'audio/wav' })
      : OPENAI_API_KEY
        ? await transcribeAudioBuffer(wavBuffer, { fileName: 'outbound.wav', language: 'fr', mimeType: 'audio/wav' })
        : null;

    if (transcription && transcription.text.trim()) {
      const text = transcription.text.trim();
      const role: 'client' | 'agent' = track === 'outbound' ? 'agent' : 'client';
      state.segments.push({ role, text, ts: Date.now() });
      logger.info('Outbound utterance transcribed', { callId: state.callId, role, text });
      void flushOutboundTranscript(state);
    }
  } catch (err: any) {
    logger.error('Outbound utterance transcription error', { callId: state.callId, track, error: err.message });
  }
}

async function flushOutboundTranscript(state: OutboundStreamState) {
  if (!state.callId || state.segments.length === 0) return;

  try {
    // Update calls.live_transcript for real-time display
    await query(
      `UPDATE calls SET live_transcript = $1 WHERE id = $2`,
      [JSON.stringify(state.segments), state.callId]
    );

    // Also upsert into transcriptions with segments for persistence
    const textFormat = state.segments
      .map((seg) => `${seg.role === 'agent' ? 'Agent' : 'Client'}: ${seg.text}`)
      .join('\n\n');

    const existing = await query('SELECT id FROM transcriptions WHERE call_id = $1', [state.callId]);
    if (existing.rows.length === 0) {
      await query(
        `INSERT INTO transcriptions (call_id, text, language, confidence, segments)
         VALUES ($1, $2, $3, $4, $5)`,
        [state.callId, textFormat, 'fr', 0.9, JSON.stringify(state.segments)]
      );
    } else {
      await query(
        `UPDATE transcriptions SET segments = $1, text = $2 WHERE id = $3`,
        [JSON.stringify(state.segments), textFormat, existing.rows[0].id]
      );
    }
  } catch (err: any) {
    logger.error('Outbound transcript flush error', { callId: state.callId, error: err.message });
  }
}

export function shouldUseOfferBStreamingPipeline(settings: OfferBSettings): boolean {
  if (!STREAMING_ENABLED || !settings.voicePipelineEnabled) {
    return false;
  }

  const bbisAgentSettings = getBbisAgentSettings(settings);
  const hasSttProvider = bbisAgentSettings.sttProvider === 'mistral' ? Boolean(MISTRAL_API_KEY) : Boolean(DEEPGRAM_API_KEY);
  const hasTtsProvider = bbisAgentSettings.ttsProvider === 'mistral' ? Boolean(MISTRAL_API_KEY) : Boolean(DEEPGRAM_API_KEY);
  const hasLlmProvider = bbisAgentSettings.llmProvider === 'mistral' ? Boolean(MISTRAL_API_KEY) : Boolean(OPENAI_API_KEY);
  return hasSttProvider && hasTtsProvider && hasLlmProvider;
}

async function handleTwilioConnection(twilioSocket: WebSocket, request: IncomingMessage) {
  const requestUrl = new URL(request.url || '/', 'http://localhost');
  const callId = String(requestUrl.searchParams.get('callId') || '');
  const companyId = String(requestUrl.searchParams.get('companyId') || '');
  const baseUrl = String(requestUrl.searchParams.get('baseUrl') || '') || process.env.PUBLIC_WEBHOOK_URL || '';
  logger.info('WebSocket connection established', { callId, companyId, baseUrl, rawUrl: request.url, envUrl: process.env.PUBLIC_WEBHOOK_URL });

  const state: StreamSessionState = {
    baseUrl,
    assistantPlaybackUntil: 0,
    bbisBargeInMinSpeechMs: BBIS_BARGE_IN_MIN_SPEECH_MS,
    bbisLlmModel: '',
    bbisLlmProvider: 'openai',
    bbisMaxCompletionTokens: STREAMING_RESPONSE_MAX_TOKENS,
    bbisMinSpeechMs: BBIS_MIN_SPEECH_MS,
    bbisSilenceThresholdMs: BBIS_SILENCE_THRESHOLD_MS,
    bbisSttModel: '',
    bbisSttProvider: 'deepgram',
    bbisSystemPrompt: '',
    bbisTemperature: 0.4,
    bbisTtsModel: '',
    bbisTtsProvider: 'deepgram',
    bbisTtsVoice: '',
    callId,
    callSid: '',
    companyId,
    companyName: '',
    fallbackToVoicemail: false,
    finalized: false,
    greetingSent: false,
    initialized: false,
    greetingText: '',
    humanTransferNumber: '',
    transferMessage: '',
    knowledgeContext: '',
    lastIntent: 'autre',
    pendingAudioChunks: [],
    pendingBargeInTriggered: false,
    pendingProcessScheduled: false,
    playbackGeneration: 0,
    processingUtterance: false,
    silenceDurationMs: 0,
    speechDetected: false,
    speechDurationMs: 0,
    streamSid: '',
    transcriptMessages: [],
    turnCounter: 0,
    twilioStartedAt: null,
  };

  twilioSocket.on('message', (data) => {
    void handleTwilioMessage(data, twilioSocket, state);
  });

  twilioSocket.on('close', async () => {
    await finalizeStreamingCall(state, 'twilio_socket_closed');
  });

  twilioSocket.on('error', async (error) => {
    logger.error('Twilio media stream socket error', { error: error.message, callId: state.callId, companyId: state.companyId });
    await finalizeStreamingCall(state, 'twilio_socket_error');
  });

  if (callId && companyId) {
    try {
      await initializeStreamingSession(state, callId, companyId);
    } catch (error: any) {
      logger.error('Twilio media stream setup error', { error: error.message, callId, companyId });
      if (state.fallbackToVoicemail && state.callSid && state.baseUrl) {
        await redirectToVoicemail(state).catch((e: any) =>
          logger.error('Voicemail fallback failed after init error', { error: e.message, callId })
        );
      }
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

      // Start Twilio call recording for streaming calls
      const resolvedCallSid = startEvent.start?.callSid;
      const customBaseUrl = startEvent.start?.customParameters?.baseUrl;
      const effectiveBaseUrl = state.baseUrl || customBaseUrl || '';
      logger.info('Recording start check', { resolvedCallSid, baseUrl: state.baseUrl, customBaseUrl, effectiveBaseUrl });
      if (resolvedCallSid && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && effectiveBaseUrl) {
        void startTwilioRecording(resolvedCallSid, effectiveBaseUrl, resolvedCallId);
      } else {
        logger.warn('Recording skipped - missing data', { resolvedCallSid, hasBaseUrl: !!effectiveBaseUrl, hasTwilioCreds: !!(TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) });
      }

      if (!state.initialized) {
        if (!resolvedCallId || !resolvedCompanyId) {
          logger.warn('Twilio media stream rejected', {
            callId: resolvedCallId,
            companyId: resolvedCompanyId,
            hasOpenAiKey: Boolean(OPENAI_API_KEY),
            hasDeepgramKey: Boolean(DEEPGRAM_API_KEY),
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

      if (!state.greetingSent) {
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

      const frameEnergy = computeULawFrameEnergy(audioBuffer);
      const hasSpeech = frameEnergy >= ENERGY_THRESHOLD;

      if (hasSpeech) {
        state.speechDetected = true;
        state.speechDurationMs += ULaw_FRAME_DURATION_MS;
        state.silenceDurationMs = 0;

        const bargeInMinSpeechMs = state.bbisBargeInMinSpeechMs;

        if (
          state.assistantPlaybackUntil > Date.now()
          && state.speechDurationMs >= bargeInMinSpeechMs
          && state.streamSid
          && twilioSocket.readyState === WebSocket.OPEN
        ) {
          state.playbackGeneration += 1;
          state.assistantPlaybackUntil = 0;
          state.pendingBargeInTriggered = true;
          twilioSocket.send(JSON.stringify({ event: 'clear', streamSid: state.streamSid }));
        }

        state.pendingAudioChunks.push(audioBuffer);
        return;
      }

      if (!state.speechDetected) {
        return;
      }

      if (state.pendingProcessScheduled) {
        return;
      }

      state.pendingAudioChunks.push(audioBuffer);
      state.silenceDurationMs += ULaw_FRAME_DURATION_MS;

      const silenceThresholdMs = state.bbisSilenceThresholdMs;
      const minSpeechMs = state.bbisMinSpeechMs;

      if (
        state.silenceDurationMs >= silenceThresholdMs
        && state.speechDurationMs >= minSpeechMs
        && !state.pendingProcessScheduled
      ) {
        state.pendingProcessScheduled = true;

        if (!state.processingUtterance) {
          void processBufferedUtterance(twilioSocket, state);
        }
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
  const bbisAgentSettings = getBbisAgentSettings(offerBSettings);

  // Défini tôt pour que le catch de handleTwilioConnection puisse déclencher le fallback
  state.fallbackToVoicemail = Boolean(offerBSettings.fallbackToVoicemail);

  if (!callContext) {
    logger.warn('Twilio media stream call context missing', { callId, companyId });
    throw new Error('Streaming call context missing');
  }

  if (!offerBSettings.voicePipelineEnabled) {
    throw new Error('Streaming session requested for non-agent mode');
  }

  if (bbisAgentSettings.llmProvider === 'mistral' && !MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY not configured for LLM');
  }

  if (bbisAgentSettings.llmProvider === 'openai' && !OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured for LLM');
  }

  if (bbisAgentSettings.sttProvider === 'mistral' && !MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY not configured for STT');
  }

  if (bbisAgentSettings.sttProvider === 'deepgram' && !DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not configured for STT');
  }

  if (bbisAgentSettings.ttsProvider === 'mistral' && !MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY not configured for TTS');
  }

  if (bbisAgentSettings.ttsProvider === 'deepgram' && !DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not configured for TTS');
  }

  const knowledgeContext = offerBSettings.knowledgeBaseEnabled
    ? await buildKnowledgeBaseContext(companyId)
    : '';

  await ensureConversationExists(callId);
  await ensureCallSummaryExists(callId);
  await appendCallEvent(callId, 'twilio.media_stream.connection_opened', {
    companyId,
    provider: 'twilio',
    mode: `${bbisAgentSettings.sttProvider}_${bbisAgentSettings.llmProvider}_${bbisAgentSettings.ttsProvider}`,
  });
  state.bbisBargeInMinSpeechMs = bbisAgentSettings.bargeInMinSpeechMs;
  state.bbisLlmModel = bbisAgentSettings.llmModel.trim();
  state.bbisLlmProvider = bbisAgentSettings.llmProvider;
  state.bbisMaxCompletionTokens = bbisAgentSettings.maxCompletionTokens;
  state.bbisMinSpeechMs = bbisAgentSettings.minSpeechMs;
  state.bbisSilenceThresholdMs = bbisAgentSettings.silenceThresholdMs;
  state.bbisSttModel = bbisAgentSettings.sttModel.trim();
  state.bbisSttProvider = bbisAgentSettings.sttProvider;
  state.bbisSystemPrompt = bbisAgentSettings.systemPrompt.trim();
  state.bbisTemperature = bbisAgentSettings.temperature;
  state.bbisTtsModel = bbisAgentSettings.ttsModel.trim();
  state.bbisTtsProvider = bbisAgentSettings.ttsProvider;
  state.bbisTtsVoice = bbisAgentSettings.ttsVoice.trim();
  state.callId = callId;
  state.callSid = callContext.callSid;
  state.companyId = companyId;
  state.companyName = callContext.companyName;
  state.fallbackToVoicemail = offerBSettings.fallbackToVoicemail;
  state.greetingText = offerBSettings.greetingText || `Bonjour, vous êtes bien chez ${callContext.companyName}. Comment puis-je vous aider aujourd’hui ?`;
  state.humanTransferNumber = offerBSettings.humanTransferNumber;
  state.transferMessage = offerBSettings.transferMessage?.trim() || 'Je vous mets en relation avec la personne compétente pour votre demande. Un instant s\'il vous plaît.';
  state.knowledgeContext = knowledgeContext;
  state.initialized = true;
}

async function processBufferedUtterance(twilioSocket: WebSocket, state: StreamSessionState) {
  if (state.processingUtterance) {
    return;
  }

  if (state.pendingAudioChunks.length === 0) {
    state.pendingProcessScheduled = false;
    return;
  }

  const utteranceBuffer = Buffer.concat(state.pendingAudioChunks);
  const inputAudioMs = calculateAudioDurationMs(utteranceBuffer);
  const capturedSilenceDurationMs = state.silenceDurationMs;
  const capturedSpeechDurationMs = state.speechDurationMs;
  const bargeInTriggered = state.pendingBargeInTriggered;
  const utteranceCapturedAt = Date.now();
  const utteranceStartedAt = Date.now();
  const turnIndex = ++state.turnCounter;
  let currentStage: 'stt' | 'llm' | 'tts' = 'stt';
  let callerText = '';
  let responseText = '';
  let sttDurationMs: number | null = null;
  let llmDurationMs: number | null = null;
  let playbackMetrics: AssistantPlaybackMetrics | null = null;
  let sttConfidence: number | null = null;
  state.pendingAudioChunks = [];
  state.pendingBargeInTriggered = false;
  state.pendingProcessScheduled = false;
  state.processingUtterance = true;
  state.silenceDurationMs = 0;
  state.speechDurationMs = 0;
  state.speechDetected = false;

  try {
    const pcmBuffer = decodeULawToPcm16(utteranceBuffer);
    const wavBuffer = wrapPcm16AsWav(pcmBuffer, ULaw_SAMPLE_RATE, 1);
    const sttStartedAt = Date.now();
    const transcription = state.bbisSttProvider === 'mistral'
      ? await mistralTranscribeAudioBuffer(wavBuffer, {
        fileName: 'twilio-stream.wav',
        language: 'fr',
        mimeType: 'audio/wav',
        model: state.bbisSttModel || undefined,
      })
      : await deepgramTranscribeAudioBuffer(wavBuffer, {
        language: 'fr',
        mimeType: 'audio/wav',
        model: state.bbisSttModel || undefined,
      });
    sttDurationMs = Date.now() - sttStartedAt;
    sttConfidence = transcription.confidence;
    callerText = normalizeCallerText(transcription.text);

    if (!callerText) {
      await appendBbisTurnEvent(state, 'bbis.turn.no_transcript', {
        bargeInTriggered,
        inputAudioMs,
        llmDurationMs,
        silenceDurationMs: capturedSilenceDurationMs,
        speechDurationMs: capturedSpeechDurationMs,
        sttConfidence,
        sttDurationMs,
        sttModel: state.bbisSttModel || 'nova-2',
        totalDurationMs: Date.now() - utteranceStartedAt,
        transcriptLength: 0,
        transcriptText: '',
        turnIndex,
      });
      return;
    }

    void runNonBlockingPersistence(
      appendTranscriptLine(state.callId, 'Client', callerText),
      'streaming.user_transcript_persist_failed',
      state
    );
    state.transcriptMessages.push({ role: 'user', content: callerText });
    trimConversationHistory(state);

    const detectedIntent = detectStreamingIntent(callerText);
    state.lastIntent = detectedIntent.summaryIntent;

    if (detectedIntent.kind === 'human_transfer' && state.humanTransferNumber) {
      await appendBbisTurnEvent(state, 'bbis.turn.completed', {
        actionType: 'transfer_to_human',
        bargeInTriggered,
        inputAudioMs,
        llmDurationMs,
        replyLength: 0,
        replyText: '',
        silenceDurationMs: capturedSilenceDurationMs,
        source: 'streaming_user_request',
        speechDurationMs: capturedSpeechDurationMs,
        sttConfidence,
        sttDurationMs,
        sttModel: state.bbisSttModel || 'nova-2',
        totalDurationMs: Date.now() - utteranceStartedAt,
        transcriptLength: callerText.length,
        transcriptText: callerText,
        transferRequested: true,
        turnIndex,
        turnIntent: detectedIntent.summaryIntent,
      });
      await appendOfferBAction(state.callId, 'transfer_to_human', {
        input: callerText,
        transferNumber: state.humanTransferNumber,
        source: 'streaming_user_request',
      });
      await speakAssistantText(twilioSocket, state, state.transferMessage, {
        actionType: 'transfer_announcement',
        closeAfterPlayback: false,
        persistTranscript: false,
        source: 'transfer_premium_tts',
      });
      await redirectTwilioCall(state.callSid, buildTransferTwiml(state.humanTransferNumber));
      await finalizeStreamingCall(state, 'human_transfer_requested');
      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.close();
      }
      return;
    }

    if (detectedIntent.kind === 'goodbye') {
      currentStage = 'tts';
      responseText = 'Merci, au revoir et bonne journée.';
      playbackMetrics = await speakAssistantText(twilioSocket, state, responseText, {
        actionType: 'agent_closed_call',
        closeAfterPlayback: true,
        persistTranscript: true,
        source: 'streaming_goodbye',
      });
      const timeToFirstAudioAfterUserEndMs = playbackMetrics?.playbackStartedAt
        ? playbackMetrics.playbackStartedAt - (utteranceCapturedAt - capturedSilenceDurationMs)
        : null;
      const processingDurationMs = playbackMetrics?.playbackStartedAt
        ? playbackMetrics.playbackStartedAt - utteranceStartedAt
        : Date.now() - utteranceStartedAt;
      await appendBbisTurnEvent(state, 'bbis.turn.completed', {
        actionType: 'agent_closed_call',
        audioDurationMs: playbackMetrics?.audioDurationMs ?? null,
        bargeInTriggered,
        inputAudioMs,
        llmDurationMs,
        replyLength: responseText.length,
        replyText: responseText,
        silenceDurationMs: capturedSilenceDurationMs,
        source: 'streaming_goodbye',
        speechDurationMs: capturedSpeechDurationMs,
        sttConfidence,
        sttDurationMs,
        sttModel: state.bbisSttModel || 'nova-2',
        timeToFirstAudioAfterUserEndMs,
        processingDurationMs,
        totalDurationMs: processingDurationMs,
        transcriptLength: callerText.length,
        transcriptText: callerText,
        transferRequested: false,
        providerTts: playbackMetrics?.ttsProvider ?? state.bbisTtsProvider,
        ttsDurationMs: playbackMetrics?.ttsDurationMs ?? null,
        turnIndex,
        turnIntent: detectedIntent.summaryIntent,
      });
      return;
    }

    if (detectedIntent.kind === 'greeting') {
      currentStage = 'tts';
      responseText = `Bonjour, je suis le réceptionniste de ${state.companyName}. Comment puis-je vous aider ?`;
      playbackMetrics = await speakAssistantText(twilioSocket, state, responseText, {
        actionType: 'agent_replied',
        closeAfterPlayback: false,
        persistTranscript: true,
        source: 'streaming_greeting_followup',
      });
      const timeToFirstAudioAfterUserEndMs = playbackMetrics?.playbackStartedAt
        ? playbackMetrics.playbackStartedAt - (utteranceCapturedAt - capturedSilenceDurationMs)
        : null;
      const processingDurationMs = playbackMetrics?.playbackStartedAt
        ? playbackMetrics.playbackStartedAt - utteranceStartedAt
        : Date.now() - utteranceStartedAt;
      await appendBbisTurnEvent(state, 'bbis.turn.completed', {
        actionType: 'agent_replied',
        audioDurationMs: playbackMetrics?.audioDurationMs ?? null,
        bargeInTriggered,
        inputAudioMs,
        llmDurationMs,
        replyLength: responseText.length,
        replyText: responseText,
        silenceDurationMs: capturedSilenceDurationMs,
        source: 'streaming_greeting_followup',
        speechDurationMs: capturedSpeechDurationMs,
        sttConfidence,
        sttDurationMs,
        sttModel: state.bbisSttModel || 'nova-2',
        timeToFirstAudioAfterUserEndMs,
        processingDurationMs,
        totalDurationMs: processingDurationMs,
        transcriptLength: callerText.length,
        transcriptText: callerText,
        transferRequested: false,
        providerTts: playbackMetrics?.ttsProvider ?? state.bbisTtsProvider,
        ttsDurationMs: playbackMetrics?.ttsDurationMs ?? null,
        turnIndex,
        turnIntent: detectedIntent.summaryIntent,
      });
      return;
    }

    currentStage = 'llm';
    const llmStartedAt = Date.now();
    const agentReply = await generateStreamingReply(state, callerText);
    llmDurationMs = Date.now() - llmStartedAt;

    if (agentReply === '__TRANSFER__' && state.humanTransferNumber) {
      await appendBbisTurnEvent(state, 'bbis.turn.completed', {
        actionType: 'transfer_to_human',
        bargeInTriggered,
        inputAudioMs,
        llmDurationMs,
        replyLength: 0,
        replyText: '',
        silenceDurationMs: capturedSilenceDurationMs,
        source: 'streaming_agent_decision',
        speechDurationMs: capturedSpeechDurationMs,
        sttConfidence: transcription.confidence,
        sttDurationMs,
        sttModel: state.bbisSttModel || 'nova-2',
        totalDurationMs: Date.now() - utteranceStartedAt,
        transcriptLength: callerText.length,
        transcriptText: callerText,
        transferRequested: true,
        turnIndex,
        turnIntent: detectedIntent.summaryIntent,
      });
      await appendOfferBAction(state.callId, 'transfer_to_human', {
        input: callerText,
        transferNumber: state.humanTransferNumber,
        source: 'streaming_agent_decision',
      });
      await speakAssistantText(twilioSocket, state, state.transferMessage, {
        actionType: 'transfer_announcement',
        closeAfterPlayback: false,
        persistTranscript: false,
        source: 'transfer_premium_tts',
      });
      await redirectTwilioCall(state.callSid, buildTransferTwiml(state.humanTransferNumber));
      await finalizeStreamingCall(state, 'agent_transfer_requested');
      if (twilioSocket.readyState === WebSocket.OPEN) {
        twilioSocket.close();
      }
      return;
    }

    responseText = agentReply === '__TRANSFER__'
      ? 'Je n’ai pas assez d’informations pour répondre précisément. Pouvez-vous reformuler votre demande ?'
      : agentReply;

    currentStage = 'tts';
    playbackMetrics = await speakAssistantText(twilioSocket, state, responseText, {
      actionType: 'agent_replied',
      closeAfterPlayback: false,
      persistTranscript: true,
      source: 'streaming_llm',
    });
    const timeToFirstAudioAfterUserEndMs = playbackMetrics?.playbackStartedAt
      ? playbackMetrics.playbackStartedAt - (utteranceCapturedAt - capturedSilenceDurationMs)
      : null;
    const processingDurationMs = playbackMetrics?.playbackStartedAt
      ? playbackMetrics.playbackStartedAt - utteranceStartedAt
      : Date.now() - utteranceStartedAt;

    await appendBbisTurnEvent(state, 'bbis.turn.completed', {
      actionType: 'agent_replied',
      audioDurationMs: playbackMetrics?.audioDurationMs ?? null,
      bargeInTriggered,
      inputAudioMs,
      llmDurationMs,
      llmModel: state.bbisLlmModel || process.env.OPENAI_LLM_MODEL || 'gpt-5.4-nano',
      replyLength: responseText.length,
      replyText: responseText,
      silenceDurationMs: capturedSilenceDurationMs,
      source: 'streaming_llm',
      speechDurationMs: capturedSpeechDurationMs,
      sttConfidence,
      sttDurationMs,
      sttModel: state.bbisSttModel || 'nova-2',
      timeToFirstAudioAfterUserEndMs,
      processingDurationMs,
      totalDurationMs: processingDurationMs,
      transcriptLength: callerText.length,
      transcriptText: callerText,
      transferRequested: false,
      providerTts: playbackMetrics?.ttsProvider ?? state.bbisTtsProvider,
      ttsDurationMs: playbackMetrics?.ttsDurationMs ?? null,
      turnIndex,
      turnIntent: detectedIntent.summaryIntent,
    });

    logger.info('Realtime utterance processed', {
      callId: state.callId,
      sttDurationMs,
      llmDurationMs,
      ttsDurationMs: playbackMetrics?.ttsDurationMs,
      totalDurationMs: processingDurationMs,
      timeToFirstAudioAfterUserEndMs,
      playbackDurationMs: playbackMetrics?.audioDurationMs,
      callerTextLength: callerText.length,
      replyLength: responseText.length,
    });
  } catch (error: any) {
    await appendBbisTurnEvent(state, 'bbis.turn.failed', {
      bargeInTriggered,
      errorMessage: error.message,
      errorStage: currentStage,
      inputAudioMs,
      llmDurationMs,
      providerTts: error?.ttsProvider || playbackMetrics?.ttsProvider || state.bbisTtsProvider,
      replyLength: responseText.length,
      replyText: responseText,
      silenceDurationMs: capturedSilenceDurationMs,
      speechDurationMs: capturedSpeechDurationMs,
      sttConfidence,
      sttDurationMs,
      sttModel: state.bbisSttModel || 'nova-2',
      totalDurationMs: Date.now() - utteranceStartedAt,
      transcriptLength: callerText.length,
      transcriptText: callerText,
      ttsDurationMs: playbackMetrics?.ttsDurationMs ?? null,
      turnIntent: state.lastIntent,
      turnIndex,
    });
    logger.error('Offer realtime STT-LLM-TTS pipeline error', {
      error: error.message,
      callId: state.callId,
    });

    if (twilioSocket.readyState === WebSocket.OPEN) {
      await speakAssistantText(twilioSocket, state, 'Je rencontre un problème technique. Pouvez-vous répéter votre demande ?', {
        actionType: 'agent_needs_clarification',
        closeAfterPlayback: false,
        persistTranscript: true,
        source: 'streaming_error',
      });
    } else if (state.fallbackToVoicemail && state.callSid && state.baseUrl) {
      await redirectToVoicemail(state).catch((e: any) =>
        logger.error('Voicemail fallback failed after pipeline error', { error: e.message, callId: state.callId })
      );
    }
  } finally {
    state.processingUtterance = false;

    const silenceThresholdMs = state.bbisSilenceThresholdMs;

    const shouldProcessQueuedUtterance = state.pendingAudioChunks.length > 0
      && state.speechDetected
      && (state.pendingProcessScheduled || state.silenceDurationMs >= silenceThresholdMs);

    if (shouldProcessQueuedUtterance) {
      state.pendingProcessScheduled = true;
      void processBufferedUtterance(twilioSocket, state);
    }
  }
}

async function generateStreamingReply(state: StreamSessionState, callerText: string): Promise<string> {
  const defaultSystemPrompt = [
    `Tu es le réceptionniste téléphonique de ${state.companyName}.`,
    'Réponds en français, en deux phrases maximum, de manière utile et concise.',
    'Si le client demande explicitement un humain, un rappel ou un transfert, réponds exactement __TRANSFER__.',
    'Si une information manque, n’invente pas et pose une seule question courte de clarification.',
    state.knowledgeContext ? `Informations métier disponibles:\n${state.knowledgeContext}` : 'Aucune information métier fiable n’est disponible.',
    state.humanTransferNumber ? `Numéro humain disponible : ${state.humanTransferNumber}.` : 'Aucun numéro humain n’est configuré.',
  ].join('\n\n');
  const systemPrompt = state.bbisSystemPrompt
    ? [state.bbisSystemPrompt, state.knowledgeContext ? `Informations métier disponibles:\n${state.knowledgeContext}` : '', state.humanTransferNumber ? `Numéro humain disponible : ${state.humanTransferNumber}.` : "Aucun numéro humain n'est configuré."]
      .filter(Boolean)
      .join('\n\n')
    : defaultSystemPrompt;

  const messages = [
    ...state.transcriptMessages,
    { role: 'user', content: callerText },
  ].map((message) => ({ role: message.role, content: message.content }));

  const response = state.bbisLlmProvider === 'mistral'
    ? await mistralGenerateResponse(messages, systemPrompt, {
      model: state.bbisLlmModel || undefined,
      maxCompletionTokens: state.bbisMaxCompletionTokens,
      temperature: state.bbisTemperature,
    })
    : await generateResponse(messages, systemPrompt, {
      model: state.bbisLlmModel || undefined,
      maxCompletionTokens: state.bbisMaxCompletionTokens,
      temperature: state.bbisTemperature,
    });
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
): Promise<AssistantPlaybackMetrics | null> {
  const cleanText = text.trim();
  let effectiveTtsProvider: 'deepgram' | 'mistral' | 'openai' = state.bbisTtsProvider;

  if (!cleanText || !state.streamSid || twilioSocket.readyState !== WebSocket.OPEN) {
    return null;
  }

  try {
    if (options.persistTranscript) {
      void runNonBlockingPersistence(
        appendTranscriptLine(state.callId, 'Agent', cleanText),
        'streaming.assistant_transcript_persist_failed',
        state
      );
    }

    state.transcriptMessages.push({ role: 'assistant', content: cleanText });
    trimConversationHistory(state);

    void runNonBlockingPersistence(
      appendOfferBAction(state.callId, options.actionType, {
        source: options.source,
        transcript: cleanText,
        }),
      'streaming.assistant_action_persist_failed',
      state
    );

    const ttsStartedAt = Date.now();
    let wavAudio: Buffer;

    if (state.bbisTtsProvider === 'mistral') {
      try {
        wavAudio = await mistralTextToSpeech(cleanText, 'wav', 'fr', {
          model: state.bbisTtsModel || undefined,
          voice: state.bbisTtsVoice || undefined,
        });
      } catch (error: any) {
        if (!DEEPGRAM_API_KEY) {
          throw error;
        }

        logger.warn('Mistral TTS failed, falling back to Deepgram TTS', {
          callId: state.callId,
          error: error.message,
          source: options.source,
        });

        effectiveTtsProvider = 'deepgram';
        wavAudio = await deepgramTextToSpeech(cleanText, 'wav', 'fr');
      }
    } else {
      wavAudio = await deepgramTextToSpeech(cleanText, 'wav', 'fr', {
        model: state.bbisTtsModel || undefined,
        voice: state.bbisTtsVoice || undefined,
      });
    }

    const ttsDurationMs = Date.now() - ttsStartedAt;
    const ulawAudio = convertWavToULaw(wavAudio);
    const audioDurationMs = calculateAudioDurationMs(ulawAudio);
    const playbackGeneration = ++state.playbackGeneration;
    const playbackStartedAt = Date.now();
    state.assistantPlaybackUntil = playbackStartedAt + audioDurationMs + 120;
    await sendULawAudioToTwilio(twilioSocket, state.streamSid, ulawAudio, () => playbackGeneration === state.playbackGeneration);

    logger.info('Realtime assistant audio generated', {
      callId: state.callId,
      source: options.source,
      ttsProvider: effectiveTtsProvider,
      ttsDurationMs,
      audioDurationMs,
      textLength: cleanText.length,
    });

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

    return {
      audioDurationMs,
      playbackStartedAt,
      ttsProvider: effectiveTtsProvider,
      ttsDurationMs,
    };
  } catch (error: any) {
    error.ttsProvider = error?.ttsProvider || effectiveTtsProvider;
    logger.error('Twilio assistant playback error', {
      error: error.message,
      callId: state.callId,
      companyId: state.companyId,
      source: options.source,
      ttsProvider: error.ttsProvider,
    });
    throw error;
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

async function appendTranscriptLine(callId: string, speaker: 'Client' | 'Agent', text: string) {
  const label = speaker === 'Client' ? 'Client' : 'Agent';
  const transcript = `${label}: ${text.trim()}`;
  const role: 'client' | 'agent' = speaker === 'Client' ? 'client' : 'agent';
  const newSegment: { role: 'client' | 'agent'; text: string; ts?: number } = { role, text: text.trim(), ts: Date.now() };

  const transcriptionResult = await query(
    'SELECT id, text, segments FROM transcriptions WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1',
    [callId]
  );

  if (transcriptionResult.rows.length === 0) {
    await query(
      `INSERT INTO transcriptions (call_id, text, language, confidence, segments)
       VALUES ($1, $2, $3, $4, $5)`,
      [callId, transcript, 'fr', 1, JSON.stringify([newSegment])]
    );
    return;
  }

  const existingText = String(transcriptionResult.rows[0].text || '');
  const nextText = existingText ? `${existingText}\n${transcript}` : transcript;

  // Parse existing segments or create from text
  let segments: Array<{ role: 'client' | 'agent'; text: string; ts?: number }> = [];
  const existingSegments = transcriptionResult.rows[0].segments;
  if (existingSegments) {
    // JSONB columns are auto-parsed by pg into JS objects, handle both cases
    try {
      segments = Array.isArray(existingSegments) ? existingSegments : JSON.parse(existingSegments);
    } catch { /* ignore */ }
  }
  segments.push(newSegment);

  await query(
    'UPDATE transcriptions SET text = $1, segments = $2 WHERE id = $3',
    [nextText, JSON.stringify(segments), transcriptionResult.rows[0].id]
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

async function appendBbisTurnEvent(
  state: StreamSessionState,
  eventType: 'bbis.turn.completed' | 'bbis.turn.failed' | 'bbis.turn.no_transcript',
  data: Record<string, unknown>
) {
  if (!state.callId) {
    return;
  }

  await appendCallEvent(state.callId, eventType, {
    llmModel: state.bbisLlmModel || (state.bbisLlmProvider === 'mistral' ? 'mistral-small-latest' : process.env.OPENAI_LLM_MODEL || 'gpt-5.4-nano'),
    providerLlm: state.bbisLlmProvider,
    providerStt: state.bbisSttProvider,
    providerTts: state.bbisTtsProvider,
    sttModel: state.bbisSttModel || (state.bbisSttProvider === 'mistral' ? 'voxtral-mini-latest' : 'nova-2'),
    ttsModel: state.bbisTtsModel || (state.bbisTtsProvider === 'mistral' ? 'voxtral-mini-tts-2603' : state.bbisTtsVoice || 'aura-asteria-fr'),
    ttsVoice: state.bbisTtsVoice || state.bbisTtsModel || (state.bbisTtsProvider === 'mistral' ? '' : 'aura-asteria-fr'),
    ...data,
  });
}

function runNonBlockingPersistence(task: Promise<unknown>, eventType: string, state: StreamSessionState) {
  task.catch((error: any) => {
    logger.warn(eventType, {
      callId: state.callId,
      companyId: state.companyId,
      error: error.message,
    });
  });
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

  await persistFinalSummary(state.callId, state.lastIntent, state.bbisLlmProvider);
  await appendCallEvent(state.callId, 'twilio.media_stream.finalized', {
    durationSeconds,
    reason,
  });
}

async function persistFinalSummary(callId: string, intent: string, llmProvider: 'openai' | 'mistral') {
  const [summaryResult, transcriptionResult] = await Promise.all([
    query('SELECT id, summary, actions FROM call_summaries WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1', [callId]),
    query('SELECT text FROM transcriptions WHERE call_id = $1 ORDER BY created_at ASC LIMIT 1', [callId]),
  ]);

  const transcriptionText = String(transcriptionResult.rows[0]?.text || '').trim();
  const summary = llmProvider === 'mistral'
    ? await mistralSummarizeCall(transcriptionText)
    : await summarizeCall(transcriptionText);

  if (summaryResult.rows.length === 0) {
    await query(
      `INSERT INTO call_summaries (call_id, summary, intent, actions)
       VALUES ($1, $2, $3, $4)`,
      [callId, summary, intent, JSON.stringify([])]
    );
    return;
  }

  if (!isUnavailableSummary(summary) || isUnavailableSummary(summaryResult.rows[0].summary)) {
    await query(
      'UPDATE call_summaries SET summary = $1, intent = $2 WHERE id = $3',
      [summary, intent, summaryResult.rows[0].id]
    );
  }
}

async function redirectToVoicemail(state: StreamSessionState) {
  const greetingUrl = `${state.baseUrl}/api/webhooks/twilio/greeting?companyId=${encodeURIComponent(state.companyId)}`;
  const recordingCompleteUrl = `${state.baseUrl}/api/webhooks/twilio/recording-complete`;
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Play>${greetingUrl}</Play><Record method="POST" playBeep="true" maxLength="120" trim="trim-silence" recordingStatusCallback="${recordingCompleteUrl}" recordingStatusCallbackMethod="POST" /><Hangup /></Response>`;
  logger.info('Redirecting call to Core voicemail fallback', { callSid: state.callSid, companyId: state.companyId });
  await redirectTwilioCall(state.callSid, twiml);
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

async function startTwilioRecording(callSid: string, baseUrl: string, callId: string): Promise<void> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    logger.warn('Twilio recording skipped: missing credentials', { callSid });
    return;
  }

  if (!baseUrl) {
    logger.warn('Twilio recording skipped: empty baseUrl', { callSid, callId });
    return;
  }

  try {
    // Convert wss:// to https:// for the callback URL (Twilio requires http/https, not ws/wss)
    const httpsBaseUrl = baseUrl.replace(/^wss:/, 'https:').replace(/^ws:/, 'http:');
    const recordingCallbackUrl = `${httpsBaseUrl.replace(/\/$/, '')}/api/webhooks/twilio/streaming-recording?callId=${encodeURIComponent(callId)}`;
    logger.info('Starting Twilio recording with callback', { callSid, callId, recordingCallbackUrl });
    const client = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

    const recording = await client.calls(callSid).recordings.create({
      recordingStatusCallback: recordingCallbackUrl,
      recordingStatusCallbackMethod: 'POST',
      recordingChannels: 'dual', // Dual channel for speaker separation
    });

    logger.info('Twilio recording started for streaming call', {
      callSid,
      callId,
      recordingSid: recording.sid,
    });
  } catch (error: any) {
    logger.error('Failed to start Twilio recording', {
      callSid,
      callId,
      error: error.message,
    });
  }
}
