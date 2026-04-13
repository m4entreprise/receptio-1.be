import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL || '';
const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(databaseUrl);
const isSslDisabled = process.env.DATABASE_SSL === 'false';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: !databaseUrl || isLocalDatabase || isSslDisabled
    ? false
    : { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 600000,   // 10 min — garde les connexions vivantes entre les requêtes
  connectionTimeoutMillis: 10000, // 10 sec — laisse le temps si le serveur est sous charge
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Test connection at startup
pool.query('SELECT NOW()')
  .then(() => logger.info('Database connected'))
  .catch((err: Error) => logger.error('Database connection failed', { error: err.message }));

pool.on('error', (err: Error) => {
  logger.error('Unexpected error on idle PostgreSQL client', {
    error: err.message,
    stack: err.stack,
  });
});

pool.on('connect', () => {
  logger.debug('PostgreSQL client connected');
});

pool.on('remove', () => {
  logger.warn('PostgreSQL client removed from pool');
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error: any) {
    const duration = Date.now() - start;
    logger.error('Database query failed', {
      text,
      duration,
      error: error.message,
      code: error.code,
      detail: error.detail,
      hint: error.hint,
    });
    throw error;
  }
};

export const getClient = () => {
  return pool.connect();
};

export default pool;
