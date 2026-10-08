export class BasePricingStrategy {
  constructor(strategyName) {
    this.strategyName = strategyName;
  }

  /**
   * Evaluates whether a proposed unit price aligns with the verified Bazaar Committee corridor.
   */
  validatePriceCorridor(proposedUnitPrice, bazaarBenchmark) {
    if (!bazaarBenchmark || !bazaarBenchmark.min_price || !bazaarBenchmark.max_price) {
      return {
        isValid: true,
        complianceStatus: 'UNBENCHMARKED',
        fairPriceBadge: 'Unbenchmarked Region',
        varianceFromModalPct: null,
        message: 'No active Bazaar Committee benchmark exists for this crop/region yet.',
      };
    }

    const price = Number(proposedUnitPrice);
    const min = Number(bazaarBenchmark.min_price);
    const modal = Number(bazaarBenchmark.modal_price);
    const max = Number(bazaarBenchmark.max_price);
    const varianceFromModalPct = Number((((price - modal) / modal) * 100).toFixed(2));

    if (price < min) {
      return {
        isValid: false,
        complianceStatus: 'BELOW_FLOOR',
        fairPriceBadge: 'Below Bazaar Floor',
        varianceFromModalPct,
        message: `Proposed unit price (৳${price}) is below the Bazaar Committee minimum floor (৳${min}).`,
      };
    }

    if (price > max) {
      return {
        isValid: false,
        complianceStatus: 'ABOVE_CEILING',
        fairPriceBadge: 'Above Bazaar Ceiling',
        varianceFromModalPct,
        message: `Proposed unit price (৳${price}) exceeds the Bazaar Committee maximum cap (৳${max}).`,
      };
    }

    return {
      isValid: true,
      complianceStatus: 'BAZAAR_VERIFIED',
      fairPriceBadge: 'Bazaar Fair-Price Verified',
      varianceFromModalPct,
      message: `Within verified Bazaar corridor (৳${min} - ৳${max}, Modal: ৳${modal}).`,
    };
  }
}

export class StandardWholesaleStrategy extends BasePricingStrategy {
  constructor() {
    super('STANDARD_WHOLESALE');
  }

  calculateOrderTotals(crop, quantity, agreedUnitPrice = null) {
    const qty = Number(quantity);
    const unitPrice = Number(agreedUnitPrice ?? crop.base_price_per_unit);
    const subtotalAmount = Number((qty * unitPrice).toFixed(2));
    return {
      strategyUsed: this.strategyName,
      quantity: qty,
      unitPrice,
      discountPct: 0,
      subtotalAmount,
      discountAmount: 0,
      totalAmount: subtotalAmount,
    };
  }
}

export class BulkTierDiscountStrategy extends BasePricingStrategy {
  constructor() {
    super('BULK_TIER_DISCOUNT');
  }

  calculateOrderTotals(crop, quantity, agreedUnitPrice = null) {
    const qty = Number(quantity);
    const unitPrice = Number(agreedUnitPrice ?? crop.base_price_per_unit);
    const subtotalAmount = Number((qty * unitPrice).toFixed(2));
    const discountPct = Number(crop.bulk_discount_pct || 0);
    const discountAmount = Number(((subtotalAmount * discountPct) / 100).toFixed(2));

    return {
      strategyUsed: this.strategyName,
      quantity: qty,
      unitPrice,
      discountPct,
      subtotalAmount,
      discountAmount,
      totalAmount: Number((subtotalAmount - discountAmount).toFixed(2)),
    };
  }
}

export class InstitutionalContractStrategy extends BasePricingStrategy {
  constructor() {
    super('INSTITUTIONAL_CONTRACT');
  }

  calculateOrderTotals(crop, quantity, agreedUnitPrice = null) {
    const qty = Number(quantity);
    const unitPrice = Number(agreedUnitPrice ?? crop.base_price_per_unit);
    const subtotalAmount = Number((qty * unitPrice).toFixed(2));

    const qualifiesBulk =
      crop.bulk_threshold_qty && qty >= Number(crop.bulk_threshold_qty);
    const baseBulkPct = qualifiesBulk ? Number(crop.bulk_discount_pct || 0) : 0;
    const effectiveDiscountPct = Math.min(baseBulkPct + 2.0, 25.0);
    const discountAmount = Number(
      ((subtotalAmount * effectiveDiscountPct) / 100).toFixed(2)
    );

    return {
      strategyUsed: this.strategyName,
      quantity: qty,
      unitPrice,
      discountPct: effectiveDiscountPct,
      subtotalAmount,
      discountAmount,
      totalAmount: Number((subtotalAmount - discountAmount).toFixed(2)),
    };
  }
}

export class PricingStrategyContext {
  static resolveStrategy(buyerRole, crop, quantity) {
    const qty = Number(quantity);
    if (buyerRole === 'INSTITUTION') {
      return new InstitutionalContractStrategy();
    }
    if (
      crop.bulk_threshold_qty &&
      qty >= Number(crop.bulk_threshold_qty) &&
      Number(crop.bulk_discount_pct) > 0
    ) {
      return new BulkTierDiscountStrategy();
    }
    return new StandardWholesaleStrategy();
  }

  static evaluateTrade({
    buyerRole,
    crop,
    quantity,
    agreedUnitPrice = null,
    bazaarBenchmark = null,
  }) {
    const strategy = PricingStrategyContext.resolveStrategy(
      buyerRole,
      crop,
      quantity
    );
    const totals = strategy.calculateOrderTotals(crop, quantity, agreedUnitPrice);
    const corridor = strategy.validatePriceCorridor(
      totals.unitPrice,
      bazaarBenchmark
    );
    return {
      ...totals,
      corridor,
    };
  }
}
