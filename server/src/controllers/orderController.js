import {
  cropRepository,
  negotiationRepository,
  orderRepository,
  userRepository,
} from '../repositories/index.js';
import { PricingStrategyContext } from '../strategies/pricingStrategy.js';
import { ReceiptFactory } from '../factories/receiptFactory.js';
import { MARKET_EVENTS, marketEventBus } from '../events/MarketEventBus.js';

function buildReceiptFromOrder(order) {
  const crop = {
    id: order.crop_id,
    title: order.crop_title,
    crop_category: order.crop_category,
    variety: order.crop_variety,
    bazaar_region: order.bazaar_region,
    quality_grade: order.quality_grade,
  };
  const buyer = {
    id: order.buyer_id,
    full_name: order.buyer_name,
    phone: order.buyer_phone,
    organization_name: order.buyer_organization,
    role: order.buyer_role,
  };
  const farmer = {
    id: order.farmer_id,
    full_name: order.farmer_name,
    phone: order.farmer_phone,
  };
  const bazaarBenchmark =
    order.bazaar_min_price != null
      ? {
          bazaar_region: order.bazaar_region,
          min_price: order.bazaar_min_price,
          modal_price: order.bazaar_modal_price,
          max_price: order.bazaar_max_price,
          effective_date: order.bazaar_effective_date,
        }
      : null;

  return ReceiptFactory.createReceipt({
    order,
    crop,
    buyer,
    farmer,
    bazaarBenchmark,
  });
}

export async function listMyOrders(req, res, next) {
  try {
    const orders = await orderRepository.findByUserId(req.user.id);
    return res.json({ success: true, data: orders });
  } catch (err) {
    next(err);
  }
}

export async function getOrderById(req, res, next) {
  try {
    const order = await orderRepository.findDetailedById(Number(req.params.id));
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found.',
      });
    }

    if (
      Number(order.buyer_id) !== req.user.id &&
      Number(order.farmer_id) !== req.user.id &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this order.',
      });
    }

    return res.json({ success: true, data: order });
  } catch (err) {
    next(err);
  }
}

export async function getOrderReceipt(req, res, next) {
  try {
    const order = await orderRepository.findDetailedById(Number(req.params.id));
    if (!order) {
      return res.status(404).json({
        success: false,
        error: 'Order not found.',
      });
    }

    if (
      Number(order.buyer_id) !== req.user.id &&
      Number(order.farmer_id) !== req.user.id &&
      req.user.role !== 'ADMIN' &&
      req.user.role !== 'BAZAAR_COMMITTEE'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this order receipt.',
      });
    }

    const receipt = buildReceiptFromOrder(order);
    return res.json({ success: true, data: receipt });
  } catch (err) {
    next(err);
  }
}

export async function createDirectOrder(req, res, next) {
  try {
    const { crop_id, quantity_ordered, delivery_address } = req.body;

    if (!crop_id || !quantity_ordered || !delivery_address) {
      return res.status(400).json({
        success: false,
        error:
          'crop_id, quantity_ordered, and delivery_address are required.',
      });
    }

    const crop = await cropRepository.findByIdWithBazaarPrice(Number(crop_id));
    if (!crop) {
      return res.status(404).json({
        success: false,
        error: 'Crop listing not found.',
      });
    }

    if (Number(crop.farmer_id) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Farmers cannot place an order on their own crop listing.',
      });
    }

    const pricing = PricingStrategyContext.evaluateTrade({
      buyerRole: req.user.role,
      crop,
      quantity: Number(quantity_ordered),
      agreedUnitPrice: Number(crop.base_price_per_unit),
    });

    const receiptType = ReceiptFactory.resolveReceiptType(
      req.user.role,
      crop.bazaar_min_price != null
    );

    const { order, updatedCrop } = await orderRepository.createOrderAtomic({
      crop_id: crop.id,
      negotiation_id: null,
      buyer_id: req.user.id,
      farmer_id: crop.farmer_id,
      quantity_ordered: Number(quantity_ordered),
      unit_price_agreed: pricing.unitPrice,
      subtotal_amount: pricing.subtotalAmount,
      discount_amount: pricing.discountAmount,
      total_amount: pricing.totalAmount,
      pricing_strategy_used: pricing.strategyUsed,
      receipt_type: receiptType,
      payment_status: 'ESCROW_HELD',
      delivery_address: delivery_address.trim(),
    });

    const receipt = buildReceiptFromOrder(order);

    marketEventBus.publish(MARKET_EVENTS.ORDER_CONFIRMED, order);
    marketEventBus.publish(MARKET_EVENTS.CROP_STOCK_UPDATED, updatedCrop);

    return res.status(201).json({
      success: true,
      data: { order, receipt },
    });
  } catch (err) {
    next(err);
  }
}

