import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { connectRedis } from './config/redis';
import { query } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { attachTwilioMediaStreamsServer } from './services/twilioMediaStreams';
import logger from './utils/logger';

import authRoutes from './routes/auth';
import callsRoutes from './routes/calls';
import companiesRoutes from './routes/companies';
import knowledgeBaseRoutes from './routes/knowledgeBase';
import monitoringRoutes from './routes/monitoring';
import webhooksRoutes from './routes/webhooks';
import staffRoutes from './routes/staff';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP',
});

app.use('/api/', limiter);

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/knowledge-base', knowledgeBaseRoutes);
app.use('/api/monitoring', monitoringRoutes);
app.use('/api/webhooks', webhooksRoutes);
app.use('/api/staff', staffRoutes);

app.use(errorHandler);

const server = createServer(app);
attachTwilioMediaStreamsServer(server);

async function cleanupOrphanCalls() {
  try {
    const result = await query(
      `UPDATE calls
       SET status = 'completed', ended_at = COALESCE(ended_at, CURRENT_TIMESTAMP),
           queue_status = CASE WHEN queue_status = 'waiting' THEN 'abandoned' ELSE queue_status END
       WHERE status NOT IN ('completed', 'missed', 'transferred', 'canceled')
         AND created_at < NOW() - INTERVAL '2 hours'
       RETURNING id`
    );
    if (result.rowCount && result.rowCount > 0) {
      logger.info(`Orphan cleanup: marked ${result.rowCount} stale calls as completed`);
    }
  } catch (error: any) {
    logger.warn('Orphan call cleanup failed', { error: error.message });
  }
}

const startServer = async () => {
  try {
    await connectRedis();
    logger.info('Redis connected');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      console.log(`🚀 Receptio API running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/health`);
    });

    await cleanupOrphanCalls();
    setInterval(cleanupOrphanCalls, 10 * 60 * 1000);
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

startServer();
