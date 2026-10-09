import {
  bazaarPriceRepository,
  cropRepository,
} from '../repositories/index.js';
import {
  BasePricingStrategy,
  PricingStrategyContext,
} from '../strategies/pricingStrategy.js';
import { MARKET_EVENTS, marketEventBus } from '../events/MarketEventBus.js';

function enrichCropWithFairPriceIndicator(crop) {
  const validator = new BasePricingStrategy('CORRIDOR_INDICATOR');
  const benchmark =
    crop.bazaar_min_price != null
      ? {
          min_price: crop.bazaar_min_price,
          modal_price: crop.bazaar_modal_price,
          max_price: crop.bazaar_max_price,
          effective_date: crop.bazaar_effective_date,
        }
      : null;

  return {
    ...crop,
    fair_price_indicator: validator.validatePriceCorridor(
      crop.base_price_per_unit,
      benchmark
    ),
  };
}

export async function listCrops(req, res, next) {
  try {
    const { region, category, status, farmerId, search } = req.query;
    const rows = await cropRepository.findMarketplaceListings({
      region,
      category,
      status: status || 'AVAILABLE',
      farmerId: farmerId ? Number(farmerId) : undefined,
      search,
    });

    const crops = rows.map(enrichCropWithFairPriceIndicator);
    return res.json({ success: true, data: crops });
  } catch (err) {
    next(err);
  }
}

export async function getCropById(req, res, next) {
  try {
    const crop = await cropRepository.findByIdWithBazaarPrice(
      Number(req.params.id)
    );
    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop listing not found.',
      });
    }

    return res.json({
      success: true,
      data: enrichCropWithFairPriceIndicator(crop),
    });
  } catch (err) {
    next(err);
  }
}

export async function createCrop(req, res, next) {
  try {
    const {
      title,
      crop_category,
      variety = null,
      bazaar_region,
      quantity_available,
      min_order_quantity = 10,
      unit = 'KG',
      base_price_per_unit,
      bulk_threshold_qty = null,
      bulk_discount_pct = 0,
      harvest_date,
      quality_grade = 'GRADE_A',
      enforce_corridor = false,
    } = req.body;

    if (
      !title ||
      !crop_category ||
      !bazaar_region ||
      quantity_available == null ||
      base_price_per_unit == null ||
      !harvest_date
    ) {
      return res.status(400).json({
        success: false,
        error:
          'title, crop_category, bazaar_region, quantity_available, base_price_per_unit, and harvest_date are required.',
      });
    }

    const benchmark =
      await bazaarPriceRepository.getLatestByRegionAndCategory({
        cropCategory: crop_category.trim(),
        bazaarRegion: bazaar_region.trim(),
        unit,
      });

    const validator = new BasePricingStrategy('LISTING_CORRIDOR_CHECK');
    const corridor = validator.validatePriceCorridor(
      base_price_per_unit,
      benchmark
    );

    if (
      (enforce_corridor === true || enforce_corridor === 'true') &&
      !corridor.isValid
    ) {
      return res.status(400).json({
        success: false,
        code: 'PRICE_OUTSIDE_BAZAAR_CORRIDOR',
        error: corridor.message,
        corridor,
      });
    }

    const image_url = req.file ? `/uploads/${req.file.filename}` : null;

    const created = await cropRepository.createCrop({
      farmer_id: req.user.id,
      bazaar_price_id: benchmark ? benchmark.id : null,
      title: title.trim(),
      crop_category: crop_category.trim(),
      variety: variety ? variety.trim() : null,
      bazaar_region: bazaar_region.trim(),
      quantity_available: Number(quantity_available),
      min_order_quantity: Number(min_order_quantity),
      unit,
      base_price_per_unit: Number(base_price_per_unit),
      bulk_threshold_qty:
        bulk_threshold_qty != null && bulk_threshold_qty !== ''
          ? Number(bulk_threshold_qty)
          : null,
      bulk_discount_pct: Number(bulk_discount_pct || 0),
      harvest_date,
      quality_grade,
      image_url,
      status: 'AVAILABLE',
    });

    const enriched = enrichCropWithFairPriceIndicator(created);
    marketEventBus.publish(MARKET_EVENTS.CROP_LISTED, enriched);

    return res.status(201).json({
      success: true,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

export async function updateCrop(req, res, next) {
  try {
    const cropId = Number(req.params.id);
    const existing = await cropRepository.findByIdWithBazaarPrice(cropId);

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Crop listing not found.',
      });
    }

    if (Number(existing.farmer_id) !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'You can only update your own crop listings.',
      });
    }

    const fields = { ...req.body };
    if (req.file) {
      fields.image_url = `/uploads/${req.file.filename}`;
    }

    const updated = await cropRepository.updateCrop(cropId, fields);
    const enriched = enrichCropWithFairPriceIndicator(updated);
    marketEventBus.publish(MARKET_EVENTS.CROP_STOCK_UPDATED, enriched);

    return res.json({
      success: true,
      data: enriched,
    });
  } catch (err) {
    next(err);
  }
}

export async function deleteCrop(req, res, next) {
  try {
    const cropId = Number(req.params.id);
    const existing = await cropRepository.findById(cropId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Crop listing not found.',
      });
    }

    if (Number(existing.farmer_id) !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: 'You can only archive your own crop listings.',
      });
    }

    const archived = await cropRepository.updateCrop(cropId, { status: 'ARCHIVED' });
    return res.json({
      success: true,
      data: archived,
    });
  } catch (err) {
    next(err);
  }
}

export async function previewCropPrice(req, res, next) {
  try {
    const cropId = Number(req.params.id);
    const { quantity, proposed_unit_price = null, buyer_role = null } = req.body;

    if (!quantity || Number(quantity) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A positive quantity is required for price preview.',
      });
    }

    const crop = await cropRepository.findByIdWithBazaarPrice(cropId);
    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop listing not found.',
      });
    }

    const benchmark =
      crop.bazaar_min_price != null
        ? {
            min_price: crop.bazaar_min_price,
            modal_price: crop.bazaar_modal_price,
            max_price: crop.bazaar_max_price,
          }
        : null;

    const effectiveRole = buyer_role || req.user?.role || 'BUYER';
    const evaluation = PricingStrategyContext.evaluateTrade({
      buyerRole: effectiveRole,
      crop,
      quantity: Number(quantity),
      agreedUnitPrice:
        proposed_unit_price != null ? Number(proposed_unit_price) : null,
      bazaarBenchmark: benchmark,
    });

    return res.json({
      success: true,
      data: evaluation,
    });
  } catch (err) {
    next(err);
  }
}
