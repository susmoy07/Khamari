import { EventEmitter } from 'node:events';

export const MARKET_EVENTS = Object.freeze({
  BAZAAR_PRICE_VERIFIED: 'BAZAAR_PRICE_VERIFIED',
  CROP_LISTED: 'CROP_LISTED',
  CROP_STOCK_UPDATED: 'CROP_STOCK_UPDATED',
  NEGOTIATION_CREATED: 'NEGOTIATION_CREATED',
  NEGOTIATION_OFFER_POSTED: 'NEGOTIATION_OFFER_POSTED',
  NEGOTIATION_MESSAGE_SENT: 'NEGOTIATION_MESSAGE_SENT',
  NEGOTIATION_STATUS_CHANGED: 'NEGOTIATION_STATUS_CHANGED',
  ORDER_CONFIRMED: 'ORDER_CONFIRMED',
});

export class MarketEventBus {
  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(50);
  }

  subscribe(eventName, observerFn) {
    this.emitter.on(eventName, observerFn);
    return () => this.emitter.off(eventName, observerFn);
  }

  publish(eventName, payload) {
    this.emitter.emit(eventName, {
      event: eventName,
      timestamp: new Date().toISOString(),
      data: payload,
    });
  }
}

export const marketEventBus = new MarketEventBus();
