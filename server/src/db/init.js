import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerConnection } from '../config/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function initializeDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const sql = await fs.readFile(schemaPath, 'utf8');
  const connection = await createServerConnection();
  try {
    await connection.query(sql);
    console.log('[DB:Init] Schema verified/initialized successfully.');
  } finally {
    await connection.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  initializeDatabase()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DB:Init] Failed:', err.message);
      process.exit(1);
    });
}
