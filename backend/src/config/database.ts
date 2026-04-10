import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const databaseUrl = process.env.DATABASE_URL || '';
const isLocalDatabase = /localhost|127\.0\.0\.1/i.test(databaseUrl);
const isSslDisabled = process.env.DATABASE_SSL === 'false';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: !databaseUrl || isLocalDatabase || isSslDisabled
    ? false
    : { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Test connection at startup
pool.query('SELECT NOW()')
  .then(() => console.log('✅ Database connected'))
  .catch((err: Error) => console.error('❌ Database connection failed:', err.message));

pool.on('error', (err: Error) => {
  console.error('Unexpected error on idle client', err);
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error: any) {
    const duration = Date.now() - start;
    console.error('Database query failed', {
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