export async function createOrderFromNegotiation(req, res, next) {
  try {
    const negotiationId = Number(req.params.negotiationId);
    const { delivery_address } = req.body;

    if (!delivery_address) {
      return res.status(400).json({
        success: false,
        error: 'delivery_address is required to finalize the order.',
      });
    }

    const negotiation =
      await negotiationRepository.findDetailedById(negotiationId);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        error: 'Negotiation not found.',
      });
    }

    if (
      Number(negotiation.buyer_id) !== req.user.id &&
      Number(negotiation.farmer_id) !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        error: 'Only the negotiation buyer or farmer can finalize this order.',
      });
    }

    if (!['OPEN', 'COUNTERED', 'ACCEPTED'].includes(negotiation.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot convert negotiation with status ${negotiation.status}.`,
      });
    }

    const crop = await cropRepository.findByIdWithBazaarPrice(
      negotiation.crop_id
    );
    const buyer = await userRepository.findPublicById(negotiation.buyer_id);

    const pricing = PricingStrategyContext.evaluateTrade({
      buyerRole: buyer.role,
      crop,
      quantity: Number(negotiation.requested_quantity),
      agreedUnitPrice: Number(negotiation.current_offer_price),
    });

    const receiptType = ReceiptFactory.resolveReceiptType(
      buyer.role,
      crop.bazaar_min_price != null
    );

    const { order, updatedCrop } = await orderRepository.createOrderAtomic({
      crop_id: crop.id,
      negotiation_id: negotiation.id,
      buyer_id: buyer.id,
      farmer_id: crop.farmer_id,
      quantity_ordered: Number(negotiation.requested_quantity),
      unit_price_agreed: pricing.unitPrice,
      subtotal_amount: pricing.subtotalAmount,
      discount_amount: pricing.discountAmount,
      total_amount: pricing.totalAmount,
      pricing_strategy_used: `NEGOTIATED_${pricing.strategyUsed}`,
      receipt_type: receiptType,
      payment_status: 'ESCROW_HELD',
      delivery_address: delivery_address.trim(),
    });

    const receipt = buildReceiptFromOrder(order);

    marketEventBus.publish(MARKET_EVENTS.ORDER_CONFIRMED, order);
    marketEventBus.publish(MARKET_EVENTS.CROP_STOCK_UPDATED, updatedCrop);

    return res.status(201).json({
      success: true,
      data: { order, receipt },
    });
  } catch (err) {
    next(err);
  }
}

export async function updateOrderStatus(req, res, next) {
  try {
    const orderId = Number(req.params.id);
    const { order_status, payment_status } = req.body;

    const existing = await orderRepository.findDetailedById(orderId);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: 'Order not found.',
      });
    }

    if (
      Number(existing.farmer_id) !== req.user.id &&
      Number(existing.buyer_id) !== req.user.id &&
      req.user.role !== 'ADMIN'
    ) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to update this order.',
      });
    }

    const updated = await orderRepository.updateOrderStatus(orderId, {
      order_status,
      payment_status,
    });

    return res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}
