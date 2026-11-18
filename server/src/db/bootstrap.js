import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool, checkDbHealth } from '../config/db.js';
import { ensureUserProfileColumns } from './migrateProfile.js';
import { seedDatabase } from './seed.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Ensures all MySQL tables exist on the active database, applies schema column migrations,
 * and populates demo market data automatically on first boot if the Users table is empty.
 * Includes brief connection retries for cloud cold starts where MySQL boots in parallel.
 */
export async function ensureDatabaseBootstrapped({ maxAttempts = 6, delayMs = 2500 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await checkDbHealth();
      lastError = null;
      break;
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        console.warn(`[DB] Waiting for MySQL (${attempt}/${maxAttempts}): ${err.message}`);
        await sleep(delayMs);
      }
    }
  }

  if (lastError) {
    throw lastError;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const rawSql = await fs.readFile(schemaPath, 'utf8');

  // Remove database-level CREATE/USE directives so schema executes against env.db.database (e.g. "railway").
  const strippedSql = rawSql
    .replace(/^\s*CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+[^;]+;\s*$/gim, '')
    .replace(/^\s*USE\s+[^;]+;\s*$/gim, '')
    .trim();

  if (strippedSql) {
    await pool.query(strippedSql);
  }

  await ensureUserProfileColumns();

  const [rows] = await pool.query('SELECT COUNT(*) AS count FROM Users');
  const userCount = Number(rows?.[0]?.count || 0);

  if (userCount === 0) {
    console.log('[DB] Empty Users table detected; running initial demo seed...');
    await seedDatabase();
  }
}
