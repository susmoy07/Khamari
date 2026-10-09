import { MARKET_EVENTS } from './MarketEventBus.js';

export class SocketBroadcastObserver {
  constructor(io, eventBus) {
    this.io = io;
    this.eventBus = eventBus;
    this.unsubscribers = [];
    this.registerSubscriptions();
  }

  registerSubscriptions() {
    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.BAZAAR_PRICE_VERIFIED, ({ data, timestamp }) => {
        this.io.to(`region:${data.bazaar_region}`).emit('bazaar:price_updated', {
          ...data,
          timestamp,
        });
        this.io.emit('bazaar:global_ticker', { ...data, timestamp });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.CROP_LISTED, ({ data, timestamp }) => {
        this.io.emit('crop:listed', { ...data, timestamp });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.CROP_STOCK_UPDATED, ({ data, timestamp }) => {
        this.io.emit('crop:stock_updated', { ...data, timestamp });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.NEGOTIATION_CREATED, ({ data, timestamp }) => {
        this.io.to(`user:${data.farmer_id}`).emit('negotiation:created', {
          ...data,
          timestamp,
        });
        this.io.to(`user:${data.buyer_id}`).emit('negotiation:created', {
          ...data,
          timestamp,
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.NEGOTIATION_MESSAGE_SENT, ({ data, timestamp }) => {
        this.io
          .to(`negotiation:${data.negotiation_id}`)
          .emit('negotiation:new_message', { ...data, timestamp });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.NEGOTIATION_OFFER_POSTED, ({ data, timestamp }) => {
        this.io
          .to(`negotiation:${data.id}`)
          .emit('negotiation:offer_updated', { ...data, timestamp });
        this.io.to(`user:${data.farmer_id}`).emit('negotiation:offer_updated', {
          ...data,
          timestamp,
        });
        this.io.to(`user:${data.buyer_id}`).emit('negotiation:offer_updated', {
          ...data,
          timestamp,
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.NEGOTIATION_STATUS_CHANGED, ({ data, timestamp }) => {
        this.io
          .to(`negotiation:${data.id}`)
          .emit('negotiation:status_changed', { ...data, timestamp });
        this.io.to(`user:${data.farmer_id}`).emit('negotiation:status_changed', {
          ...data,
          timestamp,
        });
        this.io.to(`user:${data.buyer_id}`).emit('negotiation:status_changed', {
          ...data,
          timestamp,
        });
      })
    );

    this.unsubscribers.push(
      this.eventBus.subscribe(MARKET_EVENTS.ORDER_CONFIRMED, ({ data, timestamp }) => {
        this.io.to(`user:${data.buyer_id}`).emit('order:confirmed', {
          ...data,
          timestamp,
        });
        this.io.to(`user:${data.farmer_id}`).emit('order:confirmed', {
          ...data,
          timestamp,
        });
      })
    );
  }
}
