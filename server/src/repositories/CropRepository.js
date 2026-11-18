import { BaseRepository } from './BaseRepository.js';

export class CropRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'Crops');
  }

  async findMarketplaceListings({ region, category, status = 'AVAILABLE', farmerId, search } = {}) {
    let sql = `
      SELECT
        c.*,
        u.full_name AS farmer_name,
        u.phone AS farmer_phone,
        u.region AS farmer_region,
        u.is_verified AS farmer_verified,
        u.avatar_url AS farmer_avatar,
        bp.min_price AS bazaar_min_price,
        bp.modal_price AS bazaar_modal_price,
        bp.max_price AS bazaar_max_price,
        bp.effective_date AS bazaar_effective_date
      FROM Crops c
      INNER JOIN Users u ON u.id = c.farmer_id
      LEFT JOIN BazaarPrices bp ON bp.id = c.bazaar_price_id
      WHERE 1 = 1
    `;
    const params = [];

    if (status && status !== 'ALL') {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    if (region) {
      sql += ` AND c.bazaar_region = ?`;
      params.push(region);
    }
    if (category) {
      sql += ` AND c.crop_category = ?`;
      params.push(category);
    }
    if (farmerId) {
      sql += ` AND c.farmer_id = ?`;
      params.push(farmerId);
    }
    if (search) {
      sql += ` AND (c.title LIKE ? OR c.crop_category LIKE ? OR c.variety LIKE ?)`;
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    sql += ` ORDER BY c.created_at DESC`;
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async findByIdWithBazaarPrice(cropId, connection = null) {
    const executor = this.getExecutor(connection);
    const [rows] = await executor.execute(
      `SELECT
        c.*,
        u.full_name AS farmer_name,
        u.phone AS farmer_phone,
        u.region AS farmer_region,
        u.is_verified AS farmer_verified,
        u.avatar_url AS farmer_avatar,
        bp.min_price AS bazaar_min_price,
        bp.modal_price AS bazaar_modal_price,
        bp.max_price AS bazaar_max_price,
        bp.effective_date AS bazaar_effective_date
       FROM Crops c
       INNER JOIN Users u ON u.id = c.farmer_id
       LEFT JOIN BazaarPrices bp ON bp.id = c.bazaar_price_id
       WHERE c.id = ?
       LIMIT 1`,
      [cropId]
    );
    return rows[0] || null;
  }

  async createCrop(cropData) {
    const [result] = await this.pool.execute(
      `INSERT INTO Crops (
         farmer_id, bazaar_price_id, title, crop_category, variety, bazaar_region,
         quantity_available, min_order_quantity, unit, base_price_per_unit,
         bulk_threshold_qty, bulk_discount_pct, harvest_date, quality_grade, image_url, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cropData.farmer_id,
        cropData.bazaar_price_id ?? null,
        cropData.title,
        cropData.crop_category,
        cropData.variety ?? null,
        cropData.bazaar_region,
        cropData.quantity_available,
        cropData.min_order_quantity ?? 10,
        cropData.unit ?? 'KG',
        cropData.base_price_per_unit,
        cropData.bulk_threshold_qty ?? null,
        cropData.bulk_discount_pct ?? 0,
        cropData.harvest_date,
        cropData.quality_grade ?? 'GRADE_A',
        cropData.image_url ?? null,
        cropData.status ?? 'AVAILABLE',
      ]
    );
    return this.findByIdWithBazaarPrice(result.insertId);
  }

  async updateCrop(cropId, fields) {
    const allowedColumns = [
      'title',
      'variety',
      'quantity_available',
      'min_order_quantity',
      'base_price_per_unit',
      'bulk_threshold_qty',
      'bulk_discount_pct',
      'quality_grade',
      'status',
      'bazaar_price_id',
      'image_url',
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
      return this.findByIdWithBazaarPrice(cropId);
    }

    params.push(cropId);
    await this.pool.execute(
      `UPDATE Crops SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
    return this.findByIdWithBazaarPrice(cropId);
  }

  async linkCropsToBazaarBenchmark({ id, crop_category, bazaar_region, unit }) {
    const [result] = await this.pool.execute(
      `UPDATE Crops
       SET bazaar_price_id = ?
       WHERE crop_category = ? AND bazaar_region = ? AND unit = ? AND status IN ('AVAILABLE', 'RESERVED')`,
      [id, crop_category, bazaar_region, unit]
    );
    return result.affectedRows;
  }

  async lockAndDeductStock(cropId, requestedQty, connection) {
    const [rows] = await connection.execute(
      `SELECT id, farmer_id, bazaar_price_id, title, crop_category, bazaar_region,
              quantity_available, min_order_quantity, unit, base_price_per_unit,
              bulk_threshold_qty, bulk_discount_pct, quality_grade, status
       FROM Crops
       WHERE id = ?
       FOR UPDATE`,
      [cropId]
    );

    const crop = rows[0];
    if (!crop || crop.status !== 'AVAILABLE') {
      const err = new Error('Crop batch is not available for purchase.');
      err.statusCode = 409;
      err.code = 'CROP_UNAVAILABLE';
      throw err;
    }

    if (Number(requestedQty) < Number(crop.min_order_quantity)) {
      const err = new Error(
        `Requested quantity (${requestedQty}) is below minimum order quantity (${crop.min_order_quantity} ${crop.unit}).`
      );
      err.statusCode = 400;
      err.code = 'BELOW_MIN_ORDER_QTY';
      throw err;
    }

    if (Number(crop.quantity_available) < Number(requestedQty)) {
      const err = new Error(
        `Insufficient stock. Available: ${crop.quantity_available} ${crop.unit}.`
      );
      err.statusCode = 409;
      err.code = 'INSUFFICIENT_CROP_STOCK';
      throw err;
    }

    const remaining = Number(
      (Number(crop.quantity_available) - Number(requestedQty)).toFixed(2)
    );
    const nextStatus = remaining <= 0 ? 'SOLD_OUT' : 'AVAILABLE';

    await connection.execute(
      `UPDATE Crops SET quantity_available = ?, status = ? WHERE id = ?`,
      [remaining, nextStatus, cropId]
    );

    return {
      ...crop,
      quantity_available: remaining,
      status: nextStatus,
    };
  }
}
