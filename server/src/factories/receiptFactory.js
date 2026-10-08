class BaseDigitalReceipt {
  constructor({ order, crop, buyer, farmer }) {
    this.receiptNumber = order.receipt_number;
    this.receiptType = order.receipt_type;
    this.orderId = order.id;
    this.issuedAt = order.created_at || new Date().toISOString();
    this.paymentStatus = order.payment_status;
    this.orderStatus = order.order_status;
    this.deliveryAddress = order.delivery_address;

    this.seller = {
      id: farmer.id,
      name: farmer.full_name,
      phone: farmer.phone,
      region: crop.bazaar_region,
    };

    this.buyer = {
      id: buyer.id,
      name: buyer.full_name,
      phone: buyer.phone,
      organization: buyer.organization_name || 'Independent Wholesale Trader',
      role: buyer.role,
    };

    this.lineItem = {
      cropId: crop.id,
      cropTitle: crop.title,
      cropCategory: crop.crop_category,
      variety: crop.variety || null,
      qualityGrade: crop.quality_grade,
      quantity: Number(order.quantity_ordered),
      unit: order.unit,
      unitPriceAgreed: Number(order.unit_price_agreed),
      subtotalAmount: Number(order.subtotal_amount),
      discountAmount: Number(order.discount_amount),
      totalAmount: Number(order.total_amount),
      pricingStrategy: order.pricing_strategy_used,
    };
  }
}

class WholesaleStandardReceipt extends BaseDigitalReceipt {
  toJSON() {
    return {
      ...this,
      documentTitle: 'Wholesale Agricultural Trade & Gate-Pass Receipt',
      gatePassCode: `GP-${this.receiptNumber}`,
      escrowInstructions:
        'Release escrow funds upon physical weight inspection at destination depot.',
    };
  }
}

class InstitutionalTaxReceipt extends BaseDigitalReceipt {
  toJSON() {
    return {
      ...this,
      documentTitle: 'Institutional Kitchen Procurement & Tax Invoice',
      procurementVoucherId: `PROC-${this.receiptNumber}`,
      vatRatePct: 0.0,
      taxNotice:
        'Exempt under Primary Agricultural Produce Direct Procurement Schedule.',
      authorizedSignatoryRequired: true,
    };
  }
}

class BazaarCertifiedReceipt extends BaseDigitalReceipt {
  constructor(context) {
    super(context);
    this.bazaarBenchmark = context.bazaarBenchmark || null;
  }

  toJSON() {
    return {
      ...this,
      documentTitle: 'Bazaar Committee Fair-Price Certified Trade Receipt',
      certificationBadge: 'VERIFIED_FAIR_CORRIDOR',
      bazaarCorridorSnapshot: this.bazaarBenchmark
        ? {
            region: this.bazaarBenchmark.bazaar_region,
            minPrice: Number(this.bazaarBenchmark.min_price),
            modalPrice: Number(this.bazaarBenchmark.modal_price),
            maxPrice: Number(this.bazaarBenchmark.max_price),
            effectiveDate: this.bazaarBenchmark.effective_date,
          }
        : null,
    };
  }
}

export class ReceiptFactory {
  static resolveReceiptType(buyerRole, hasBazaarBenchmark = false) {
    if (buyerRole === 'INSTITUTION') {
      return 'INSTITUTIONAL_TAX';
    }
    if (hasBazaarBenchmark) {
      return 'BAZAAR_CERTIFIED';
    }
    return 'WHOLESALE_STANDARD';
  }

  static createReceipt({ order, crop, buyer, farmer, bazaarBenchmark = null }) {
    switch (order.receipt_type) {
      case 'INSTITUTIONAL_TAX':
        return new InstitutionalTaxReceipt({ order, crop, buyer, farmer }).toJSON();
      case 'BAZAAR_CERTIFIED':
        return new BazaarCertifiedReceipt({
          order,
          crop,
          buyer,
          farmer,
          bazaarBenchmark,
        }).toJSON();
      case 'WHOLESALE_STANDARD':
      default:
        return new WholesaleStandardReceipt({ order, crop, buyer, farmer }).toJSON();
    }
  }
}
