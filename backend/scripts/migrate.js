/**
 * Database migration runner
 * Applies pending SQL migrations from database/migrations/ in order.
 * Tracks applied migrations in a `schema_migrations` table.
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Try loading .env from multiple locations (repo root or backend/)
const envPaths = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    require('dotenv').config({ path: p });
    break;
  }
}

// DATABASE_URL_DIRECT prend la priorité (utile sur Ploi où DATABASE_URL est au format SSH propriétaire)
const rawUrl = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL;
const dbUrl = rawUrl;

console.log('URL utilisée (début):', rawUrl ? rawUrl.substring(0, 50) + '...' : '(vide)');

if (!rawUrl || rawUrl.includes('+ssh') || rawUrl.includes('usePrivateKey')) {
  console.error('\nERROR: URL invalide pour une connexion pg directe.');
  console.error('Sur Ploi, ajoute cette variable dans ton site → Environment Variables :');
  console.error('  DATABASE_URL_DIRECT=postgresql://ploi:MOT_DE_PASSE@127.0.0.1:5432/receptiodev');
  console.error('Trouve le mot de passe dans Ploi → Databases → ta base.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: dbUrl,
  ssl: /localhost|127\.0\.0\.1/i.test(dbUrl)
    ? false
    : { rejectUnauthorized: false },
});

const MIGRATIONS_DIR = path.resolve(__dirname, '../../database/migrations');

async function ensureExtensions(client) {
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
}

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
    await ensureExtensions(client);
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
