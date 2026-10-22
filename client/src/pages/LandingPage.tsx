import { useEffect, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  Landmark,
  Lock,
  ShieldCheck,
  Sprout,
  TrendingDown,
  TrendingUp,
  Wallet,
  Wheat,
  XCircle,
  Zap,
} from 'lucide-react';
import { api } from '../lib/api';
import { num, taka } from '../lib/format';
import { ThemeToggle } from '../context/ThemeContext';
import type { Benchmark, Crop, Role } from '../lib/types';

type RegisterRole = Exclude<Role, 'ADMIN'>;

interface LandingProps {
  onAuth: (mode: 'login' | 'register', role?: RegisterRole) => void;
}

const FALLBACK_TICKERS = [
  { id: 1, crop_category: 'Potato (Diamond)', bazaar_region: 'Bogura', modal_price: 27, min_price: 24, max_price: 30, unit: 'KG' },
  { id: 2, crop_category: 'Onion (Deshi)', bazaar_region: 'Rajshahi', modal_price: 68, min_price: 62, max_price: 74, unit: 'KG' },
  { id: 3, crop_category: 'Miniket Rice', bazaar_region: 'Bogura', modal_price: 62, min_price: 58, max_price: 66, unit: 'KG' },
  { id: 4, crop_category: 'Tomato (Deshi)', bazaar_region: 'Rajshahi', modal_price: 40, min_price: 35, max_price: 46, unit: 'KG' },
];

