import axios from 'axios';
import logger from '../utils/logger';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@receptio.be';

export async function sendTranscriptionEmail(
  to: string,
  callData: {
    callerNumber: string;
    transcription: string;
    duration: number;
    createdAt: Date;
  }
): Promise<void> {
  try {
    if (!RESEND_API_KEY) {
      logger.warn('RESEND_API_KEY not configured, skipping email');
      return;
    }

    const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
    .info { background: white; padding: 15px; border-radius: 6px; margin: 10px 0; }
    .label { font-weight: bold; color: #6B7280; }
    .transcription { background: white; padding: 15px; border-left: 4px solid #4F46E5; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>📞 Nouveau message vocal</h2>
    </div>
    <div class="content">
      <div class="info">
        <p><span class="label">De:</span> ${callData.callerNumber}</p>
        <p><span class="label">Date:</span> ${new Date(callData.createdAt).toLocaleString('fr-BE')}</p>
        <p><span class="label">Durée:</span> ${callData.duration} secondes</p>
      </div>
      
      <div class="transcription">
        <p class="label">Transcription:</p>
        <p>${callData.transcription}</p>
      </div>
      
      <p style="text-align: center; margin-top: 20px;">
        <a href="https://dashboard.receptio.be" style="background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          Voir dans le dashboard
        </a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    await axios.post(
      'https://api.resend.com/emails',
      {
        from: FROM_EMAIL,
        to,
        subject: `Nouveau message vocal de ${callData.callerNumber}`,
        html,
      },
      {
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('Transcription email sent', { to, callerNumber: callData.callerNumber });
  } catch (error: any) {
    logger.error('Email sending error', { error: error.message, to });
    throw error;
  }
}
