import type { Benchmark, Crop } from '../lib/types';
import { taka } from '../lib/format';

/** Range-corridor chart: Bazaar min-max band + modal tick + each farmer's ask as a dot. */
export function CorridorChart({ benchmarks, crops }: { benchmarks: Benchmark[]; crops: Crop[] }) {
  if (benchmarks.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
        No Bazaar baselines published yet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {benchmarks.map((b) => {
        const asks = crops.filter(
          (c) => c.crop_category === b.crop_category && c.bazaar_region === b.bazaar_region
        );
        const lo = b.min_price * 0.8;
        const hi = b.max_price * 1.2;
        const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100))}%`;
        return (
          <div key={b.id}>
            <div className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
              <div className="text-sm font-bold text-slate-900 dark:text-white">
                {b.crop_category}
                <span className="ml-2 font-mono text-xs font-normal text-slate-500 dark:text-slate-400">
                  {b.bazaar_region} / {b.unit}
                </span>
              </div>
              <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
                {taka(b.min_price)} - {taka(b.max_price)} | modal{' '}
                <strong className="text-emerald-700 dark:text-emerald-400">{taka(b.modal_price)}</strong>
              </div>
            </div>
            <div className="relative h-8 rounded-full bg-slate-100 dark:bg-[#070e1d]">
              <div
                className="absolute top-0 h-8 rounded-full bg-emerald-200 dark:bg-emerald-500/25"
                style={{ left: pct(b.min_price), width: `calc(${pct(b.max_price)} - ${pct(b.min_price)})` }}
              />
              <div
                className="absolute top-0 h-8 w-0.5 bg-emerald-800 dark:bg-emerald-400"
                style={{ left: pct(b.modal_price) }}
                title={`Modal ${taka(b.modal_price)}`}
              />
              {asks.map((a) => {
                const ok = a.base_price_per_unit >= b.min_price && a.base_price_per_unit <= b.max_price;
                return (
                  <div
                    key={a.id}
                    title={`${a.farmer_name}: ${taka(a.base_price_per_unit)}`}
                    className={`absolute top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-white shadow dark:border-[#141b2b] ${
                      ok ? 'bg-amber-500' : 'bg-rose-500'
                    }`}
                    style={{ left: pct(a.base_price_per_unit) }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-6 rounded bg-emerald-200 dark:bg-emerald-500/30" /> Bazaar min-max
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-0.5 bg-emerald-800 dark:bg-emerald-400" /> Modal price
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-full bg-amber-500" /> Farmer ask (fair)
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded-full bg-rose-500" /> Ask outside range
        </span>
      </div>
    </div>
  );
}

/** Grouped bars: Bazaar modal vs average farmer ask per commodity. */
export function ComparisonBars({ benchmarks, crops }: { benchmarks: Benchmark[]; crops: Crop[] }) {
  const rows = benchmarks.map((b) => {
    const asks = crops.filter(
      (c) => c.crop_category === b.crop_category && c.bazaar_region === b.bazaar_region
    );
    const avg = asks.length
      ? asks.reduce((s, c) => s + c.base_price_per_unit, 0) / asks.length
      : null;
    return {
      label: b.crop_category.replace(/\s*\(.*\)/, ''),
      region: b.bazaar_region,
      modal: b.modal_price,
      avg,
    };
  });
  const max = Math.max(1, ...rows.flatMap((r) => [r.modal, r.avg ?? 0]));
  return (
    <div>
      <div className="flex h-48 items-end gap-3 border-b border-slate-200 px-1 dark:border-[#1e293b] sm:gap-6">
        {rows.map((r) => (
          <div key={r.label + r.region} className="flex flex-1 flex-col items-center justify-end">
            <div className="flex h-40 w-full items-end justify-center gap-1.5">
              <div className="flex w-1/3 max-w-[34px] flex-col items-center justify-end">
                <span className="mb-0.5 font-mono text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                  {r.modal}
                </span>
                <div
                  className="w-full rounded-t bg-emerald-700 dark:bg-emerald-500"
                  style={{ height: `${(r.modal / max) * 100}%` }}
                />
              </div>
              <div className="flex w-1/3 max-w-[34px] flex-col items-center justify-end">
                <span className="mb-0.5 font-mono text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  {r.avg ? r.avg.toFixed(1) : '-'}
                </span>
                <div
                  className="w-full rounded-t bg-amber-400 dark:bg-amber-500"
                  style={{ height: `${((r.avg ?? 0) / max) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 px-1 sm:gap-6">
        {rows.map((r) => (
          <div key={r.label + r.region} className="flex-1 text-center">
            <div className="text-xs font-semibold text-slate-900 dark:text-white">{r.label}</div>
            <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400">{r.region}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-xs text-slate-600 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded bg-emerald-700 dark:bg-emerald-500" /> Bazaar modal
        </span>
        <span className="flex items-center gap-1.5">
          <i className="h-3 w-3 rounded bg-amber-400 dark:bg-amber-500" /> Avg farmer ask
        </span>
      </div>
    </div>
  );
}
