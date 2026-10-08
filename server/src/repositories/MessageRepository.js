import { BaseRepository } from './BaseRepository.js';

export class MessageRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'Messages');
  }

  async findByNegotiationId(negotiationId) {
    const [rows] = await this.pool.execute(
      `SELECT
        m.*,
        u.full_name AS sender_name,
        u.role AS sender_role
       FROM Messages m
       INNER JOIN Users u ON u.id = m.sender_id
       WHERE m.negotiation_id = ?
       ORDER BY m.created_at ASC, m.id ASC`,
      [negotiationId]
    );
    return rows;
  }

  async createMessage({
    negotiation_id,
    sender_id,
    message_type = 'TEXT',
    content,
    offered_unit_price = null,
    offered_quantity = null,
  }) {
    const [result] = await this.pool.execute(
      `INSERT INTO Messages (
         negotiation_id, sender_id, message_type, content, offered_unit_price, offered_quantity
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        negotiation_id,
        sender_id,
        message_type,
        content,
        offered_unit_price,
        offered_quantity,
      ]
    );

    const [rows] = await this.pool.execute(
      `SELECT
        m.*,
        u.full_name AS sender_name,
        u.role AS sender_role
       FROM Messages m
       INNER JOIN Users u ON u.id = m.sender_id
       WHERE m.id = ?
       LIMIT 1`,
      [result.insertId]
    );
    return rows[0] || null;
  }

  async markRoomRead(negotiationId, readerUserId) {
    await this.pool.execute(
      `UPDATE Messages
       SET is_read = TRUE
       WHERE negotiation_id = ? AND sender_id != ? AND is_read = FALSE`,
      [negotiationId, readerUserId]
    );
  }
}
