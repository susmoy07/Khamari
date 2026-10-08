import { BaseRepository } from './BaseRepository.js';

export class BazaarPriceRepository extends BaseRepository {
  constructor(pool) {
    super(pool, 'BazaarPrices');
  }

  async findAll({ region, cropCategory, date } = {}) {
    let sql = `
      SELECT bp.*, u.full_name AS verifier_name, u.organization_name AS committee_name
      FROM BazaarPrices bp
      INNER JOIN Users u ON u.id = bp.verified_by
      WHERE 1 = 1
    `;
    const params = [];

    if (region) {
      sql += ` AND bp.bazaar_region = ?`;
      params.push(region);
    }
    if (cropCategory) {
      sql += ` AND bp.crop_category = ?`;
      params.push(cropCategory);
    }
    if (date) {
      sql += ` AND bp.effective_date = ?`;
      params.push(date);
    }

    sql += ` ORDER BY bp.effective_date DESC, bp.bazaar_region ASC, bp.crop_category ASC`;
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async getLatestByRegionAndCategory({ cropCategory, bazaarRegion, unit = 'KG' }) {
    const [rows] = await this.pool.execute(
      `SELECT bp.*, u.full_name AS verifier_name, u.organization_name AS committee_name
       FROM BazaarPrices bp
       INNER JOIN Users u ON u.id = bp.verified_by
       WHERE bp.crop_category = ? AND bp.bazaar_region = ? AND bp.unit = ?
       ORDER BY bp.effective_date DESC
       LIMIT 1`,
      [cropCategory, bazaarRegion, unit]
    );
    return rows[0] || null;
  }

  async getLatestBenchmarks({ region } = {}) {
    let sql = `
      SELECT bp.*, u.full_name AS verifier_name, u.organization_name AS committee_name
      FROM BazaarPrices bp
      INNER JOIN Users u ON u.id = bp.verified_by
      INNER JOIN (
        SELECT crop_category, bazaar_region, unit, MAX(effective_date) AS max_date
        FROM BazaarPrices
        GROUP BY crop_category, bazaar_region, unit
      ) latest
        ON latest.crop_category = bp.crop_category
        AND latest.bazaar_region = bp.bazaar_region
        AND latest.unit = bp.unit
        AND latest.max_date = bp.effective_date
      WHERE 1 = 1
    `;
    const params = [];
    if (region) {
      sql += ` AND bp.bazaar_region = ?`;
      params.push(region);
    }
    sql += ` ORDER BY bp.bazaar_region ASC, bp.crop_category ASC`;
    const [rows] = await this.pool.execute(sql, params);
    return rows;
  }

  async upsertDailyPrice({
    crop_category,
    bazaar_region,
    unit = 'KG',
    min_price,
    modal_price,
    max_price,
    verified_by,
    effective_date,
    market_notes = null,
  }) {
    const [existing] = await this.pool.execute(
      `SELECT id FROM BazaarPrices
       WHERE crop_category = ? AND bazaar_region = ? AND unit = ? AND effective_date = ?
       LIMIT 1`,
      [crop_category, bazaar_region, unit, effective_date]
    );

    if (existing[0]) {
      await this.pool.execute(
        `UPDATE BazaarPrices
         SET min_price = ?, modal_price = ?, max_price = ?, verified_by = ?, market_notes = ?
         WHERE id = ?`,
        [min_price, modal_price, max_price, verified_by, market_notes, existing[0].id]
      );
      return this.findByIdWithVerifier(existing[0].id);
    }

    const [result] = await this.pool.execute(
      `INSERT INTO BazaarPrices (
         crop_category, bazaar_region, unit, min_price, modal_price, max_price,
         verified_by, effective_date, market_notes
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crop_category,
        bazaar_region,
        unit,
        min_price,
        modal_price,
        max_price,
        verified_by,
        effective_date,
        market_notes,
      ]
    );
    return this.findByIdWithVerifier(result.insertId);
  }

  async findByIdWithVerifier(id) {
    const [rows] = await this.pool.execute(
      `SELECT bp.*, u.full_name AS verifier_name, u.organization_name AS committee_name
       FROM BazaarPrices bp
       INNER JOIN Users u ON u.id = bp.verified_by
       WHERE bp.id = ? LIMIT 1`,
      [id]
    );
    return rows[0] || null;
  }
}
