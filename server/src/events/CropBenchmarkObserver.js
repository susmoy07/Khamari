import { MARKET_EVENTS } from './MarketEventBus.js';

export class CropBenchmarkObserver {
  constructor(eventBus, cropRepo) {
    this.eventBus = eventBus;
    this.cropRepo = cropRepo;
    this.registerSubscriptions();
  }

  registerSubscriptions() {
    this.eventBus.subscribe(MARKET_EVENTS.BAZAAR_PRICE_VERIFIED, async ({ data }) => {
      try {
        await this.cropRepo.linkCropsToBazaarBenchmark({
          id: data.id,
          crop_category: data.crop_category,
          bazaar_region: data.bazaar_region,
          unit: data.unit,
        });
      } catch (err) {
        console.error('[CropBenchmarkObserver] Failed linking regional crops:', err.message);
      }
    });
  }
}