export default function LandingPage({ onAuth }: LandingProps) {
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([]);
  const [crops, setCrops] = useState<Crop[]>([]);

  useEffect(() => {
    api.benchmarks().then(setBenchmarks).catch(() => undefined);
    api.crops({ status: 'AVAILABLE' }).then(setCrops).catch(() => undefined);
  }, []);

  const tickerItems = benchmarks.length > 0 ? benchmarks : FALLBACK_TICKERS;
  const orderbookLots = crops.slice(0, 3);

  return (
    <div className="min-h-screen bg-[#f4f7f4] text-slate-900 transition-colors duration-200 dark:bg-[#0c1322] dark:text-[#dce2f7]">
      {/* Fixed Top Mandi Ticker + Glassmorphic Nav Header */}
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl dark:border-[#1e293b] dark:bg-[#070e1d]/90">
        {/* Live Mandi Ticker Strip */}
        <div className="border-b border-slate-200/60 bg-slate-100/80 px-4 py-1.5 dark:border-[#1e293b] dark:bg-[#050913]">
          <div className="mx-auto flex max-w-[1320px] items-center justify-between gap-4 overflow-x-auto no-scrollbar">
            <div className="flex shrink-0 items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                High-Frequency Mandi Feed
              </span>
            </div>
            <div className="flex items-center gap-5 font-mono text-[11px] whitespace-nowrap">
              {tickerItems.map((b) => (
                <span key={b.id} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white">{b.crop_category}</strong>
                  <span className="text-slate-400">({b.bazaar_region})</span>
                  <span className="font-bold text-emerald-700 dark:text-emerald-400">{taka(b.modal_price)}/{b.unit}</span>
                  <span className="text-[10px] text-slate-400">
                    [{taka(b.min_price)}-{taka(b.max_price)}]
                  </span>
                </span>
              ))}
            </div>
            <div className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] md:flex">
              <span className="text-slate-500 dark:text-slate-400">Bazaar Sync:</span>
              <span className="font-bold text-emerald-700 dark:text-emerald-400">Active</span>
            </div>
          </div>
        </div>

        {/* Main Nav Bar */}
        <div className="mx-auto flex h-16 max-w-[1320px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="#overview" className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-700 ring-1 ring-emerald-500/30 dark:bg-emerald-500/20 dark:text-emerald-400">
              <Sprout className="h-5 w-5" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
                Khamari
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                Agri Wholesale
              </span>
            </div>
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            <a href="#overview" className="rounded-lg px-3.5 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300">
              Overview
            </a>
            <a href="#orderbook" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#141b2b] dark:hover:text-white">
              Live Orderbook
            </a>
            <a href="#yield-edge" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#141b2b] dark:hover:text-white">
              Yield Edge
            </a>
            <a href="#ecosystem" className="rounded-lg px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#141b2b] dark:hover:text-white">
              Ecosystem
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle compact />
            <button
              type="button"
              onClick={() => onAuth('login')}
              className="rounded-xl px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-[#141b2b]"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onAuth('register')}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white shadow-md shadow-emerald-700/20 transition hover:bg-emerald-800 active:scale-95 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400"
            >
              <span>Launch Terminal</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div id="overview" className="relative overflow-hidden">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-80 w-[760px] -translate-x-1/2 rounded-full bg-emerald-400/15 blur-3xl dark:bg-emerald-500/10" />
        <div className="pointer-events-none absolute right-0 top-40 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />

        <section className="relative z-10 mx-auto max-w-[1320px] px-4 pb-12 pt-8 sm:px-6 lg:px-8 lg:pt-12">
          {/* Top Status Pill */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/80 bg-white/90 px-3.5 py-1.5 shadow-sm backdrop-blur-sm dark:border-emerald-500/25 dark:bg-[#141b2b]">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                Bazaar-Verified Direct Trade &amp; Escrow Engine
              </span>
            </div>
            <div className="hidden items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400 sm:flex">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>64 Districts · Fair-Price Corridor Guard Active</span>
            </div>
          </div>

          {/* Hero Split */}
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-7">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-amber-100 px-2.5 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                  OTC Wholesale &amp; Institutional Hub
                </span>
                <span className="rounded-md bg-emerald-100 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  ACID Stock Protection
                </span>
              </div>

              <h1 className="font-display text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl dark:text-white">
                The High-Yield Mandi Exchange &amp;{' '}
                <span className="bg-gradient-to-r from-emerald-700 via-emerald-600 to-amber-600 bg-clip-text text-transparent dark:from-emerald-400 dark:via-teal-300 dark:to-amber-400">
                  Direct Farmer Protocol
                </span>
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg dark:text-slate-300">
                Connecting Bangladeshi local farmers directly with wholesale buyers, institutional kitchens, and Local Bazaar Committees. Real-time price discovery, live bilateral negotiation, and verified digital receipts on mobile and desktop.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => onAuth('register')}
                  className="btn-primary px-6 py-3.5 text-base"
                >
                  <Zap className="h-5 w-5" />
                  Launch Trading Terminal
                </button>
                <a href="#orderbook" className="btn-ghost px-6 py-3.5 text-base">
                  Explore Live Orderbook
                </a>
                <button
                  type="button"
                  onClick={() => onAuth('login')}
                  className="btn-amber px-5 py-3.5 text-base"
                >
                  Sign In
                </button>
              </div>
            </div>

            {/* Right: KHAMARI_EXEC_PRO Live Orderbook Widget */}
            <div id="orderbook" className="lg:col-span-5">
              <div className="card space-y-4 p-5">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-[#1e293b]">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-mono text-xs font-bold tracking-tight text-slate-800 dark:text-white">
                      KHAMARI_EXEC_PRO v2.6
                    </span>
                  </div>
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    ORDERBOOK LIVE
                  </span>
                </div>

                <div className="space-y-2.5">
                  <div className="font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Live Wholesale Harvest Pools
                  </div>

                  {orderbookLots.length > 0 ? (
                    orderbookLots.map((c) => {
                      const ok = c.fair_price_indicator.isValid;
                      return (
                        <div
                          key={c.id}
                          className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 transition hover:bg-emerald-50/60 dark:bg-[#0c1322] dark:hover:bg-[#191f2f]"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                                {c.crop_category}
                              </span>
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                {c.quality_grade.replace('_', ' ')}
                              </span>
                            </div>
                            <div className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
                              {c.farmer_name} · {c.bazaar_region}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="font-mono text-base font-extrabold text-slate-900 dark:text-white">
                              {taka(c.base_price_per_unit)}
                              <span className="text-[11px] font-normal text-slate-500">/{c.unit}</span>
                            </div>
                            <div className={`flex items-center justify-end gap-1 font-mono text-[11px] font-semibold ${ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                              {ok ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {num(c.quantity_available)} {c.unit}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    FALLBACK_TICKERS.slice(0, 3).map((b) => (
                      <div
                        key={b.id}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-[#0c1322]"
                      >
                        <div>
                          <div className="font-display text-sm font-bold">{b.crop_category}</div>
                          <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                            {b.bazaar_region} Mandi Benchmark
                          </div>
                        </div>
                        <div className="text-right font-mono">
                          <div className="text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                            {taka(b.modal_price)}/{b.unit}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {taka(b.min_price)} - {taka(b.max_price)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Smart Escrow Summary Strip */}
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-50/70 p-3.5 dark:bg-emerald-950/25">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-900 dark:text-white">
                      <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ATOMIC ESCROW &amp; RECEIPT ENGINE
                    </div>
                    <span className="rounded bg-emerald-700 px-2 py-0.5 font-mono text-[10px] font-bold text-white dark:bg-emerald-500 dark:text-slate-950">
                      ACID LOCKED
                    </span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 font-mono text-xs">
                    <div>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">Stock Lock</span>
                      <strong className="text-slate-900 dark:text-white">InnoDB Row</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">Discount Engine</span>
                      <strong className="text-slate-900 dark:text-white">Bulk &amp; Inst.</strong>
                    </div>
                    <div>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400">Verification</span>
                      <strong className="text-emerald-700 dark:text-emerald-400">Bazaar Cert</strong>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onAuth('login')}
                  className="btn-primary w-full"
                >
                  Enter Live Deal Desk
                </button>
              </div>
            </div>
          </div>

          {/* 4 Hero KPI Cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Total Escrow Volume', value: '৳45.8 Cr+', sub: '+18.4% direct settlement', icon: Wallet },
              { label: 'Live Alert Latency', value: '14ms', sub: 'Socket.io pub-sub updates', icon: Zap },
              { label: 'Regional Coverage', value: '64 Districts', sub: 'All 8 Divisions of Bangladesh', icon: Landmark },
              { label: 'Fair-Price Guard', value: '100%', sub: 'Bazaar Committee corridor check', icon: ShieldCheck },
            ].map((k) => (
              <div key={k.label} className="card p-5 hover:border-emerald-400/70">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    {k.label}
                  </span>
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    <k.icon className="h-4 w-4" />
                  </div>
                </div>
                <div className="mt-2 font-display text-3xl font-extrabold text-slate-900 dark:text-white">
                  {k.value}
                </div>
                <div className="mt-1 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-400">
                  {k.sub}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Section 2: The Institutional Yield Edge */}
      <section id="yield-edge" className="border-y border-slate-200/70 bg-slate-100/70 py-14 dark:border-[#1e293b] dark:bg-[#070e1d]">
        <div className="mx-auto max-w-[1320px] px-4 sm:px-6 lg:px-8">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <span className="rounded-full border border-emerald-200 bg-white px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:border-emerald-500/30 dark:bg-[#141b2b] dark:text-emerald-400">
              Financial Alpha &amp; Transparency
            </span>
            <h2 className="mt-3 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
              The Institutional Yield Edge
            </h2>
            <p className="mt-2 text-slate-600 dark:text-slate-400">
              Replacing opaque middleman syndicates and post-dated credit delays with Bazaar-verified pricing and atomic settlements.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Traditional Mandi Trading */}
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-6 dark:border-rose-500/25 dark:bg-rose-950/20">
              <div className="flex items-center justify-between border-b border-rose-200 pb-4 dark:border-rose-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400">
                    <TrendingDown className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-rose-950 dark:text-rose-200">
                      Traditional Mandi Trading
                    </h3>
                    <span className="font-mono text-xs text-rose-700 dark:text-rose-400">
                      Multi-layer middlemen &amp; cash opacity
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-rose-100 px-2.5 py-1 font-mono text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                  -18.4% Net Drag
                </span>
              </div>
              <ul className="mt-5 space-y-3.5 text-sm">
                {[
                  ['Faria / Aratdar Margin Cuts', '15% to 22% farm-gate revenue lost to multi-tier intermediaries.'],
                  ['Delayed Credit & Bad Debts', 'Farmers wait weeks for post-dated wholesale settlement.'],
                  ['Opaque Daily Benchmarks', 'Distress sales below production cost during harvest peaks.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                    <div>
                      <strong className="block text-slate-900 dark:text-white">{t}</strong>
                      <span className="text-slate-600 dark:text-slate-400">{d}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            {/* Khamari Exchange Protocol */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-6 dark:border-emerald-500/25 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between border-b border-emerald-200 pb-4 dark:border-emerald-500/20">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400">
                    <TrendingUp className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-emerald-950 dark:text-emerald-200">
                      Khamari Exchange Protocol
                    </h3>
                    <span className="font-mono text-xs font-bold text-emerald-700 dark:text-emerald-400">
                      Direct Matching &amp; Bazaar Verification
                    </span>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-600 px-2.5 py-1 font-mono text-xs font-bold text-white dark:bg-emerald-500 dark:text-slate-950">
                  +22.8% Margin Uplift
                </span>
              </div>
              <ul className="mt-5 space-y-3.5 text-sm">
                {[
                  ['Direct Farm-to-Wholesale Deals', 'Negotiate directly with verified farmers via live Socket.io deal rooms.'],
                  ['Bazaar Committee Fair-Price Corridor', 'Every ask and bid is validated against daily published min/modal/max floors.'],
                  ['Atomic Stock & Digital Receipts', 'Row-locked MySQL checkout issues verifiable Gate-Pass & Institutional Tax receipts.'],
                ].map(([t, d]) => (
                  <li key={t} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <strong className="block text-slate-900 dark:text-white">{t}</strong>
                      <span className="text-slate-600 dark:text-slate-400">{d}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Section 3: Ecosystem Participants */}
      <section id="ecosystem" className="mx-auto max-w-[1320px] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
            Ecosystem Participants
          </span>
          <h2 className="mt-3 font-display text-2xl font-extrabold text-slate-900 sm:text-3xl dark:text-white">
            Structured for Every Pillar of Agro Commerce
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {[
            {
              role: 'FARMER' as RegisterRole,
              tag: 'Direct Spot Sales',
              title: 'For Farmers & Cooperatives',
              desc: 'List harvest batches on mobile in seconds with photo preview, automatic Bazaar fair-price badges, and instant below-floor offer alerts.',
              bullets: ['Mobile-first touch dashboard', 'Below-floor protection alerts', 'Automated bulk discount tiers'],
              cta: 'Register as Producer',
              icon: Wheat,
              accent: 'emerald',
            },
            {
              role: 'BAZAAR_COMMITTEE' as RegisterRole,
              tag: 'Market Governance',
              title: 'For Bazaar Committees & Hubs',
              desc: 'Publish verified daily min, modal, and max commodity rates per district and monitor real-time marketplace compliance.',
              bullets: ['Live Socket.io price broadcasts', 'Corridor compliance auditing', 'Regional supply price charts'],
              cta: 'Connect Local Mandi',
              icon: Landmark,
              accent: 'amber',
            },
            {
              role: 'BUYER' as RegisterRole,
              tag: 'Bulk Procurement',
              title: 'For Wholesale & Institutional Buyers',
              desc: 'Unified buyer desk to browse verified regional harvest lots, unlock dynamic bulk discounts, negotiate live, and print receipts.',
              bullets: ['Multi-column supply board', 'Side-by-side negotiation drawer', 'Verified digital trade receipts'],
              cta: 'Register as Buyer',
              icon: Building2,
              accent: 'emerald',
            },
          ].map((p) => (
            <div key={p.role} className="card flex flex-col justify-between p-6 hover:-translate-y-1 hover:border-emerald-400">
              <div>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                  p.accent === 'amber'
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                }`}>
                  <p.icon className="h-6 w-6" />
                </div>
                <div className="mt-4 font-mono text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  {p.tag}
                </div>
                <h3 className="mt-1 font-display text-xl font-bold text-slate-900 dark:text-white">
                  {p.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {p.desc}
                </p>
                <ul className="mt-4 space-y-2 text-sm">
                  {p.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-slate-700 dark:text-slate-300">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                type="button"
                onClick={() => onAuth('register', p.role)}
                className="btn-ghost mt-6 w-full justify-between"
              >
                <span>{p.cta}</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-slate-200/80 py-6 text-center font-mono text-xs text-slate-500 dark:border-[#1e293b] dark:text-slate-400">
        Khamari Agricultural Marketplace · Built with Repository, Observer/Pub-Sub, Strategy &amp; Factory Patterns
      </footer>
    </div>
  );
}
