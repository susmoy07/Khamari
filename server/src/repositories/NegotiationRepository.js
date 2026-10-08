import { BaseRepository } from './BaseRepository.js';

export class NegotiationRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'Negotiations');
  }

  async findForUser(userId) {
    const [rows] = await this.pool.execute(
      `SELECT
        n.*,
        c.title AS crop_title,
        c.crop_category,
        c.unit,
        c.bazaar_region,
        c.base_price_per_unit,
        c.quantity_available,
        c.bulk_threshold_qty,
        c.bulk_discount_pct,
        b.full_name AS buyer_name,
        b.role AS buyer_role,
        b.organization_name AS buyer_organization,
        f.full_name AS farmer_name,
        bp.min_price AS bazaar_min_price,
        bp.modal_price AS bazaar_modal_price,
        bp.max_price AS bazaar_max_price
       FROM Negotiations n
       INNER JOIN Crops c ON c.id = n.crop_id
       INNER JOIN Users b ON b.id = n.buyer_id
       INNER JOIN Users f ON f.id = n.farmer_id
       LEFT JOIN BazaarPrices bp ON bp.id = c.bazaar_price_id
       WHERE n.buyer_id = ? OR n.farmer_id = ?
       ORDER BY n.updated_at DESC`,
      [userId, userId]
    );
    return rows;
  }

  async findDetailedById(negotiationId, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT
        n.*,
        c.title AS crop_title,
        c.crop_category,
        c.unit,
        c.bazaar_region,
        c.base_price_per_unit,
        c.quantity_available,
        c.min_order_quantity,
        c.bulk_threshold_qty,
        c.bulk_discount_pct,
        c.quality_grade,
        b.full_name AS buyer_name,
        b.role AS buyer_role,
        b.organization_name AS buyer_organization,
        b.phone AS buyer_phone,
        f.full_name AS farmer_name,
        f.phone AS farmer_phone,
        bp.min_price AS bazaar_min_price,
        bp.modal_price AS bazaar_modal_price,
        bp.max_price AS bazaar_max_price
       FROM Negotiations n
       INNER JOIN Crops c ON c.id = n.crop_id
       INNER JOIN Users b ON b.id = n.buyer_id
       INNER JOIN Users f ON f.id = n.farmer_id
       LEFT JOIN BazaarPrices bp ON bp.id = c.bazaar_price_id
       WHERE n.id = ?
       LIMIT 1`,
      [negotiationId]
    );
    return rows[0] || null;
  }

  async createNegotiation({
    crop_id,
    buyer_id,
    farmer_id,
    requested_quantity,
    current_offer_price,
    last_offered_by = 'BUYER',
    expires_at = null,
  }) {
    const [result] = await this.pool.execute(
      `INSERT INTO Negotiations (
         crop_id, buyer_id, farmer_id, requested_quantity,
         current_offer_price, last_offered_by, status, expires_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'OPEN', ?)`,
      [
        crop_id,
        buyer_id,
        farmer_id,
        requested_quantity,
        current_offer_price,
        last_offered_by,
        expires_at,
      ]
    );
    return this.findDetailedById(result.insertId);
  }

  async updateOffer(negotiationId, { requested_quantity, current_offer_price, last_offered_by }) {
    await this.pool.execute(
      `UPDATE Negotiations
       SET requested_quantity = ?, current_offer_price = ?, last_offered_by = ?, status = 'COUNTERED'
       WHERE id = ?`,
      [requested_quantity, current_offer_price, last_offered_by, negotiationId]
    );
    return this.findDetailedById(negotiationId);
  }

  async updateStatus(negotiationId, status, connection = null) {
    const executor = this.getExecutor(connection);
    await executor.execute(
      `UPDATE Negotiations SET status = ? WHERE id = ?`,
      [status, negotiationId]
    );
    return this.findDetailedById(negotiationId, connection);
  }
}
