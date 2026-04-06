import axios from 'axios';
import logger from '../utils/logger';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_LLM_MODEL = 'mistral-small-latest';
const DEFAULT_MISTRAL_STT_MODEL = 'voxtral-mini-latest';
const DEFAULT_MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603';
const MISTRAL_TTS_TIMEOUT_MS = Number(process.env.MISTRAL_TTS_TIMEOUT_MS || 30000);
const MISTRAL_TTS_MAX_RETRIES = Math.max(1, Number(process.env.MISTRAL_TTS_MAX_RETRIES || 3));

function ensureMistralConfigured() {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY not configured');
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function extractApiErrorMessage(error: any): string {
  const responseData = error?.response?.data;

  if (typeof responseData === 'string' && responseData.trim()) {
    return responseData;
  }

  if (responseData && typeof responseData === 'object') {
    const nestedMessage = responseData.error?.message || responseData.message || responseData.detail;
    if (typeof nestedMessage === 'string' && nestedMessage.trim()) {
      return nestedMessage;
    }
  }

  return error?.message || 'Unknown Mistral API error';
}

function isRetryableMistralTtsError(error: any): boolean {
  const status = error?.response?.status;
  return status === 408 || status === 409 || status === 425 || status === 429 || (typeof status === 'number' && status >= 500);
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
    ensureMistralConfigured();

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await axios.post(
      `${MISTRAL_API_URL}/chat/completions`,
      {
        model: options.model || DEFAULT_MISTRAL_LLM_MODEL,
        messages: allMessages,
        temperature: options.temperature ?? 0.4,
        max_tokens: options.maxCompletionTokens ?? 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = extractTextContent(response.data.choices?.[0]?.message?.content);

    if (!content) {
      throw new Error('No response from Mistral AI');
    }

    logger.info('Mistral AI response generated', {
      model: options.model || DEFAULT_MISTRAL_LLM_MODEL,
      messageCount: messages.length,
      responseLength: content.length,
    });

    return content;
  } catch (error: any) {
    logger.error('Mistral AI error', { error: error.message });
    throw error;
  }
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  options: {
    fileName?: string;
    language?: string;
    mimeType?: string;
    model?: string;
  } = {}
): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  try {
    ensureMistralConfigured();

    const formData = new FormData();
    const language = options.language || 'fr';
    const mimeType = options.mimeType || 'audio/wav';
    const fileName = options.fileName || 'audio.wav';

    formData.append('file', new Blob([audioBuffer], { type: mimeType }), fileName);
    formData.append('model', options.model || DEFAULT_MISTRAL_STT_MODEL);
    formData.append('language', language);
    formData.append('diarize', 'false');

    const response = await fetch(`${MISTRAL_API_URL}/audio/transcriptions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MISTRAL_API_KEY}`,
      },
      body: formData,
    });

    const data = await response.json() as {
      text?: string;
      language?: string;
      segments?: Array<{ avg_logprob?: number }>;
      error?: { message?: string };
    };

    if (!response.ok) {
      throw new Error(data.error?.message || 'Mistral transcription failed');
    }

    logger.info('Audio buffer transcribed with Mistral', {
      model: options.model || DEFAULT_MISTRAL_STT_MODEL,
      mimeType,
      textLength: data.text?.length || 0,
    });

    return {
      text: data.text || '',
      confidence: typeof data.segments?.[0]?.avg_logprob === 'number' ? Math.exp(data.segments[0].avg_logprob) : 1,
      language: data.language || language,
    };
  } catch (error: any) {
    logger.error('Mistral audio buffer transcription error', {
      error: error.message,
    });
    throw error;
  }
}

export async function textToSpeech(
  text: string,
  format: 'wav' | 'mp3' | 'pcm' | 'flac' | 'opus' = 'wav',
  _language: string = 'fr',
  options: {
    model?: string;
    voice?: string;
  } = {}
): Promise<Buffer> {
  try {
    ensureMistralConfigured();
    const model = options.model || DEFAULT_MISTRAL_TTS_MODEL;

    for (let attempt = 1; attempt <= MISTRAL_TTS_MAX_RETRIES; attempt += 1) {
      try {
        const response = await axios.post(
          `${MISTRAL_API_URL}/audio/speech`,
          {
            model,
            input: text,
            voice_id: options.voice || undefined,
            response_format: format,
          },
          {
            headers: {
              Authorization: `Bearer ${MISTRAL_API_KEY}`,
              'Content-Type': 'application/json',
            },
            timeout: MISTRAL_TTS_TIMEOUT_MS,
          }
        );

        const audioData = response.data?.audio_data;

        if (typeof audioData !== 'string' || !audioData) {
          logger.error('Mistral TTS response missing audio_data', {
            model,
            voice: options.voice || null,
            format,
            attempt,
            responseKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : null,
          });
          throw new Error('Mistral TTS returned no audio_data');
        }

        logger.info('Text converted to speech with Mistral', {
          model,
          voice: options.voice || null,
          format,
          attempt,
          textLength: text.length,
        });

        return Buffer.from(audioData, 'base64');
      } catch (error: any) {
        const status = error?.response?.status || null;
        const apiErrorMessage = extractApiErrorMessage(error);
        const retryable = isRetryableMistralTtsError(error);

        logger.warn('Mistral TTS request failed', {
          attempt,
          maxRetries: MISTRAL_TTS_MAX_RETRIES,
          model,
          voice: options.voice || null,
          format,
          textLength: text.length,
          status,
          retryable,
          error: apiErrorMessage,
        });

        if (!retryable || attempt >= MISTRAL_TTS_MAX_RETRIES) {
          throw new Error(apiErrorMessage);
        }

        await sleep(300 * attempt);
      }
    }

    throw new Error('Mistral TTS failed after retries');
  } catch (error: any) {
    logger.error('Mistral TTS error', { error: error.message });
    throw error;
  }
}

export async function detectIntent(transcription: string): Promise<{
  intent: string;
  confidence: number;
  entities: Record<string, any>;
}> {
  try {
    const systemPrompt = `Tu es un assistant qui analyse les intentions des appelants.
Retourne un JSON avec: intent (rdv|info|urgence|reclamation|autre), confidence (0-1), entities (données extraites).`;

    const response = await generateResponse(
      [{ role: 'user', content: `Analyse cette transcription: "${transcription}"` }],
      systemPrompt
    );

    const parsed = JSON.parse(response);

    return {
      intent: parsed.intent || 'autre',
      confidence: parsed.confidence || 0.5,
      entities: parsed.entities || {},
    };
  } catch (error: any) {
    logger.error('Intent detection error', { error: error.message });
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

    const systemPrompt = 'Tu résumes des appels téléphoniques avec prudence et sans halluciner.';

    const response = await generateResponse(
      [{ role: 'user', content: buildSummaryPrompt(normalizedTranscription) }],
      systemPrompt
    );

    return response;
  } catch (error: any) {
    logger.error('Call summary error', { error: error.message });
    return 'Résumé non disponible';
  }
}
