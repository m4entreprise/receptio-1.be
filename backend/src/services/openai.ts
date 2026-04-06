import axios from 'axios';
import logger from '../utils/logger';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';
const OPENAI_STT_MODEL = process.env.OPENAI_STT_MODEL || 'gpt-4o-mini-transcribe';
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || 'ash';
const OPENAI_TTS_SPEED = clampTtsSpeed(Number(process.env.OPENAI_TTS_SPEED || 1));
const OPENAI_LLM_MODEL = process.env.OPENAI_LLM_MODEL || 'gpt-5.4-nano';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

function clampTtsSpeed(speed: number): number {
  if (!Number.isFinite(speed)) {
    return 1;
  }

  return Math.min(4, Math.max(0.25, speed));
}

function ensureOpenAiConfigured() {
  if (!OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY not configured');
  }
}

function getAudioUrlWithExtension(audioUrl: string): string {
  if (audioUrl.endsWith('.mp3') || audioUrl.endsWith('.wav')) {
    return audioUrl;
  }

  return `${audioUrl}.mp3`;
}

async function downloadAudio(audioUrl: string): Promise<{ buffer: Buffer; mimeType: string; fileName: string }> {
  const resolvedAudioUrl = getAudioUrlWithExtension(audioUrl);
  const headers: Record<string, string> = {};

  if (resolvedAudioUrl.includes('twilio.com') && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN) {
    headers.Authorization = `Basic ${Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64')}`;
  }

  const response = await fetch(resolvedAudioUrl, { headers });

  if (!response.ok) {
    throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const isWav = resolvedAudioUrl.endsWith('.wav');

  return {
    buffer,
    mimeType: isWav ? 'audio/wav' : 'audio/mpeg',
    fileName: isWav ? 'recording.wav' : 'recording.mp3',
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') {
          return item;
        }

        if (item && typeof item === 'object' && 'text' in item && typeof item.text === 'string') {
          return item.text;
        }

        return '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return '';
}

function normalizeTranscription(transcription: string): string {
  return transcription.replace(/\s+/g, ' ').trim();
}

function hasMeaningfulTranscription(transcription: string): boolean {
  return normalizeTranscription(transcription).length > 3;
}

function normalizeSummaryTranscript(transcription: string): string {
  return transcription
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => {
      const normalizedLine = line.toLowerCase();
      if (normalizedLine === 'client: lui.' || normalizedLine === 'client: oui.' || normalizedLine === 'client: non.') {
        return false;
      }

      return true;
    })
    .join('\n');
}

function buildSummaryPrompt(transcription: string): string {
  return [
    'Tu rédiges un résumé d’appel téléphonique en français.',
    'Utilise uniquement les informations explicitement présentes dans la transcription.',
    'N’invente jamais de rendez-vous confirmé, de nom, d’horaire, d’intention ou d’action si ce n’est pas clairement dit.',
    'Si une information semble ambiguë, contradictoire, bruitée ou peu fiable, mentionne qu’elle reste à confirmer au lieu de l’affirmer.',
    'Si un prénom, un nom, une date, une heure ou un détail personnel apparaît sous plusieurs variantes, ne choisis pas arbitrairement une version : indique simplement que l’information est à confirmer.',
    'Ignore les fragments manifestement parasites, absurdes, isolés ou sans contexte.',
    'Retourne 2 ou 3 phrases maximum, professionnelles et factuelles, sans puces ni markdown.',
    '',
    'Transcription :',
    transcription,
  ].join('\n');
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  options: {
    fileName?: string;
    language?: string;
    mimeType?: string;
  } = {}
): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  try {
    ensureOpenAiConfigured();

    const formData = new FormData();
    const language = options.language || 'fr';
    const mimeType = options.mimeType || 'audio/wav';
    const fileName = options.fileName || 'audio.wav';

    formData.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
    formData.append('model', OPENAI_STT_MODEL);
    formData.append('language', language);

    const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json() as { text?: string; error?: { message?: string } };

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI transcription failed');
    }

    logger.info('Audio buffer transcribed with OpenAI', {
      model: OPENAI_STT_MODEL,
      textLength: data.text?.length || 0,
      mimeType,
    });

    return {
      text: data.text || '',
      confidence: 1,
      language,
    };
  } catch (error: any) {
    logger.error('OpenAI audio buffer transcription error', {
      error: error.message,
    });
    throw error;
  }
}

