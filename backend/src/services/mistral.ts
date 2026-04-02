import axios from 'axios';
import logger from '../utils/logger';

const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
const MISTRAL_API_URL = 'https://api.mistral.ai/v1';

export async function generateResponse(
  messages: Array<{ role: string; content: string }>,
  systemPrompt?: string
): Promise<string> {
  try {
    if (!MISTRAL_API_KEY) {
      throw new Error('MISTRAL_API_KEY not configured');
    }

    const allMessages = systemPrompt
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    const response = await axios.post(
      `${MISTRAL_API_URL}/chat/completions`,
      {
        model: 'mistral-small-latest',
        messages: allMessages,
        temperature: 0.7,
        max_tokens: 500,
      },
      {
        headers: {
          'Authorization': `Bearer ${MISTRAL_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const content = response.data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from Mistral AI');
    }

    logger.info('Mistral AI response generated', {
      messageCount: messages.length,
      responseLength: content.length,
    });

    return content;
  } catch (error: any) {
    logger.error('Mistral AI error', { error: error.message });
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
