import axios from 'axios';
import logger from '../utils/logger';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1';
const DEFAULT_DEEPGRAM_STT_MODEL = 'nova-2';
const DEFAULT_DEEPGRAM_TTS_MODEL = 'aura-asteria-fr';

function ensureDeepgramConfigured() {
  if (!DEEPGRAM_API_KEY) {
    throw new Error('DEEPGRAM_API_KEY not configured');
  }
}

export async function transcribeAudio(audioUrl: string, language: string = 'fr'): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  try {
    ensureDeepgramConfigured();

    const response = await axios.post(
      `${DEEPGRAM_API_URL}/listen`,
      {
        url: audioUrl,
      },
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          model: DEFAULT_DEEPGRAM_STT_MODEL,
          language,
          punctuate: true,
          diarize: false,
          smart_format: true,
        },
      }
    );

    const transcript = response.data.results?.channels[0]?.alternatives[0];

    if (!transcript) {
      throw new Error('No transcription result');
    }

    logger.info('Audio transcribed', {
      audioUrl,
      confidence: transcript.confidence,
      wordCount: transcript.words?.length
    });

    return {
      text: transcript.transcript,
      confidence: transcript.confidence,
      language,
    };
  } catch (error: any) {
    logger.error('Deepgram transcription error', {
      error: error.message,
      audioUrl
    });
    throw error;
  }
}

export async function transcribeAudioBuffer(audioBuffer: Buffer, options: {
  language?: string;
  mimeType?: string;
  model?: string;
} = {}): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  try {
    ensureDeepgramConfigured();

    const language = options.language || 'fr';
    const mimeType = options.mimeType || 'audio/wav';
    const response = await axios.post(
      `${DEEPGRAM_API_URL}/listen`,
      audioBuffer,
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': mimeType,
        },
        params: {
          model: options.model || DEFAULT_DEEPGRAM_STT_MODEL,
          language,
          punctuate: true,
          diarize: false,
          smart_format: true,
        },
      }
    );

    const transcript = response.data.results?.channels[0]?.alternatives[0];

    if (!transcript) {
      throw new Error('No transcription result');
    }

    logger.info('Audio buffer transcribed', {
      confidence: transcript.confidence,
      language,
      mimeType,
      textLength: transcript.transcript?.length || 0,
    });

    return {
      text: transcript.transcript,
      confidence: transcript.confidence,
      language,
    };
  } catch (error: any) {
    logger.error('Deepgram audio buffer transcription error', {
      error: error.message,
    });
    throw error;
  }
}

export async function textToSpeech(text: string, format: 'wav' | 'linear16' = 'linear16', _language: string = 'fr', options: {
  model?: string;
  voice?: string;
} = {}): Promise<Buffer> {
  try {
    ensureDeepgramConfigured();

    const response = await axios.post(
      `${DEEPGRAM_API_URL}/speak`,
      {
        text,
      },
      {
        headers: {
          'Authorization': `Token ${DEEPGRAM_API_KEY}`,
          'Content-Type': 'application/json',
        },
        params: {
          model: options.voice || options.model || DEFAULT_DEEPGRAM_TTS_MODEL,
          encoding: 'linear16',
          sample_rate: 24000,
          container: format === 'wav' ? 'wav' : 'none',
        },
        responseType: 'arraybuffer',
      }
    );

    logger.info('Text converted to speech', {
      format,
      model: options.voice || options.model || DEFAULT_DEEPGRAM_TTS_MODEL,
      textLength: text.length,
    });

    return Buffer.from(response.data);
  } catch (error: any) {
    logger.error('Deepgram TTS error', { error: error.message });
    throw error;
  }
}