export async function transcribeAudio(audioUrl: string, language: string = 'fr'): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  try {
    ensureOpenAiConfigured();

    const audio = await downloadAudio(audioUrl);
    const formData = new FormData();

    formData.append('file', new Blob([audio.buffer], { type: audio.mimeType }), audio.fileName);
    formData.append('model', OPENAI_STT_MODEL);
    formData.append('language', language);

    const response = await fetch(`${OPENAI_API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json() as { text?: string; error?: { message?: string } };

    if (!response.ok) {
      throw new Error(data.error?.message || 'OpenAI transcription failed');
    }

    logger.info('Audio transcribed with OpenAI', {
      audioUrl,
      model: OPENAI_STT_MODEL,
      textLength: data.text?.length || 0,
    });

    return {
      text: data.text || '',
      confidence: 1,
      language,
    };
  } catch (error: any) {
    logger.error('OpenAI transcription error', {
      error: error.message,
      audioUrl,
    });
    throw error;
  }
}

export async function textToSpeech(text: string, format: string = 'mp3', speed: number = OPENAI_TTS_SPEED): Promise<Buffer> {
  try {
    ensureOpenAiConfigured();
    const resolvedSpeed = clampTtsSpeed(speed);

    const response = await axios.post(
      `${OPENAI_API_URL}/audio/speech`,
      {
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: text,
        response_format: format,
        speed: resolvedSpeed,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        responseType: 'arraybuffer',
      }
    );

    logger.info('Text converted to speech with OpenAI', {
      model: OPENAI_TTS_MODEL,
      speed: resolvedSpeed,
      voice: OPENAI_TTS_VOICE,
      textLength: text.length,
    });

    return Buffer.from(response.data);
  } catch (error: any) {
    logger.error('OpenAI TTS error', { error: error.message });
    throw error;
  }
}

export async function generateResponse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string,
  options: {
    model?: string;
    maxCompletionTokens?: number;
    temperature?: number;
  } = {}
): Promise<string> {
  try {
    ensureOpenAiConfigured();

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await axios.post(
      `${OPENAI_API_URL}/chat/completions`,
      {
        model: options.model || OPENAI_LLM_MODEL,
        messages: allMessages,
        temperature: options.temperature ?? 0.4,
        max_completion_tokens: options.maxCompletionTokens ?? 500,
      },
      {
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = extractTextContent(response.data.choices?.[0]?.message?.content);

    if (!content) {
      throw new Error('No response from OpenAI');
    }

    logger.info('OpenAI response generated', {
      model: options.model || OPENAI_LLM_MODEL,
      messageCount: messages.length,
      responseLength: content.length,
    });

    return content;
  } catch (error: any) {
    logger.error('OpenAI generation error', { error: error.message });
    throw error;
  }
}

export async function detectIntent(transcription: string): Promise<{
  intent: string;
  confidence: number;
  entities: Record<string, unknown>;
}> {
  try {
    if (!hasMeaningfulTranscription(transcription)) {
      return {
        intent: 'autre',
        confidence: 0,
        entities: {},
      };
    }

    const systemPrompt = `Tu analyses des appels entrants pour une PME. Retourne uniquement un JSON valide avec les clés intent, confidence et entities. intent doit être parmi rdv, info, urgence, reclamation, autre.`;

    const response = await generateResponse(
      [{ role: 'user', content: `Analyse cette transcription : ${transcription}` }],
      systemPrompt
    );

    const parsed = JSON.parse(response);

    return {
      intent: parsed.intent || 'autre',
      confidence: parsed.confidence || 0.5,
      entities: parsed.entities || {},
    };
  } catch (error: any) {
    logger.error('OpenAI intent detection error', { error: error.message });
    return {
      intent: 'autre',
      confidence: 0,
      entities: {},
    };
  }
}

export async function summarizeCall(transcription: string): Promise<string> {
  try {
    const normalizedTranscription = normalizeSummaryTranscript(transcription);

    if (!hasMeaningfulTranscription(normalizedTranscription)) {
      return 'Aucun message vocal exploitable n’a été détecté après le bip.';
    }

    return await generateResponse(
      [{ role: 'user', content: buildSummaryPrompt(normalizedTranscription) }],
      'Tu résumes des appels téléphoniques avec prudence et sans halluciner.'
    );
  } catch (error: any) {
    logger.error('OpenAI call summary error', { error: error.message });
    return 'Résumé non disponible';
  }
}
