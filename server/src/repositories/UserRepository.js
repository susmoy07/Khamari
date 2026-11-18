import { BaseRepository } from './BaseRepository.js';

export const PUBLIC_USER_COLUMNS = `
  id, full_name, email, phone, role, organization_name, region,
  is_verified, email_verified, avatar_url, bio, nid_number,
  address, specialty_crops, years_experience, created_at
`;

export function maskNidNumber(nid) {
  if (!nid) return null;
  const raw = String(nid).trim();
  if (raw.length <= 4) return '****';
  return `${'*'.repeat(Math.min(8, raw.length - 4))}${raw.slice(-4)}`;
}

export function sanitizePublicUser(row, { maskNid = false } = {}) {
  if (!row) return null;
  return {
    id: row.id,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    role: row.role,
    organization_name: row.organization_name ?? null,
    region: row.region,
    is_verified: Boolean(row.is_verified),
    email_verified: Boolean(row.email_verified),
    avatar_url: row.avatar_url ?? null,
    bio: row.bio ?? null,
    nid_number: maskNid ? maskNidNumber(row.nid_number) : row.nid_number ?? null,
    address: row.address ?? null,
    specialty_crops: row.specialty_crops ?? null,
    years_experience: row.years_experience ?? null,
    created_at: row.created_at,
  };
}

export class UserRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'Users');
  }

  async findByEmail(email, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT * FROM Users WHERE email = ? LIMIT 1`,
      [email]
    );
    return rows[0] || null;
  }

  async findByPhone(phone, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT * FROM Users WHERE phone = ? LIMIT 1`,
      [phone]
    );
    return rows[0] || null;
  }

  async findByIdPrivate(id, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT * FROM Users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }

  async findPublicById(id, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT ${PUBLIC_USER_COLUMNS}
       FROM Users WHERE id = ? LIMIT 1`,
      [id]
    );
    return sanitizePublicUser(rows[0] || null);
  }

  async createUser({
    full_name,
    email,
    phone,
    password_hash,
    role,
    organization_name = null,
    region,
    is_verified = false,
  }) {
    const [result] = await this.pool.execute(
      `INSERT INTO Users (full_name, email, phone, password_hash, role, organization_name, region, is_verified, email_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, FALSE)`,
      [full_name, email, phone, password_hash, role, organization_name, region, is_verified]
    );
    return this.findPublicById(result.insertId);
  }

  async updateProfile(userId, fields) {
    const allowedColumns = [
      'full_name',
      'phone',
      'organization_name',
      'region',
      'bio',
      'nid_number',
      'address',
      'specialty_crops',
      'years_experience',
      'avatar_url',
    ];
    const updates = [];
    const params = [];

    for (const col of allowedColumns) {
      if (Object.prototype.hasOwnProperty.call(fields, col)) {
        updates.push(`${col} = ?`);
        params.push(fields[col]);
      }
    }

    if (updates.length === 0) {
      return this.findPublicById(userId);
    }

    params.push(userId);
    await this.pool.execute(
      `UPDATE Users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return this.findPublicById(userId);
  }

  async updatePassword(userId, passwordHash) {
    await this.pool.execute(
      `UPDATE Users SET password_hash = ? WHERE id = ?`,
      [passwordHash, userId]
    );
  }

  async saveOtp(userId, { otp_code_hash, otp_expires_at, nid_number = null }) {
    if (nid_number !== null && nid_number !== undefined && String(nid_number).trim() !== '') {
      await this.pool.execute(
        `UPDATE Users
         SET otp_code_hash = ?, otp_expires_at = ?, nid_number = ?
         WHERE id = ?`,
        [otp_code_hash, otp_expires_at, String(nid_number).trim(), userId]
      );
    } else {
      await this.pool.execute(
        `UPDATE Users
         SET otp_code_hash = ?, otp_expires_at = ?
         WHERE id = ?`,
        [otp_code_hash, otp_expires_at, userId]
      );
    }
  }

  async markVerified(userId, { nid_number = null } = {}) {
    if (nid_number !== null && nid_number !== undefined && String(nid_number).trim() !== '') {
      await this.pool.execute(
        `UPDATE Users
         SET is_verified = TRUE, email_verified = TRUE, otp_code_hash = NULL, otp_expires_at = NULL, nid_number = ?
         WHERE id = ?`,
        [String(nid_number).trim(), userId]
      );
    } else {
      await this.pool.execute(
        `UPDATE Users
         SET is_verified = TRUE, email_verified = TRUE, otp_code_hash = NULL, otp_expires_at = NULL
         WHERE id = ?`,
        [userId]
      );
    }
    return this.findPublicById(userId);
  }

  async getPublicProfileWithStats(userId, { maskNid = true } = {}) {
    const [userRows] = await this.pool.execute(
      `SELECT ${PUBLIC_USER_COLUMNS}
       FROM Users WHERE id = ? LIMIT 1`,
      [userId]
    );
    const userRow = userRows[0];
    if (!userRow) return null;

    const [cropRows] = await this.pool.execute(
      `SELECT
         c.*,
         u.full_name AS farmer_name,
         u.phone AS farmer_phone,
         u.region AS farmer_region,
         u.is_verified AS farmer_verified,
         u.avatar_url AS farmer_avatar,
         bp.min_price AS bazaar_min_price,
         bp.modal_price AS bazaar_modal_price,
         bp.max_price AS bazaar_max_price
       FROM Crops c
       INNER JOIN Users u ON u.id = c.farmer_id
       LEFT JOIN BazaarPrices bp ON bp.id = c.bazaar_price_id
       WHERE c.farmer_id = ? AND c.status = 'AVAILABLE'
       ORDER BY c.created_at DESC
       LIMIT 6`,
      [userId]
    );

    const [cropCountRows] = await this.pool.execute(
      `SELECT COUNT(*) AS total_listings FROM Crops WHERE farmer_id = ?`,
      [userId]
    );

    const [orderRows] = await this.pool.execute(
      `SELECT
         COUNT(*) AS total_orders,
         COALESCE(SUM(CASE WHEN order_status = 'DELIVERED' THEN 1 ELSE 0 END), 0) AS delivered_orders
       FROM Orders
       WHERE farmer_id = ? OR buyer_id = ?`,
      [userId, userId]
    );

    const [bazaarRows] = await this.pool.execute(
      `SELECT COUNT(*) AS published_prices FROM BazaarPrices WHERE verified_by = ?`,
      [userId]
    );

    return {
      profile: sanitizePublicUser(userRow, { maskNid }),
      stats: {
        total_listings: Number(cropCountRows[0]?.total_listings || 0),
        active_listings: cropRows.length,
        total_orders: Number(orderRows[0]?.total_orders || 0),
        delivered_orders: Number(orderRows[0]?.delivered_orders || 0),
        published_prices: Number(bazaarRows[0]?.published_prices || 0),
      },
      crops: cropRows,
    };
  }
}
