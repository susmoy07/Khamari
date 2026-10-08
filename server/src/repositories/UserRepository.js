import { BaseRepository } from './BaseRepository.js';

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

  async findPublicById(id, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT id, full_name, email, phone, role, organization_name, region, is_verified, created_at
       FROM Users WHERE id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
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
      `INSERT INTO Users (full_name, email, phone, password_hash, role, organization_name, region, is_verified)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [full_name, email, phone, password_hash, role, organization_name, region, is_verified]
    );
    return this.findPublicById(result.insertId);
  }
}
