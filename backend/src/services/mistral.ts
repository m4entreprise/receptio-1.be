import axios from 'axios';
import logger from '../utils/logger';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1';
const DEFAULT_MISTRAL_LLM_MODEL = 'mistral-small-latest';
const DEFAULT_MISTRAL_STT_MODEL = 'voxtral-mini-latest';
const DEFAULT_MISTRAL_TTS_MODEL = 'voxtral-mini-tts-2603';

function ensureMistralConfigured() {
  if (!MISTRAL_API_KEY) {
    throw new Error('MISTRAL_API_KEY not configured');
  }
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

    const response = await axios.post(
      `${MISTRAL_API_URL}/audio/speech`,
      {
        model: options.model || DEFAULT_MISTRAL_TTS_MODEL,
        input: text,
        voice_id: options.voice || undefined,
        response_format: format,
      },
      {
        headers: {
          Authorization: `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const audioData = response.data?.audio_data;

    if (typeof audioData !== 'string' || !audioData) {
      throw new Error('Mistral TTS returned no audio_data');
    }

    logger.info('Text converted to speech with Mistral', {
      model: options.model || DEFAULT_MISTRAL_TTS_MODEL,
      voice: options.voice || null,
      format,
      textLength: text.length,
    });

    return Buffer.from(audioData, 'base64');
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
    const systemPrompt = `Tu es un assistant qui résume les appels téléphoniques de manière concise et professionnelle.`;

    const response = await generateResponse(
      [{ role: 'user', content: `Résume cet appel en 2-3 phrases: "${transcription}"` }],
      systemPrompt
    );

    return response;
  } catch (error: any) {
    logger.error('Call summary error', { error: error.message });
    return 'Résumé non disponible';
  }
}
