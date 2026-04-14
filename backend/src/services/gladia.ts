import axios from 'axios';
import FormData from 'form-data';
import logger from '../utils/logger';

const GLADIA_API_KEY = process.env.GLADIA_API_KEY;
const GLADIA_API_URL = 'https://api.gladia.io';

function ensureGladiaConfigured() {
  if (!GLADIA_API_KEY) {
    throw new Error('GLADIA_API_KEY not configured');
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function transcribeAudioBuffer(
  audioBuffer: Buffer,
  options: {
    language?: string;
    mimeType?: string;
    model?: string;
  } = {}
): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  ensureGladiaConfigured();

  const language = options.language || 'fr';
  const mimeType = options.mimeType || 'audio/wav';
  const fileName = mimeType.includes('mp3') ? 'audio.mp3' : 'audio.wav';

  // Step 1: Upload audio
  const uploadForm = new FormData();
  uploadForm.append('audio', audioBuffer, { filename: fileName, contentType: mimeType });

  const uploadResponse = await axios.post(`${GLADIA_API_URL}/v2/upload`, uploadForm, {
    headers: {
      'x-gladia-key': GLADIA_API_KEY!,
      ...uploadForm.getHeaders(),
    },
  });

  const audioUrl: string = uploadResponse.data?.audio_url;
  if (!audioUrl) {
    throw new Error('Gladia upload failed: no audio_url returned');
  }

  // Step 2: Submit transcription job
  const jobResponse = await axios.post(
    `${GLADIA_API_URL}/v2/pre-recorded/`,
    {
      audio_url: audioUrl,
      language,
      diarization: false,
    },
    {
      headers: {
        'x-gladia-key': GLADIA_API_KEY!,
        'Content-Type': 'application/json',
      },
    }
  );

  const jobId: string = jobResponse.data?.id;
  if (!jobId) {
    throw new Error('Gladia transcription job failed: no id returned');
  }

  // Step 3: Poll until done
  const maxAttempts = 30;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(500);

    const resultResponse = await axios.get(`${GLADIA_API_URL}/v2/pre-recorded/${jobId}`, {
      headers: { 'x-gladia-key': GLADIA_API_KEY! },
    });

    const status: string = resultResponse.data?.status;

    if (status === 'done') {
      const fullTranscript: string = resultResponse.data?.result?.transcription?.full_transcript || '';

      logger.info('Audio buffer transcribed with Gladia', {
        jobId,
        language,
        mimeType,
        textLength: fullTranscript.length,
      });

      return {
        text: fullTranscript,
        confidence: 1,
        language,
      };
    }

    if (status === 'error') {
      throw new Error(`Gladia transcription failed: ${resultResponse.data?.error_code || 'unknown error'}`);
    }
  }

  throw new Error('Gladia transcription timed out after polling');
}

export async function transcribeAudioUrl(
  audioUrl: string,
  language: string = 'fr'
): Promise<{
  text: string;
  confidence: number;
  language: string;
}> {
  ensureGladiaConfigured();

  const jobResponse = await axios.post(
    `${GLADIA_API_URL}/v2/pre-recorded/`,
    {
      audio_url: audioUrl,
      language,
      diarization: false,
    },
    {
      headers: {
        'x-gladia-key': GLADIA_API_KEY!,
        'Content-Type': 'application/json',
      },
    }
  );

  const jobId: string = jobResponse.data?.id;
  if (!jobId) {
    throw new Error('Gladia transcription job failed: no id returned');
  }

  const maxAttempts = 60;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    await sleep(1000);

    const resultResponse = await axios.get(`${GLADIA_API_URL}/v2/pre-recorded/${jobId}`, {
      headers: { 'x-gladia-key': GLADIA_API_KEY! },
    });

    const status: string = resultResponse.data?.status;

    if (status === 'done') {
      const fullTranscript: string = resultResponse.data?.result?.transcription?.full_transcript || '';

      logger.info('Audio URL transcribed with Gladia', {
        jobId,
        audioUrl,
        language,
        textLength: fullTranscript.length,
      });

      return {
        text: fullTranscript,
        confidence: 1,
        language,
      };
    }

    if (status === 'error') {
      throw new Error(`Gladia transcription failed: ${resultResponse.data?.error_code || 'unknown error'}`);
    }
  }

  throw new Error('Gladia transcription timed out after polling');
}
