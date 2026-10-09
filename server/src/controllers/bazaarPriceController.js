import { bazaarPriceRepository } from '../repositories/index.js';
import { MARKET_EVENTS, marketEventBus } from '../events/MarketEventBus.js';

export async function listBazaarPrices(req, res, next) {
  try {
    const { region, category, date } = req.query;
    const prices = await bazaarPriceRepository.findAll({
      region,
      cropCategory: category,
      date,
    });
    return res.json({ success: true, data: prices });
  } catch (err) {
    next(err);
  }
}

export async function getLatestBenchmarks(req, res, next) {
  try {
    const { region } = req.query;
    const benchmarks = await bazaarPriceRepository.getLatestBenchmarks({ region });
    return res.json({ success: true, data: benchmarks });
  } catch (err) {
    next(err);
  }
}

export async function publishBazaarPrice(req, res, next) {
  try {
    const {
      crop_category,
      bazaar_region,
      unit = 'KG',
      min_price,
      modal_price,
      max_price,
      effective_date,
      market_notes = null,
    } = req.body;

    if (
      !crop_category ||
      !bazaar_region ||
      min_price == null ||
      modal_price == null ||
      max_price == null
    ) {
      return res.status(400).json({
        success: false,
        error:
          'crop_category, bazaar_region, min_price, modal_price, and max_price are required.',
      });
    }

    const min = Number(min_price);
    const modal = Number(modal_price);
    const max = Number(max_price);

    if (!(min > 0 && min <= modal && modal <= max)) {
      return res.status(400).json({
        success: false,
        error:
          'Price corridor must satisfy: 0 < min_price <= modal_price <= max_price.',
      });
    }

    const effectiveDate =
      effective_date || new Date().toISOString().slice(0, 10);

    const savedPrice = await bazaarPriceRepository.upsertDailyPrice({
      crop_category: crop_category.trim(),
      bazaar_region: bazaar_region.trim(),
      unit,
      min_price: min,
      modal_price: modal,
      max_price: max,
      verified_by: req.user.id,
      effective_date: effectiveDate,
      market_notes,
    });

    // Observer / Pub-Sub notification
    marketEventBus.publish(MARKET_EVENTS.BAZAAR_PRICE_VERIFIED, savedPrice);

    return res.status(201).json({
      success: true,
      data: savedPrice,
    });
  } catch (err) {
    next(err);
  }
}
