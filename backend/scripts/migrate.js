/**
 * Database migration runner
 * Applies pending SQL migrations from database/migrations/ in order.
 * Tracks applied migrations in a `schema_migrations` table.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /localhost|127\.0\.0\.1/i.test(process.env.DATABASE_URL || '')
    ? false
    : { rejectUnauthorized: false },
});

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version     VARCHAR(255) PRIMARY KEY,
      applied_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);
}

async function getAppliedMigrations(client) {
  const res = await client.query('SELECT version FROM schema_migrations ORDER BY version');
  return new Set(res.rows.map(r => r.version));
}

async function run() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    const files = fs.readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) {
        console.log(`  skip  ${file}`);
        continue;
      }

      const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
      console.log(`  apply ${file}`);
      await client.query(sql);
      await client.query('INSERT INTO schema_migrations (version) VALUES ($1)', [file]);
      count++;
    }

    await client.query('COMMIT');
    console.log(`\nDone — ${count} migration(s) applied.`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\nMigration failed, rolled back:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
