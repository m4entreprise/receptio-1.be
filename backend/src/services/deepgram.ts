import axios from 'axios';
import logger from '../utils/logger';

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1';

export async function transcribeAudio(audioUrl: string, language: string = 'fr'): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  try {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

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
          model: 'nova-2',
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

export async function textToSpeech(text: string, _language: string = 'fr'): Promise<Buffer> {
  try {
    if (!DEEPGRAM_API_KEY) {
      throw new Error('DEEPGRAM_API_KEY not configured');
    }

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
          model: 'aura-asteria-fr',
          encoding: 'linear16',
          sample_rate: 24000,
        },
        responseType: 'arraybuffer',
      }
    );

    logger.info('Text converted to speech', { textLength: text.length });

    return Buffer.from(response.data);
  } catch (error: any) {
    logger.error('Deepgram TTS error', { error: error.message });
    throw error;
  }
}
