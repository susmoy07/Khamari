import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  Calendar,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  Handshake,
  History,
  ImagePlus,
  Loader2,
  Lock,
  MapPin,
  Megaphone,
  PackageCheck,
  PlusCircle,
  Receipt as ReceiptIcon,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sprout,
  Star,
  TrendingDown,
  TrendingUp,
  Truck,
  Wallet,
} from 'lucide-react';
import { api, API_BASE } from '../../lib/api';
import { benchOf, computeCorridor, dateOnly, num, taka, timeAgo } from '../../lib/format';
import { BD_DIVISIONS, DIVISION_LIST } from '../../lib/bangladeshRegions';
import { useToast } from '../../context/ToastContext';
import FairPriceBadge from '../../components/FairPriceBadge';
import { ComparisonBars, CorridorChart } from '../../components/PriceCharts';
import NegotiationThread from '../../components/NegotiationThread';
import ReceiptView from '../../components/ReceiptView';
import type { Benchmark, Crop, Negotiation, Order, Receipt, Unit, User } from '../../lib/types';

/* ============================================================================
   1. WHOLESALE SUPPLY BOARD (BUYER / INSTITUTION)
   ============================================================================ */
export function MarketView({
  crops,
  benchmarks,
  searchQuery,
  onOffer,
  onViewProfile,
}: {
  crops: Crop[];
  benchmarks: Benchmark[];
  searchQuery: string;
  onOffer: (id: number) => void;
  onViewProfile?: (userId: number) => void;
}) {
  const [catFilter, setCatFilter] = useState('ALL');
  const [region, setRegion] = useState('');
  const [sortBy, setSortBy] = useState<'FAIR' | 'LOW_PRICE' | 'RECENT' | 'VOLUME'>('FAIR');

  const regions = useMemo(() => Array.from(new Set(crops.map((c) => c.bazaar_region))), [crops]);
  const categories = useMemo(
    () => Array.from(new Set(crops.map((c) => c.crop_category))),
    [crops]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = crops.filter((c) => {
      if (catFilter !== 'ALL' && c.crop_category !== catFilter) return false;
      if (region && c.bazaar_region !== region) return false;
      if (q && !`${c.title} ${c.crop_category} ${c.farmer_name} ${c.bazaar_region} KHM-${c.id}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    return [...list].sort((a, b) => {
      if (sortBy === 'LOW_PRICE') return a.base_price_per_unit - b.base_price_per_unit;
      if (sortBy === 'VOLUME') return b.quantity_available - a.quantity_available;
      if (sortBy === 'RECENT') return b.harvest_date.localeCompare(a.harvest_date);
      const va = Math.abs(a.fair_price_indicator.varianceFromModalPct ?? 99);
      const vb = Math.abs(b.fair_price_indicator.varianceFromModalPct ?? 99);
      return va - vb;
    });
  }, [crops, catFilter, region, searchQuery, sortBy]);

  const totalVolumeKg = crops.reduce((s, c) => s + Number(c.quantity_available), 0);
  const topBenchmark = benchmarks[0];

  return (
    <div className="space-y-6">
      {/* 4 Stitch KPI Cards */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard
          label={topBenchmark ? `${topBenchmark.crop_category} Index` : 'Leading Index'}
          value={topBenchmark ? taka(topBenchmark.modal_price) : '৳27.00'}
          unit={topBenchmark ? `/ ${topBenchmark.unit}` : '/ KG'}
          badge={topBenchmark ? topBenchmark.bazaar_region : 'Live'}
          sub={
            topBenchmark
              ? `Range ${taka(topBenchmark.min_price)} - ${taka(topBenchmark.max_price)}`
              : 'Mandi verified'
          }
        />
        <KpiCard
          label="Active Lots Listed"
          value={String(crops.length)}
          unit="Verified"
          badge="Live"
          sub="Bazaar corridor checked"
        />
        <KpiCard
          label="Total Supply Volume"
          value={num(totalVolumeKg)}
          unit="KG"
          badge={`${regions.length} Hubs`}
          sub="Direct farm-gate lots"
        />
        <KpiCard
          label="Verified Commodities"
          value={String(benchmarks.length)}
          unit="Mandis"
          badge="Synced"
          sub="Committee baselines active"
        />
      </section>

      {/* Filter Pills + Region + Sort */}
      <section className="card flex flex-col gap-3 p-3.5 hover:translate-y-0 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar md:pb-0">
          <button
            type="button"
            onClick={() => setCatFilter('ALL')}
            className={`shrink-0 rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
              catFilter === 'ALL'
                ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/25 dark:bg-emerald-500 dark:text-slate-950'
                : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#070e1d] dark:text-slate-300 dark:hover:bg-[#191f2f]'
            }`}
          >
            All Crops ({crops.length})
          </button>
          {categories.map((cat) => (
            <button
              type="button"
              key={cat}
              onClick={() => setCatFilter(cat)}
              className={`shrink-0 rounded-xl px-3.5 py-2 font-mono text-xs font-semibold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
                catFilter === cat
                  ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/25 dark:bg-emerald-500 dark:text-slate-950'
                  : 'bg-slate-100 text-slate-600 hover:bg-emerald-50 hover:text-emerald-800 dark:bg-[#070e1d] dark:text-slate-300 dark:hover:bg-[#191f2f]'
              }`}
            >
              {cat} ({crops.filter((c) => c.crop_category === cat).length})
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className="input w-auto py-2 text-xs font-semibold"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          >
            <option value="">All Regions</option>
            {regions.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <select
            className="input w-auto py-2 text-xs font-semibold"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          >
            <option value="FAIR">Sort: Closest to Bazaar Modal</option>
            <option value="LOW_PRICE">Sort: Lowest Price</option>
            <option value="VOLUME">Sort: Highest Volume</option>
            <option value="RECENT">Sort: Latest Harvest</option>
          </select>
        </div>
      </section>

      {/* 3-Column Produce Lots Grid */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 dark:text-slate-400">
          <Sprout className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">No harvest batches match your filters</p>
        </div>
      ) : (
        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c, idx) => (
            <CropLotCard
              key={c.id}
              crop={c}
              index={idx}
              onViewProfile={onViewProfile}
              action={
                <button
                  type="button"
                  onClick={() => onOffer(c.id)}
                  className="btn-primary w-full py-2.5 text-xs sm:text-sm"
                >
                  <Handshake className="h-4 w-4" /> Make Offer
                </button>
              }
            />
          ))}
        </section>
      )}
    </div>
  );
}

/* ============================================================================
   2. LIVE PRICE INDEX & REGIONAL TRACKER
   ============================================================================ */
export function TrackerView({ benchmarks, crops }: { benchmarks: Benchmark[]; crops: Crop[] }) {
  const verifiedCount = crops.filter((c) => c.fair_price_indicator.isValid).length;
  const avgSpreadPct = useMemo(() => {
    if (benchmarks.length === 0) return 0;
    const sum = benchmarks.reduce(
      (acc, b) => acc + ((b.max_price - b.min_price) / b.modal_price) * 100,
      0
    );
    return Number((sum / benchmarks.length).toFixed(1));
  }, [benchmarks]);

  return (
    <div className="space-y-6">
      {/* 3 Tactical Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="card animate-fade-in stagger-1 p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Market Sentiment
            </span>
            <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3 font-display text-2xl font-extrabold text-slate-900 dark:text-white">
            Fair-Price Anchored
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            {verifiedCount}/{crops.length} active batches inside Bazaar range
          </p>
        </div>

        <div className="card animate-fade-in stagger-2 p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              Corridor Band Width
            </span>
            <MapPin className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
            ±{avgSpreadPct}%
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            Average min-to-max daily Bazaar band
          </p>
        </div>

        <div className="card animate-fade-in stagger-3 p-5">
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
              Tracked Commodities
            </span>
            <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-3 font-mono text-2xl font-extrabold text-slate-900 dark:text-white">
            {benchmarks.length} Live Feeds
          </div>
          <p className="mt-1 font-mono text-xs text-slate-500 dark:text-slate-400">
            Real-time Socket.io price updates active
          </p>
        </div>
      </div>

      {/* 3-Column Commodity Price Index Cards with Sparklines */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {benchmarks.map((b, idx) => {
          const matchingCrops = crops.filter(
            (c) => c.crop_category === b.crop_category && c.bazaar_region === b.bazaar_region
          );
          const avgAsk =
            matchingCrops.length > 0
              ? matchingCrops.reduce((s, c) => s + c.base_price_per_unit, 0) / matchingCrops.length
              : b.modal_price;
          const diffPct = Number((((avgAsk - b.modal_price) / b.modal_price) * 100).toFixed(1));
          const isPositive = diffPct <= 0;

          return (
            <div
              key={b.id}
              style={{ animationDelay: `${Math.min(idx, 5) * 60}ms` }}
              className="card animate-fade-in flex flex-col justify-between p-5 hover:border-emerald-400"
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    {b.bazaar_region} Bazaar · {b.unit}
                  </span>
                </div>
                <h3 className="mt-1 font-display text-base font-bold text-slate-900 dark:text-white">
                  {b.crop_category}
                </h3>

                <div className="mt-3 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white">
                      {taka(b.modal_price)}
                    </span>
                    <span className="font-mono text-xs text-slate-500">/ {b.unit}</span>
                  </div>
                  <span
                    className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${
                      isPositive
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                    }`}
                  >
                    {diffPct > 0 ? `+${diffPct}%` : `${diffPct}%`} vs modal
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-[#1e293b] dark:bg-[#070e1d]">
                  <div>
                    <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                      Official Corridor
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {taka(b.min_price)} - {taka(b.max_price)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                      Active Supply
                    </span>
                    <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      {matchingCrops.length} Lots
                    </span>
                  </div>
                </div>

                {/* Inline SVG Sparkline */}
                <div className="mt-4 h-11 w-full">
                  <svg className="h-full w-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 280 44">
                    <defs>
                      <linearGradient id={`grad-${b.id}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={idx % 2 === 0 ? '#10b981' : '#f59e0b'} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={idx % 2 === 0 ? '#10b981' : '#f59e0b'} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d={
                        idx % 2 === 0
                          ? 'M0,34 Q60,30 120,24 T210,16 L280,8 L280,44 L0,44 Z'
                          : 'M0,14 Q65,18 130,24 T220,20 L280,16 L280,44 L0,44 Z'
                      }
                      fill={`url(#grad-${b.id})`}
                    />
                    <path
                      d={
                        idx % 2 === 0
                          ? 'M0,34 Q60,30 120,24 T210,16 L280,8'
                          : 'M0,14 Q65,18 130,24 T220,20 L280,16'
                      }
                      fill="none"
                      stroke={idx % 2 === 0 ? '#10b981' : '#f59e0b'}
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 font-mono text-[11px] text-slate-500 dark:border-[#1e293b] dark:text-slate-400">
                <span>Verified: {b.verifier_name ?? 'Bazaar Committee'}</span>
                <span>{dateOnly(b.effective_date)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Corridor & Comparison Charts */}
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-5">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900 dark:text-white">
            Regional Price Corridors
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Bazaar Committee min-max band versus live farmer asking prices.
          </p>
          <CorridorChart benchmarks={benchmarks} crops={crops} />
        </section>
        <section className="card p-5">
          <h2 className="mb-1 font-display text-lg font-bold text-slate-900 dark:text-white">
            Bazaar Modal vs. Average Ask
          </h2>
          <p className="mb-4 text-sm text-slate-500 dark:text-slate-400">
            Compare verified market equilibrium against live farmer listings.
          </p>
          <ComparisonBars benchmarks={benchmarks} crops={crops} />
        </section>
      </div>
    </div>
  );
}

/* ============================================================================
   3. BILATERAL DEAL ROOM (STITCH INTERACTIVE DEAL SELECTION)
   ============================================================================ */
export function DealRoomView({
  negotiations,
  user,
  selectedId,
  onSelect,
  onReceipt,
  onChanged,
  onViewProfile,
}: {
  negotiations: Negotiation[];
  user: User;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  onReceipt: (r: Receipt) => void;
  onChanged: () => void;
  onViewProfile?: (userId: number) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<'ACTION' | 'REVIEW' | 'DONE'>('ACTION');
  const [filterText, setFilterText] = useState('');
  const [openConsoleSignal, setOpenConsoleSignal] = useState(0);

  const activeDeals = useMemo(
    () => negotiations.filter((n) => n.status === 'OPEN' || n.status === 'COUNTERED'),
    [negotiations]
  );

  const myTurnDeals = useMemo(
    () =>
      activeDeals.filter((n) => {
        const mySide = n.buyer_id === user.id ? 'BUYER' : 'FARMER';
        return n.last_offered_by !== mySide;
      }),
    [activeDeals, user.id]
  );

  const actionPool = myTurnDeals.length > 0 ? myTurnDeals : activeDeals;
  const doneDeals = useMemo(
    () => negotiations.filter((n) => n.status !== 'OPEN' && n.status !== 'COUNTERED'),
    [negotiations]
  );

  const filtered = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const source = tab === 'ACTION' ? actionPool : tab === 'REVIEW' ? activeDeals : doneDeals;
    return source.filter((n) => {
      if (
        q &&
        !`${n.crop_title} ${n.crop_category} ${n.farmer_name} ${n.buyer_name} ${n.buyer_organization ?? ''} KHM-${n.crop_id} DL-${n.id}`
          .toLowerCase()
          .includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [tab, actionPool, activeDeals, doneDeals, filterText]);

  const activeDesktopId =
    selectedId && negotiations.some((n) => n.id === selectedId)
      ? selectedId
      : filtered[0]?.id ?? activeDeals[0]?.id ?? negotiations[0]?.id ?? null;

  const pipelineTotal = useMemo(
    () =>
      activeDeals.reduce(
        (sum, n) => sum + Number(n.current_offer_price) * Number(n.requested_quantity),
        0
      ),
    [activeDeals]
  );

  const spotIndices = useMemo(() => {
    const seen = new Map<string, { label: string; price: number }>();
    for (const n of negotiations) {
      if (n.bazaar_modal_price != null) {
        const label = n.crop_category.split(' ')[0];
        if (!seen.has(label) && seen.size < 3) {
          seen.set(label, { label, price: n.bazaar_modal_price });
        }
      }
    }
    if (seen.size > 0) return Array.from(seen.values());
    return [
      { label: 'Diamond', price: 27 },
      { label: 'Onion', price: 68 },
      { label: 'Miniket', price: 62 },
    ];
  }, [negotiations]);

  const activeRegionLabel =
    negotiations.find((n) => n.id === activeDesktopId)?.bazaar_region ?? user.region;

  return (
    <div className="space-y-5">
      {/* Top Command Strip (Glass Slab Header) */}
      <section className="card flex flex-wrap items-center justify-between gap-4 p-4 hover:translate-y-0 sm:p-5">
        <div className="flex items-center gap-3.5">
          <div className="h-9 w-2 rounded-full bg-gradient-to-b from-emerald-400 to-teal-600 shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-lg font-extrabold tracking-tight text-slate-900 sm:text-xl dark:text-white">
                Institutional Deal Room
              </h2>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold tracking-wide text-emerald-700 dark:text-emerald-300">
                LIVE SESSIONS ({activeDeals.length})
              </span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Real-time agricultural commodity bilateral price matching &amp; automated escrow settlement
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 px-3.5 py-2 text-xs dark:border-white/5 dark:bg-[#070c16]/80">
            <Wallet className="h-4 w-4 text-amber-500" />
            <span className="text-slate-500 dark:text-slate-400">Escrow Pipeline:</span>
            <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
              {taka(pipelineTotal)}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              toast('ACID InnoDB audit trail active across all bilateral deal sessions.', 'info')
            }
            className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:border-emerald-300 hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-[#121a2c]/70 dark:text-slate-300 dark:hover:text-white sm:inline-flex"
          >
            <History className="h-3.5 w-3.5" />
            <span>Audit Logs</span>
          </button>

          <button
            type="button"
            onClick={() =>
              toast('Bazaar Committee fair-price corridor & row-locked settlement enforced.', 'info')
            }
            className="hidden items-center gap-1.5 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-xs font-semibold text-slate-700 transition-all hover:border-emerald-300 hover:text-slate-950 active:scale-95 dark:border-white/10 dark:bg-[#121a2c]/70 dark:text-slate-300 dark:hover:text-white md:inline-flex"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>Trading Rules</span>
          </button>

          <button
            type="button"
            disabled={!activeDesktopId}
            onClick={() => setOpenConsoleSignal((c) => c + 1)}
            className="btn-primary min-h-[38px] px-4 py-2 text-xs font-bold"
          >
            <Wallet className="h-4 w-4" />
            <span>Escrow &amp; Counter Console</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        </div>
      </section>

      {/* Focused 2-Zone Glass Layout */}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        {/* LEFT ZONE (Col 1-4) - Deals Navigator */}
        <div className="space-y-4 lg:col-span-4">
          <div className="card space-y-3.5 p-4 hover:translate-y-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Active Deals
                </span>
              </div>
              <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2.5 py-0.5 font-mono text-[11px] font-semibold text-slate-600 dark:border-white/10 dark:bg-[#070c16] dark:text-slate-400">
                {actionPool.length} Action / {doneDeals.length} Done
              </span>
            </div>

            {/* 3-Tab Filter Pill Bar */}
            <div className="grid grid-cols-3 gap-1.5 rounded-xl border border-slate-200/70 bg-slate-100/90 p-1 text-xs dark:border-white/5 dark:bg-[#070c16]">
              <button
                type="button"
                onClick={() => setTab('ACTION')}
                className={`rounded-lg px-2 py-1.5 font-bold transition-all duration-200 active:scale-95 ${
                  tab === 'ACTION'
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/25 dark:bg-emerald-500 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Action ({actionPool.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('REVIEW')}
                className={`rounded-lg px-2 py-1.5 font-bold transition-all duration-200 active:scale-95 ${
                  tab === 'REVIEW'
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/25 dark:bg-emerald-500 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Review ({activeDeals.length})
              </button>
              <button
                type="button"
                onClick={() => setTab('DONE')}
                className={`rounded-lg px-2 py-1.5 font-bold transition-all duration-200 active:scale-95 ${
                  tab === 'DONE'
                    ? 'bg-emerald-700 text-white shadow-sm shadow-emerald-700/25 dark:bg-emerald-500 dark:text-slate-950'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Done ({doneDeals.length})
              </button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                className="input py-2 pl-9 text-xs"
                placeholder="Filter grower, lot #, or crop..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
            </div>
          </div>

          {/* Deal Cards List */}
          <div className="space-y-3">
            {filtered.length === 0 ? (
              <div className="card p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                <Handshake className="mx-auto h-9 w-9 text-emerald-600 dark:text-emerald-400" />
                <p className="mt-2 font-semibold text-slate-900 dark:text-white">
                  No deals in this tab
                </p>
              </div>
            ) : (
              filtered.map((n, idx) => {
                const isSelected = activeDesktopId === n.id;
                const mySide = n.buyer_id === user.id ? 'BUYER' : 'FARMER';
                const myTurn =
                  (n.status === 'OPEN' || n.status === 'COUNTERED') &&
                  n.last_offered_by !== mySide;
                const belowFloor =
                  n.bazaar_min_price != null && n.current_offer_price < n.bazaar_min_price;
                const counterpart =
                  mySide === 'BUYER' ? n.farmer_name : n.buyer_organization ?? n.buyer_name;
                const counterpartId = mySide === 'BUYER' ? n.farmer_id : n.buyer_id;
                const counterpartAvatar =
                  mySide === 'BUYER' ? n.farmer_avatar : n.buyer_avatar;
                const totalValuation = Number(n.current_offer_price) * Number(n.requested_quantity);

                return (
                  <div
                    key={n.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelect(n.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelect(n.id);
                      }
                    }}
                    style={{ animationDelay: `${Math.min(idx, 5) * 55}ms` }}
                    className={`animate-fade-in group block w-full cursor-pointer rounded-2xl border p-4 text-left backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.99] ${
                      isSelected
                        ? 'border-emerald-500/70 bg-gradient-to-br from-emerald-50/90 via-white to-emerald-50/40 shadow-[0_12px_30px_-6px_rgba(16,185,129,0.22)] ring-1 ring-emerald-500/30 dark:border-emerald-400/60 dark:from-[#1a263e]/95 dark:via-[#141e33] dark:to-[#0f1726]/95 dark:shadow-[0_12px_30px_-4px_rgba(0,0,0,0.6),0_0_22px_rgba(78,222,163,0.18)]'
                        : 'border-slate-200/90 bg-white/95 shadow-card hover:border-emerald-300 dark:border-[#1e293b] dark:bg-[#121a2c]/80 dark:hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-display text-sm font-bold text-slate-900 transition-colors group-hover:text-emerald-700 dark:text-white dark:group-hover:text-emerald-300">
                          {n.crop_title}
                        </div>
                        <div className="mt-0.5 truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                          Lot #KHM-{n.crop_id} • {num(n.requested_quantity)} {n.unit}
                        </div>
                      </div>

                      {n.status === 'ACCEPTED' ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                          <Lock className="h-3 w-3" />
                          Escrow Locked
                        </span>
                      ) : n.status === 'REJECTED' || n.status === 'CANCELLED' ? (
                        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {n.status}
                        </span>
                      ) : myTurn ? (
                        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-500/35 bg-amber-500/15 px-2.5 py-1 font-mono text-[10px] font-bold text-amber-800 dark:text-amber-300">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
                          {n.status === 'COUNTERED'
                            ? `Countered ${timeAgo(n.updated_at)}`
                            : 'Your Turn'}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full border border-slate-200 bg-slate-100/90 px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-600 dark:border-white/10 dark:bg-[#070c16] dark:text-slate-300">
                          {n.status === 'COUNTERED'
                            ? `Countered ${timeAgo(n.updated_at)}`
                            : 'Sent'}
                        </span>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-emerald-500/40 bg-emerald-500/15 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                        {counterpartAvatar ? (
                          <img
                            src={`${API_BASE}${counterpartAvatar}`}
                            alt={counterpart}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          counterpart.charAt(0).toUpperCase()
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewProfile?.(counterpartId);
                        }}
                        className="font-medium text-slate-800 hover:text-emerald-700 hover:underline dark:text-white dark:hover:text-emerald-300"
                      >
                        {counterpart}
                      </button>
                      <span className="inline-flex items-center gap-0.5 font-mono text-[11px] text-amber-600 dark:text-amber-400">
                        <Star className="h-3 w-3 fill-current" /> 4.9
                      </span>
                      <span className="text-slate-400">• {n.bazaar_region}</span>
                    </div>

                    <div className="mt-3 flex items-baseline justify-between gap-2 border-t border-slate-200/70 pt-2.5 dark:border-white/10">
                      <div className="min-w-0">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          {n.status === 'ACCEPTED'
                            ? 'Agreed Unit'
                            : n.status === 'COUNTERED'
                            ? 'Current Counter'
                            : 'Asking Offer'}
                        </span>
                        <div className="mt-0.5 flex items-baseline gap-1 font-mono">
                          <span className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                            {taka(n.current_offer_price)}
                          </span>
                          <span className="text-xs text-slate-500">/{n.unit}</span>
                        </div>
                      </div>

                      <div className="min-w-0 text-right">
                        <span className="block font-mono text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400">
                          Total Valuation
                        </span>
                        <span className="mt-0.5 block font-mono text-sm font-bold text-slate-900 dark:text-white">
                          {taka(totalValuation)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2">
                      <FairPriceBadge
                        corridor={computeCorridor(n.current_offer_price, benchOf(n))}
                        size="sm"
                      />
                    </div>

                    {belowFloor && n.bazaar_min_price != null && (
                      <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                        Below Bazaar floor ({taka(n.bazaar_min_price)})
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Mini Stats Glass Banner */}
          <div className="card flex items-center justify-between p-3.5 text-xs hover:translate-y-0">
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Bilateral Success Rate:</span>
            </div>
            <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
              92.4%
            </span>
          </div>

          {/* Live Spot Market Strip */}
          <div className="card space-y-2.5 p-4 hover:translate-y-0">
            <div className="flex items-center justify-between">
              <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
                {activeRegionLabel} Region Spot Index
              </span>
              <span className="font-mono text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                Live Mandi Feed
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-200/80 bg-slate-50/90 p-2.5 text-center font-mono text-[11px] text-slate-600 dark:border-white/5 dark:bg-[#070c16] dark:text-slate-400">
              {spotIndices.map((s) => (
                <div key={s.label}>
                  <span className="truncate block">{s.label}:</span>
                  <strong className="mt-0.5 block text-xs text-slate-900 dark:text-white">
                    {taka(s.price)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT ZONE (Col 5-12) - Live Interactive Workspace Stage */}
        <div className="hidden lg:col-span-8 lg:block">
          {activeDesktopId ? (
            <NegotiationThread
              negotiationId={activeDesktopId}
              onReceipt={onReceipt}
              onChanged={onChanged}
              openConsoleSignal={openConsoleSignal}
              onViewProfile={onViewProfile}
            />
          ) : (
            <div className="card flex h-[480px] flex-col items-center justify-center p-8 text-center text-slate-500 hover:translate-y-0 dark:text-slate-400">
              <Handshake className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
              <p className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">
                Select a deal to open the negotiation room
              </p>
              <p className="mt-1 text-sm">
                Submit counter-offers, chat in real time, and generate digital receipts.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Full-Screen Thread Drawer when selected */}
      {selectedId !== null && (
        <div className="animate-sheet-up fixed inset-0 z-50 overflow-y-auto bg-[#f4f7f4] p-3 dark:bg-[#070c18] lg:hidden">
          <NegotiationThread
            negotiationId={selectedId}
            onClose={() => onSelect(null)}
            onReceipt={onReceipt}
            onChanged={onChanged}
            openConsoleSignal={openConsoleSignal}
            onViewProfile={onViewProfile}
          />
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   4. ORDERS & DIGITAL RECEIPTS (3-COLUMN STITCH CARDS)
   ============================================================================ */
export function OrdersView({
  orders,
  user,
  onReceipt,
  onChanged,
  onViewProfile,
}: {
  orders: Order[];
  user: User;
  onReceipt: (r: Receipt) => void;
  onChanged: () => void;
  onViewProfile?: (userId: number) => void;
}) {
  const toast = useToast();
  const [filter, setFilter] = useState<'ALL' | 'CONFIRMED' | 'DISPATCHED' | 'DELIVERED'>('ALL');
  const [busyId, setBusyId] = useState<number | null>(null);

  const filtered = useMemo(
    () => (filter === 'ALL' ? orders : orders.filter((o) => o.order_status === filter)),
    [orders, filter]
  );

  const totalEscrow = orders.reduce((s, o) => s + Number(o.total_amount), 0);
  const activeCount = orders.filter((o) => o.order_status !== 'DELIVERED').length;

  async function openReceipt(o: Order) {
    setBusyId(o.id);
    try {
      onReceipt(await api.receipt(o.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to load receipt', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Top 3 KPI Capsules */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <KpiCard
          label="Total Order Value"
          value={taka(totalEscrow)}
          unit="BDT"
          badge={`${orders.length} Orders`}
          sub="Verified ACID ledger"
        />
        <KpiCard
          label="Active Fulfillment"
          value={String(activeCount)}
          unit="In Progress"
          badge="Escrow"
          sub="Confirmed or dispatched"
        />
        <KpiCard
          label="Delivered & Settled"
          value={String(orders.length - activeCount)}
          unit="Completed"
          badge="100% Clear"
          sub="Digital receipts archived"
        />
      </div>

      {/* Filter Strip */}
      <div className="card flex flex-wrap items-center gap-2 p-2.5 hover:translate-y-0">
        {(['ALL', 'CONFIRMED', 'DISPATCHED', 'DELIVERED'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
              filter === s
                ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#191f2f]'
            }`}
          >
            {s === 'ALL'
              ? `All Orders (${orders.length})`
              : `${s} (${orders.filter((o) => o.order_status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-12 text-center text-slate-500 dark:text-slate-400">
          <ReceiptIcon className="mx-auto h-10 w-10 text-emerald-600 dark:text-emerald-400" />
          <p className="mt-3 font-semibold text-slate-900 dark:text-white">No orders found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((o, idx) => {
            const isFarmer = user.role === 'FARMER';
            return (
              <article
                key={o.id}
                style={{ animationDelay: `${Math.min(idx, 5) * 55}ms` }}
                className="card animate-fade-in flex flex-col justify-between p-5 hover:border-emerald-400"
              >
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#1e293b]">
                    <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                      {o.receipt_number}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-slate-700 dark:bg-[#191f2f] dark:text-emerald-300">
                      {o.order_status}
                    </span>
                  </div>

                  <h3 className="mt-3 font-display text-base font-bold text-slate-900 dark:text-white">
                    {o.crop_title}
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {isFarmer ? 'Buyer: ' : 'Farmer: '}
                    <button
                      type="button"
                      onClick={() => onViewProfile?.(isFarmer ? o.buyer_id : o.farmer_id)}
                      className="font-semibold text-slate-700 hover:text-emerald-700 hover:underline dark:text-slate-200 dark:hover:text-emerald-400"
                    >
                      {isFarmer ? o.buyer_organization ?? o.buyer_name : o.farmer_name}
                    </button>{' '}
                    · {o.bazaar_region}
                  </p>

                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3 dark:bg-[#070e1d]">
                    <div>
                      <span className="block font-mono text-[10px] uppercase text-slate-500">Volume</span>
                      <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                        {num(o.quantity_ordered)} {o.unit}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-500">
                        {taka(o.unit_price_agreed)}/{o.unit}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="block font-mono text-[10px] uppercase text-slate-500">Total</span>
                      <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                        {taka(o.total_amount)}
                      </span>
                      <span className="block font-mono text-[10px] text-slate-500">
                        {o.payment_status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3 dark:border-[#1e293b]">
                  <button
                    type="button"
                    onClick={() => openReceipt(o)}
                    disabled={busyId === o.id}
                    className="btn-ghost flex-1 py-2 text-xs"
                  >
                    {busyId === o.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ReceiptIcon className="h-4 w-4" />
                    )}{' '}
                    Inspect Receipt
                  </button>

                  {isFarmer && o.order_status === 'CONFIRMED' && (
                    <button
                      type="button"
                      className="btn-primary flex-1 py-2 text-xs"
                      onClick={async () => {
                        try {
                          await api.updateOrderStatus(o.id, { order_status: 'DISPATCHED' });
                          toast('Marked as dispatched.', 'success');
                          onChanged();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : 'Failed', 'error');
                        }
                      }}
                    >
                      <Truck className="h-4 w-4" /> Dispatch
                    </button>
                  )}

                  {!isFarmer && o.order_status === 'DISPATCHED' && (
                    <button
                      type="button"
                      className="btn-primary flex-1 py-2 text-xs"
                      onClick={async () => {
                        try {
                          await api.updateOrderStatus(o.id, {
                            order_status: 'DELIVERED',
                            payment_status: 'PAID',
                          });
                          toast('Marked delivered & paid.', 'success');
                          onChanged();
                        } catch (e) {
                          toast(e instanceof Error ? e.message : 'Failed', 'error');
                        }
                      }}
                    >
                      <PackageCheck className="h-4 w-4" /> Confirm Delivery
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================================
   5. FARMER: MY HARVEST LOTS & QUICK UPLOAD
   ============================================================================ */
export function FarmerLotsView({
  crops,
  negotiations,
  onAdd,
  onOpenOffers,
}: {
  crops: Crop[];
  negotiations: Negotiation[];
  onAdd: () => void;
  onOpenOffers: () => void;
}) {
  const totalKg = crops.reduce((s, c) => s + Number(c.quantity_available), 0);
  const activeOffers = negotiations.filter(
    (n) => n.status === 'OPEN' || n.status === 'COUNTERED'
  ).length;
  const belowFloorCount = negotiations.filter(
    (n) =>
      (n.status === 'OPEN' || n.status === 'COUNTERED') &&
      n.bazaar_min_price != null &&
      n.current_offer_price < n.bazaar_min_price
  ).length;

  return (
    <div className="space-y-6">
      {belowFloorCount > 0 && (
        <button
          type="button"
          onClick={onOpenOffers}
          className="animate-fade-in group flex w-full items-center justify-between gap-3 rounded-2xl border border-rose-300 bg-rose-600 px-4 py-3 text-left text-sm font-bold text-white shadow-md shadow-rose-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:bg-rose-700 hover:shadow-lg active:scale-[0.99]"
        >
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 animate-pulse" />
            {belowFloorCount} buyer offer{belowFloorCount > 1 ? 's' : ''} dropped below the Bazaar Committee floor price!
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-300 group-hover:translate-x-1" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="My Harvest Lots" value={String(crops.length)} unit="Batches" badge="Listed" sub="Active & archived" />
        <KpiCard label="Available Stock" value={num(totalKg)} unit="KG" badge="Ready" sub="Across your lots" />
        <KpiCard label="Open Buyer Offers" value={String(activeOffers)} unit="Deals" badge="Live" sub="In negotiation" />
        <KpiCard
          label="Below-Floor Alerts"
          value={String(belowFloorCount)}
          unit="Warnings"
          badge={belowFloorCount > 0 ? 'Review' : 'Safe'}
          sub="Bazaar floor guard"
        />
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
            Your Active Harvest Lots
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Monitored continuously against daily regional Bazaar Committee rates.
          </p>
        </div>
        <button type="button" onClick={onAdd} className="btn-amber py-2.5 text-sm">
          <PlusCircle className="h-4 w-4" /> Post Harvest Lot
        </button>
      </div>

      {crops.length === 0 ? (
        <div className="card p-10 text-center">
          <Sprout className="mx-auto h-12 w-12 text-emerald-600 dark:text-emerald-400" />
          <p className="mt-3 font-display text-lg font-bold text-slate-900 dark:text-white">
            No crops listed yet
          </p>
          <button type="button" onClick={onAdd} className="btn-amber mt-4">
            <PlusCircle className="h-5 w-5" /> List your first crop
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {crops.map((c, idx) => (
            <CropLotCard key={c.id} crop={c} index={idx} />
          ))}
        </div>
      )}
    </div>
  );
}

export function FarmerAddCropView({
  user,
  benchmarks,
  onDone,
}: {
  user: User;
  benchmarks: Benchmark[];
  onDone: () => void;
}) {
  const toast = useToast();
  const [benchId, setBenchId] = useState<number | ''>(benchmarks[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');
  const [minOrder, setMinOrder] = useState('50');
  const [bulkQty, setBulkQty] = useState('');
  const [bulkPct, setBulkPct] = useState('');
  const [harvest, setHarvest] = useState(new Date().toISOString().slice(0, 10));
  const [grade, setGrade] = useState('GRADE_A');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const bench = useMemo(
    () => benchmarks.find((b) => b.id === benchId) ?? null,
    [benchmarks, benchId]
  );

  const corridor = price
    ? computeCorridor(
        Number(price),
        bench
          ? benchOf({
              bazaar_min_price: bench.min_price,
              bazaar_modal_price: bench.modal_price,
              bazaar_max_price: bench.max_price,
            })
          : null
      )
    : null;

  function pick(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit() {
    if (!bench) return toast('Select a crop category baseline first.', 'error');
    if (!title.trim() || !(Number(qty) > 0) || !(Number(price) > 0)) {
      return toast('Enter a title, quantity, and asking price.', 'error');
    }
    const fd = new FormData();
    fd.append('title', title.trim());
    fd.append('crop_category', bench.crop_category);
    fd.append('bazaar_region', bench.bazaar_region);
    fd.append('unit', bench.unit);
    fd.append('quantity_available', qty);
    fd.append('min_order_quantity', minOrder || '10');
    fd.append('base_price_per_unit', price);
    if (bulkQty) fd.append('bulk_threshold_qty', bulkQty);
    fd.append('bulk_discount_pct', bulkPct || '0');
    fd.append('harvest_date', harvest);
    fd.append('quality_grade', grade);
    if (file) fd.append('image', file);

    setBusy(true);
    try {
      await api.createCrop(fd);
      toast('Crop listed live on Khamari!', 'success');
      onDone();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to list crop', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="card animate-fade-in space-y-4 p-5 hover:translate-y-0 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
              Post Harvest Lot
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Verified directly against today&apos;s Bazaar Committee baseline.
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            {user.region}
          </span>
        </div>

        <label className="relative flex aspect-[16/9] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/40 dark:bg-[#070e1d] dark:text-emerald-300">
          {preview ? (
            <img src={preview} alt="Crop preview" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <>
              <ImagePlus className="h-11 w-11" />
              <span className="mt-2 text-sm font-semibold">Tap to add harvest photo</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">Camera or gallery</span>
            </>
          )}
          {preview && (
            <span className="absolute bottom-2.5 right-2.5 flex items-center gap-1 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
              <Camera className="h-4 w-4" /> Change Photo
            </span>
          )}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => pick(e.target.files?.[0] ?? null)}
          />
        </label>

        <label className="block">
          <span className="label">Crop Category &amp; Mandi Baseline</span>
          <select
            className="input"
            value={benchId}
            onChange={(e) => setBenchId(Number(e.target.value))}
          >
            {benchmarks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.crop_category} — {b.bazaar_region} ({b.unit})
              </option>
            ))}
          </select>
        </label>

        {bench && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-3.5 py-2.5 font-mono text-xs text-emerald-900 dark:border-emerald-500/25 dark:bg-emerald-950/30 dark:text-emerald-200">
            Bazaar Baseline: <b>{taka(bench.min_price)} - {taka(bench.max_price)}</b> / {bench.unit} (Modal{' '}
            <b>{taka(bench.modal_price)}</b>)
          </div>
        )}

        <label className="block">
          <span className="label">Listing Title</span>
          <input
            className="input"
            placeholder="e.g. Bogura Fresh Diamond Potatoes (Grade A)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Quantity ({bench?.unit ?? 'KG'})</span>
            <input
              className="input font-mono text-lg font-bold"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Asking Price / {bench?.unit ?? 'KG'}</span>
            <input
              className="input font-mono text-lg font-bold"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
        </div>

        {corridor && (
          <div className="space-y-1.5">
            <FairPriceBadge corridor={corridor} size="lg" />
            {!corridor.isValid && (
              <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                {corridor.message}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Min Order</span>
            <input className="input font-mono" inputMode="decimal" value={minOrder} onChange={(e) => setMinOrder(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Harvest Date</span>
            <input className="input font-mono" type="date" value={harvest} onChange={(e) => setHarvest(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Bulk Discount From (Qty)</span>
            <input className="input font-mono" inputMode="decimal" placeholder="optional" value={bulkQty} onChange={(e) => setBulkQty(e.target.value)} />
          </label>
          <label className="block">
            <span className="label">Bulk Discount %</span>
            <input className="input font-mono" inputMode="decimal" placeholder="optional" value={bulkPct} onChange={(e) => setBulkPct(e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="label">Quality Grade</span>
          <select className="input" value={grade} onChange={(e) => setGrade(e.target.value)}>
            <option value="GRADE_A">Grade A</option>
            <option value="GRADE_B">Grade B</option>
            <option value="STANDARD">Standard</option>
          </select>
        </label>

        <button type="button" className="btn-primary w-full py-3.5 text-base" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlusCircle className="h-5 w-5" />}
          Publish Harvest Lot
        </button>
      </div>
    </div>
  );
}

/* ============================================================================
   6. BAZAAR COMMITTEE: PUBLISH BASELINES & COMPLIANCE
   ============================================================================ */
export function PublishView({
  benchmarks,
  crops,
  onPublished,
}: {
  benchmarks: Benchmark[];
  crops: Crop[];
  onPublished: () => void;
}) {
  const toast = useToast();
  const [category, setCategory] = useState('Potato (Diamond)');
  const [division, setDivision] = useState('Rajshahi');
  const [region, setRegion] = useState('Bogura');
  const [unit, setUnit] = useState<Unit>('KG');
  const [min, setMin] = useState('');
  const [modal, setModal] = useState('');
  const [max, setMax] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const districts = BD_DIVISIONS[division] ?? [];
  const valid = Number(min) > 0 && Number(min) <= Number(modal) && Number(modal) <= Number(max);
  const compliantLots = crops.filter((c) => c.fair_price_indicator.isValid).length;

  function fill(b: Benchmark) {
    setCategory(b.crop_category);
    setRegion(b.bazaar_region);
    setUnit(b.unit);
    setMin(String(b.min_price));
    setModal(String(b.modal_price));
    setMax(String(b.max_price));
    setNotes(b.market_notes ?? '');
  }

  async function submit() {
    if (!valid) return toast('Prices must satisfy 0 < min <= modal <= max.', 'error');
    setBusy(true);
    try {
      await api.publishPrice({
        crop_category: category,
        bazaar_region: region,
        unit,
        min_price: Number(min),
        modal_price: Number(modal),
        max_price: Number(max),
        market_notes: notes || undefined,
      });
      toast('Published! All connected farmers & buyers notified live.', 'success');
      onPublished();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to publish', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <KpiCard label="Published Benchmarks" value={String(benchmarks.length)} unit="Active" badge="Live" sub="Daily Mandi floors" />
        <KpiCard label="Monitored Lots" value={String(crops.length)} unit="Batches" badge="Real-time" sub="Auto-linked by region" />
        <KpiCard label="Corridor Pass Rate" value={`${crops.length ? Math.round((compliantLots / crops.length) * 100) : 100}%`} unit="Compliant" badge="Verified" sub={`${compliantLots} lots in range`} />
        <KpiCard label="Broadcast Channel" value="Socket.io" unit="Pub-Sub" badge="Synced" sub="Instant ticker push" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[430px_1fr]">
        <section className="card space-y-3 p-5 hover:translate-y-0">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-slate-900 dark:text-white">
            <Megaphone className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Publish Daily Baseline
          </h2>
          <label className="block">
            <span className="label">Commodity</span>
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} />
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="label">Division</span>
              <select
                className="input"
                value={division}
                onChange={(e) => {
                  const div = e.target.value;
                  setDivision(div);
                  setRegion((BD_DIVISIONS[div] ?? [])[0] ?? '');
                }}
              >
                {DIVISION_LIST.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="label">District / Mandi</span>
              <select className="input" value={region} onChange={(e) => setRegion(e.target.value)}>
                {!districts.includes(region) && <option value={region}>{region}</option>}
                {districts.map((dist) => (
                  <option key={dist} value={dist}>
                    {dist}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="label">Unit</span>
            <select className="input" value={unit} onChange={(e) => setUnit(e.target.value as Unit)}>
              <option>KG</option>
              <option>MAUND</option>
              <option>TON</option>
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2.5">
            <label className="block">
              <span className="label">Min (৳)</span>
              <input className="input font-mono font-bold" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Modal (৳)</span>
              <input className="input font-mono font-bold" inputMode="decimal" value={modal} onChange={(e) => setModal(e.target.value)} />
            </label>
            <label className="block">
              <span className="label">Max (৳)</span>
              <input className="input font-mono font-bold" inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} />
            </label>
          </div>
          <label className="block">
            <span className="label">Market Notes</span>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {!valid && (min || modal || max) && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400">
              Prices must satisfy 0 &lt; min &le; modal &le; max.
            </p>
          )}
          <button type="button" className="btn-primary w-full" disabled={busy || !valid} onClick={submit}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Megaphone className="h-5 w-5" />}
            Publish &amp; Broadcast
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Active Regional Baselines (click to edit)
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {benchmarks.map((b, idx) => (
              <button
                key={b.id}
                type="button"
                onClick={() => fill(b)}
                style={{ animationDelay: `${Math.min(idx, 5) * 55}ms` }}
                className="card animate-fade-in p-4 text-left transition-all duration-300 hover:border-emerald-400 active:scale-[0.99]"
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-bold text-slate-900 dark:text-white">
                    {b.crop_category}
                  </span>
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {b.bazaar_region}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-2.5 text-center font-mono dark:bg-[#070e1d]">
                  <div>
                    <span className="block text-[10px] text-slate-500">Min</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{taka(b.min_price)}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-emerald-700 dark:text-emerald-400">Modal</span>
                    <strong className="text-sm text-emerald-700 dark:text-emerald-400">{taka(b.modal_price)}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] text-slate-500">Max</span>
                    <strong className="text-sm text-slate-900 dark:text-white">{taka(b.max_price)}</strong>
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Unit: {b.unit}</span>
                  <span>{dateOnly(b.effective_date)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ComplianceView({
  crops,
  onViewProfile,
}: {
  crops: Crop[];
  onViewProfile?: (userId: number) => void;
}) {
  const [filter, setFilter] = useState<'ALL' | 'VALID' | 'FLAGGED'>('ALL');
  const flagged = crops.filter((c) => !c.fair_price_indicator.isValid);
  const rows =
    filter === 'ALL' ? crops : filter === 'FLAGGED' ? flagged : crops.filter((c) => c.fair_price_indicator.isValid);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <KpiCard label="Active Listings" value={String(crops.length)} unit="Lots" badge="Live" sub="Total catalog" />
        <KpiCard label="Within Bazaar Range" value={String(crops.length - flagged.length)} unit="Compliant" badge="Verified" sub="Fair-price verified" />
        <KpiCard label="Flagged Outside Range" value={String(flagged.length)} unit="Alerts" badge={flagged.length ? 'Attention' : 'Clean'} sub="Below floor or above cap" />
      </div>

      <div className="card flex flex-wrap items-center gap-2 p-2.5 hover:translate-y-0">
        <button
          type="button"
          onClick={() => setFilter('ALL')}
          className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
            filter === 'ALL'
              ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#191f2f]'
          }`}
        >
          All Lots ({crops.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('VALID')}
          className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
            filter === 'VALID'
              ? 'bg-emerald-700 text-white shadow-sm dark:bg-emerald-500 dark:text-slate-950'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#191f2f]'
          }`}
        >
          Verified ({crops.length - flagged.length})
        </button>
        <button
          type="button"
          onClick={() => setFilter('FLAGGED')}
          className={`rounded-xl px-3.5 py-2 font-mono text-xs font-bold transition-all duration-200 hover:-translate-y-0.5 active:scale-95 ${
            filter === 'FLAGGED'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30'
          }`}
        >
          Flagged ({flagged.length})
        </button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((c, idx) => (
          <CropLotCard key={c.id} crop={c} index={idx} onViewProfile={onViewProfile} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================================
   SHARED STITCH PRIMITIVES
   ============================================================================ */
function KpiCard({
  label,
  value,
  unit,
  badge,
  sub,
}: {
  label: string;
  value: string;
  unit: string;
  badge: string;
  sub: string;
}) {
  return (
    <div className="card group animate-fade-in flex flex-col justify-between p-4 hover:border-emerald-400/70 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {label}
        </span>
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 transition-transform duration-300 group-hover:scale-105 dark:bg-emerald-500/15 dark:text-emerald-300">
          {badge}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-mono text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {value}
        </span>
        <span className="font-mono text-xs text-slate-500 dark:text-slate-400">{unit}</span>
      </div>
      <div className="mt-2 border-t border-slate-100 pt-2 font-mono text-[11px] text-slate-500 dark:border-[#1e293b] dark:text-slate-400">
        {sub}
      </div>
    </div>
  );
}

function CropLotCard({
  crop: c,
  action,
  index = 0,
  onViewProfile,
}: {
  crop: Crop;
  action?: React.ReactNode;
  index?: number;
  onViewProfile?: (userId: number) => void;
}) {
  return (
    <article
      style={{ animationDelay: `${Math.min(index, 5) * 60}ms` }}
      className="card group animate-fade-in flex flex-col overflow-hidden hover:border-emerald-400"
    >
      {/* Top Visual Banner */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-emerald-900/15 to-amber-500/15 dark:from-[#070e1d] dark:to-[#132920]">
        {c.image_url ? (
          <img
            src={`${API_BASE}${c.image_url}`}
            alt={c.title}
            className="h-full w-full object-cover transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-emerald-700/60 transition-transform duration-300 group-hover:scale-110 dark:text-emerald-400/60">
            <Sprout className="h-14 w-14" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/25" />

        <div className="absolute left-3 top-3 flex gap-1.5">
          <span className="rounded-md bg-emerald-700/90 px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-white shadow-sm shadow-emerald-700/35 backdrop-blur-sm">
            {c.quality_grade.replace('_', ' ')}
          </span>
          <span className="rounded-md bg-white/90 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-900 backdrop-blur-sm">
            Lot #KHM-{c.id}
          </span>
        </div>

        <div className="absolute bottom-2.5 left-3 flex items-center gap-1 rounded-full bg-black/65 px-2.5 py-0.5 font-mono text-[10px] font-medium text-white backdrop-blur-sm">
          <Calendar className="h-3 w-3 text-emerald-400" />
          <span>Harvested: {dateOnly(c.harvest_date)}</span>
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div>
          <h3 className="font-display text-base font-bold leading-snug text-slate-900 dark:text-white">
            {c.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            {c.farmer_avatar ? (
              <img
                src={`${API_BASE}${c.farmer_avatar}`}
                alt={c.farmer_name}
                className="h-4 w-4 shrink-0 rounded-full object-cover"
              />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onViewProfile?.(c.farmer_id);
              }}
              className="font-semibold text-slate-700 hover:text-emerald-700 hover:underline dark:text-slate-200 dark:hover:text-emerald-400"
            >
              {c.farmer_name}
            </button>
            <span>·</span>
            <span>{c.bazaar_region}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50 p-3 dark:border-[#1e293b] dark:bg-[#070e1d]">
          <div>
            <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
              Available Vol
            </span>
            <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
              {num(c.quantity_available)} {c.unit}
            </span>
            <span className="block font-mono text-[10px] text-slate-500">
              Min {num(c.min_order_quantity)} {c.unit}
            </span>
          </div>
          <div className="text-right">
            <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
              Lot Price
            </span>
            <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
              {taka(c.base_price_per_unit)}
            </span>
            <span className="block font-mono text-[10px] text-amber-600 dark:text-amber-400">
              {c.bulk_threshold_qty
                ? `${c.bulk_discount_pct}% off ${num(c.bulk_threshold_qty)}+`
                : `per ${c.unit}`}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <FairPriceBadge corridor={c.fair_price_indicator} size="sm" />
          {c.bazaar_modal_price != null && (
            <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Modal {taka(c.bazaar_modal_price)}
            </span>
          )}
        </div>

        {action && <div className="pt-1">{action}</div>}
      </div>
    </article>
  );
}
