import {
  cropRepository,
  messageRepository,
  negotiationRepository,
} from '../repositories/index.js';
import { BasePricingStrategy } from '../strategies/pricingStrategy.js';
import { MARKET_EVENTS, marketEventBus } from '../events/MarketEventBus.js';

function isParticipant(negotiation, userId) {
  return (
    Number(negotiation.buyer_id) === Number(userId) ||
    Number(negotiation.farmer_id) === Number(userId)
  );
}

export async function listMyNegotiations(req, res, next) {
  try {
    const negotiations = await negotiationRepository.findForUser(req.user.id);
    return res.json({ success: true, data: negotiations });
  } catch (err) {
    next(err);
  }
}

export async function getNegotiationDetail(req, res, next) {
  try {
    const negId = Number(req.params.id);
    const negotiation = await negotiationRepository.findDetailedById(negId);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        error: 'Negotiation room not found.',
      });
    }

    if (!isParticipant(negotiation, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this negotiation room.',
      });
    }

    await messageRepository.markRoomRead(negId, req.user.id);
    const messages = await messageRepository.findByNegotiationId(negId);

    return res.json({
      success: true,
      data: {
        negotiation,
        messages,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function startNegotiation(req, res, next) {
  try {
    const {
      crop_id,
      requested_quantity,
      offered_unit_price,
      initial_message = null,
    } = req.body;

    if (!crop_id || !requested_quantity || !offered_unit_price) {
      return res.status(400).json({
        success: false,
        error:
          'crop_id, requested_quantity, and offered_unit_price are required.',
      });
    }

    const crop = await cropRepository.findByIdWithBazaarPrice(Number(crop_id));
    if (!crop || crop.status !== 'AVAILABLE') {
      return res.status(404).json({
        success: false,
        error: 'Available crop batch not found.',
      });
    }

    if (Number(crop.farmer_id) === req.user.id) {
      return res.status(400).json({
        success: false,
        error: 'Farmers cannot start a buyer negotiation on their own crop.',
      });
    }

    if (Number(requested_quantity) < Number(crop.min_order_quantity)) {
      return res.status(400).json({
        success: false,
        error: `Requested quantity must be at least ${crop.min_order_quantity} ${crop.unit}.`,
      });
    }

    if (Number(requested_quantity) > Number(crop.quantity_available)) {
      return res.status(400).json({
        success: false,
        error: `Requested quantity exceeds available stock (${crop.quantity_available} ${crop.unit}).`,
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

    const validator = new BasePricingStrategy('NEGOTIATION_CORRIDOR');
    const corridor = validator.validatePriceCorridor(
      offered_unit_price,
      benchmark
    );

    const negotiation = await negotiationRepository.createNegotiation({
      crop_id: crop.id,
      buyer_id: req.user.id,
      farmer_id: crop.farmer_id,
      requested_quantity: Number(requested_quantity),
      current_offer_price: Number(offered_unit_price),
      last_offered_by: 'BUYER',
    });

    const content =
      initial_message ||
      `Initial bid: ৳${Number(offered_unit_price)}/${crop.unit} for ${Number(
        requested_quantity
      )} ${crop.unit}.`;

    const firstMessage = await messageRepository.createMessage({
      negotiation_id: negotiation.id,
      sender_id: req.user.id,
      message_type: 'BID_OFFER',
      content,
      offered_unit_price: Number(offered_unit_price),
      offered_quantity: Number(requested_quantity),
    });

    marketEventBus.publish(MARKET_EVENTS.NEGOTIATION_CREATED, negotiation);
    marketEventBus.publish(MARKET_EVENTS.NEGOTIATION_MESSAGE_SENT, firstMessage);

    return res.status(201).json({
      success: true,
      data: {
        negotiation,
        initialMessage: firstMessage,
        corridor,
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function postMessage(req, res, next) {
  try {
    const negId = Number(req.params.id);
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Message content cannot be empty.',
      });
    }

    const negotiation = await negotiationRepository.findDetailedById(negId);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        error: 'Negotiation room not found.',
      });
    }

    if (!isParticipant(negotiation, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this negotiation room.',
      });
    }

    const message = await messageRepository.createMessage({
      negotiation_id: negId,
      sender_id: req.user.id,
      message_type: 'TEXT',
      content: content.trim(),
    });

    marketEventBus.publish(MARKET_EVENTS.NEGOTIATION_MESSAGE_SENT, message);
    return res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
}

export async function postCounterOffer(req, res, next) {
  try {
    const negId = Number(req.params.id);
    const { offered_unit_price, offered_quantity = null, note = null } = req.body;

    if (!offered_unit_price || Number(offered_unit_price) <= 0) {
      return res.status(400).json({
        success: false,
        error: 'A positive offered_unit_price is required.',
      });
    }

    const negotiation = await negotiationRepository.findDetailedById(negId);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        error: 'Negotiation room not found.',
      });
    }

    if (!isParticipant(negotiation, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this negotiation room.',
      });
    }

    if (!['OPEN', 'COUNTERED'].includes(negotiation.status)) {
      return res.status(409).json({
        success: false,
        error: `Cannot counter-offer when negotiation status is ${negotiation.status}.`,
      });
    }

    const nextQuantity =
      offered_quantity != null
        ? Number(offered_quantity)
        : Number(negotiation.requested_quantity);

    const lastOfferedBy =
      Number(negotiation.farmer_id) === req.user.id ? 'FARMER' : 'BUYER';

    const updatedNegotiation = await negotiationRepository.updateOffer(negId, {
      requested_quantity: nextQuantity,
      current_offer_price: Number(offered_unit_price),
      last_offered_by: lastOfferedBy,
    });

    const content =
      note ||
      `Counter-offer from ${lastOfferedBy}: ৳${Number(offered_unit_price)}/${
        negotiation.unit
      } for ${nextQuantity} ${negotiation.unit}.`;

    const message = await messageRepository.createMessage({
      negotiation_id: negId,
      sender_id: req.user.id,
      message_type: 'COUNTER_OFFER',
      content,
      offered_unit_price: Number(offered_unit_price),
      offered_quantity: nextQuantity,
    });

    marketEventBus.publish(
      MARKET_EVENTS.NEGOTIATION_OFFER_POSTED,
      updatedNegotiation
    );
    marketEventBus.publish(MARKET_EVENTS.NEGOTIATION_MESSAGE_SENT, message);

    return res.json({
      success: true,
      data: { negotiation: updatedNegotiation, message },
    });
  } catch (err) {
    next(err);
  }
}

export async function respondToNegotiation(req, res, next) {
  try {
    const negId = Number(req.params.id);
    const { action } = req.body; // 'ACCEPT' | 'REJECT' | 'CANCEL'

    if (!['ACCEPT', 'REJECT', 'CANCEL'].includes(action)) {
      return res.status(400).json({
        success: false,
        error: 'action must be ACCEPT, REJECT, or CANCEL.',
      });
    }

    const negotiation = await negotiationRepository.findDetailedById(negId);
    if (!negotiation) {
      return res.status(404).json({
        success: false,
        error: 'Negotiation room not found.',
      });
    }

    if (!isParticipant(negotiation, req.user.id)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied to this negotiation room.',
      });
    }

    if (!['OPEN', 'COUNTERED'].includes(negotiation.status)) {
      return res.status(409).json({
        success: false,
        error: `Negotiation is already ${negotiation.status}.`,
      });
    }

    const statusMap = {
      ACCEPT: 'ACCEPTED',
      REJECT: 'REJECTED',
      CANCEL: 'CANCELLED',
    };

    const nextStatus = statusMap[action];
    const updated = await negotiationRepository.updateStatus(negId, nextStatus);

    const sysMessage = await messageRepository.createMessage({
      negotiation_id: negId,
      sender_id: req.user.id,
      message_type: 'SYSTEM_ALERT',
      content: `${req.user.full_name} marked negotiation as ${nextStatus}.`,
    });

    marketEventBus.publish(MARKET_EVENTS.NEGOTIATION_STATUS_CHANGED, updated);
    marketEventBus.publish(MARKET_EVENTS.NEGOTIATION_MESSAGE_SENT, sysMessage);

    return res.json({
      success: true,
      data: { negotiation: updated, message: sysMessage },
    });
  } catch (err) {
    next(err);
  }
}
