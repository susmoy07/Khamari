import { BaseRepository } from './BaseRepository.js';

export class OrderRepository extends BaseRepository {
  constructor(pool, cropRepo, negotiationRepo) {
    super(pool, 'Orders');
    this.cropRepo = cropRepo;
    this.negotiationRepo = negotiationRepo;
  }

  generateReceiptNumber() {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const rand = Math.floor(10000 + Math.random() * 90000);
    return `KHM-${y}${m}${d}-${rand}`;
  }

  async findByUserId(userId) {
    const [rows] = await this.pool.execute(
      `SELECT
        o.*,
        c.title AS crop_title,
        c.crop_category,
        c.bazaar_region,
        c.quality_grade,
        b.full_name AS buyer_name,
        b.organization_name AS buyer_organization,
        b.role AS buyer_role,
        f.full_name AS farmer_name,
        f.phone AS farmer_phone
       FROM Orders o
       INNER JOIN Crops c ON c.id = o.crop_id
       INNER JOIN Users b ON b.id = o.buyer_id
       INNER JOIN Users f ON f.id = o.farmer_id
       WHERE o.buyer_id = ? OR o.farmer_id = ?
       ORDER BY o.created_at DESC`,
      [userId, userId]
    );
    return rows;
  }

  async findDetailedById(orderId, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT
        o.*,
        c.title AS crop_title,
        c.crop_category,
        c.variety AS crop_variety,
        c.bazaar_region,
        c.quality_grade,
        c.bazaar_price_id,
        b.full_name AS buyer_name,
        b.email AS buyer_email,
        b.phone AS buyer_phone,
        b.organization_name AS buyer_organization,
        b.role AS buyer_role,
        f.full_name AS farmer_name,
        f.email AS farmer_email,
        f.phone AS farmer_phone,
        bp.min_price AS bazaar_min_price,
        bp.modal_price AS bazaar_modal_price,
        bp.max_price AS bazaar_max_price,
        bp.effective_date AS bazaar_effective_date
       FROM Orders o
       INNER JOIN Crops c ON c.id = o.crop_id
       INNER JOIN Users b ON b.id = o.buyer_id
       INNER JOIN Users f ON f.id = o.farmer_id
       LEFT JOIN BazaarPrices bp ON bp.id = c.bazaar_price_id
       WHERE o.id = ?
       LIMIT 1`,
      [orderId]
    );
    return rows[0] || null;
  }

  async createOrderAtomic({
    crop_id,
    negotiation_id = null,
    buyer_id,
    farmer_id,
    quantity_ordered,
    unit_price_agreed,
    subtotal_amount,
    discount_amount,
    total_amount,
    pricing_strategy_used,
    receipt_type,
    payment_status = 'ESCROW_HELD',
    delivery_address,
  }) {
    return this.withTransaction(async (connection) => {
      const updatedCrop = await this.cropRepo.lockAndDeductStock(
        crop_id,
        quantity_ordered,
        connection
      );

      if (negotiation_id) {
        const [negRows] = await connection.execute(
          `SELECT id, status FROM Negotiations WHERE id = ? FOR UPDATE`,
          [negotiation_id]
        );
        const neg = negRows[0];
        if (!neg || !['OPEN', 'COUNTERED', 'ACCEPTED'].includes(neg.status)) {
          const err = new Error('Negotiation cannot be converted into an order.');
          err.statusCode = 409;
          err.code = 'NEGOTIATION_NOT_ACTIVE';
          throw err;
        }
        await connection.execute(
          `UPDATE Negotiations SET status = 'ACCEPTED' WHERE id = ?`,
          [negotiation_id]
        );
      }

      const receiptNumber = this.generateReceiptNumber();
      const [result] = await connection.execute(
        `INSERT INTO Orders (
           receipt_number, crop_id, negotiation_id, buyer_id, farmer_id,
           quantity_ordered, unit, unit_price_agreed, subtotal_amount,
           discount_amount, total_amount, pricing_strategy_used,
           receipt_type, payment_status, order_status, delivery_address
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'CONFIRMED', ?)`,
        [
          receiptNumber,
          crop_id,
          negotiation_id,
          buyer_id,
          farmer_id,
          quantity_ordered,
          updatedCrop.unit,
          unit_price_agreed,
          subtotal_amount,
          discount_amount,
          total_amount,
          pricing_strategy_used,
          receipt_type,
          payment_status,
          delivery_address,
        ]
      );

      const order = await this.findDetailedById(result.insertId, connection);
      return { order, updatedCrop };
    });
  }

  async updateOrderStatus(orderId, { order_status, payment_status }) {
    const updates = [];
    const params = [];
    if (order_status) {
      updates.push('order_status = ?');
      params.push(order_status);
    }
    if (payment_status) {
      updates.push('payment_status = ?');
      params.push(payment_status);
    }
    if (updates.length === 0) {
      return this.findDetailedById(orderId);
    }
    params.push(orderId);
    await this.pool.execute(
      `UPDATE Orders SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return this.findDetailedById(orderId);
  }
}
