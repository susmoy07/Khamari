import { env } from '../config/env.js';
import { pool } from '../config/db.js';

const USER_PROFILE_COLUMNS = [
  ['email_verified', 'BOOLEAN NOT NULL DEFAULT FALSE'],
  ['avatar_url', 'VARCHAR(255) NULL'],
  ['bio', 'TEXT NULL'],
  ['nid_number', 'VARCHAR(50) NULL'],
  ['address', 'VARCHAR(255) NULL'],
  ['specialty_crops', 'VARCHAR(255) NULL'],
  ['years_experience', 'INT UNSIGNED NULL'],
  ['otp_code_hash', 'VARCHAR(255) NULL'],
  ['otp_expires_at', 'DATETIME NULL'],
];

/**
 * Idempotently ensures new profile, avatar, and email-OTP verification columns
 * exist on the `Users` table for already-initialized local MySQL databases.
 */
export async function ensureUserProfileColumns() {
  const [rows] = await pool.execute(
    `SELECT COLUMN_NAME
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'Users'`,
    [env.db.database]
  );

  const existing = new Set(rows.map((r) => r.COLUMN_NAME));
  for (const [col, definition] of USER_PROFILE_COLUMNS) {
    if (!existing.has(col)) {
      await pool.query(`ALTER TABLE Users ADD COLUMN ${col} ${definition}`);
    }
  }
}
