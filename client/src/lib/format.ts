import type { BenchFields, BenchmarkLite, Corridor } from './types';

export const taka = (n: number | null | undefined) =>
  n == null || Number.isNaN(n)
    ? '-'
    : `৳${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

export const num = (n: number | null | undefined) =>
  n == null ? '-' : Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });

export const dateOnly = (d: string | null | undefined) => (d ? d.slice(0, 10) : '-');

export const timeAgo = (d: string) => {
  const s = Math.max(1, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export function benchOf(x: BenchFields): BenchmarkLite | null {
  if (x.bazaar_min_price == null || x.bazaar_modal_price == null || x.bazaar_max_price == null) {
    return null;
  }
  return { min_price: x.bazaar_min_price, modal_price: x.bazaar_modal_price, max_price: x.bazaar_max_price };
}

/** Mirrors server BasePricingStrategy.validatePriceCorridor for instant client-side feedback. */
export function computeCorridor(price: number, b: BenchmarkLite | null): Corridor {
  if (!b) {
    return {
      isValid: true,
      complianceStatus: 'UNBENCHMARKED',
      fairPriceBadge: 'No Bazaar baseline',
      varianceFromModalPct: null,
      message: 'No Bazaar Committee baseline for this crop/region yet.',
    };
  }
  const variance = Number((((price - b.modal_price) / b.modal_price) * 100).toFixed(1));
  if (price < b.min_price) {
    return {
      isValid: false,
      complianceStatus: 'BELOW_FLOOR',
      fairPriceBadge: 'Below Bazaar floor',
      varianceFromModalPct: variance,
      message: `${taka(price)} is below the Bazaar baseline floor ${taka(b.min_price)}.`,
    };
  }
  if (price > b.max_price) {
    return {
      isValid: false,
      complianceStatus: 'ABOVE_CEILING',
      fairPriceBadge: 'Above Bazaar ceiling',
      varianceFromModalPct: variance,
      message: `${taka(price)} is above the Bazaar ceiling ${taka(b.max_price)}.`,
    };
  }
  return {
    isValid: true,
    complianceStatus: 'BAZAAR_VERIFIED',
    fairPriceBadge: 'Fair price',
    varianceFromModalPct: variance,
    message: `Within Bazaar range ${taka(b.min_price)} - ${taka(b.max_price)}.`,
  };
}
