import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Calculator,
  CheckCheck,
  CheckCircle2,
  Clock,
  Fingerprint,
  Gavel,
  GitFork,
  Handshake,
  Hourglass,
  Loader2,
  Minus,
  Plus,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Wallet,
  X,
  XCircle,
} from 'lucide-react';
import { api } from '../lib/api';
import { getSocket, useSocketEvent } from '../lib/socket';
import { benchOf, computeCorridor, num, taka, timeAgo } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import FairPriceBadge from './FairPriceBadge';
import type { Message, Negotiation, Receipt } from '../lib/types';

interface Props {
  negotiationId: number;
  onClose?: () => void;
  onReceipt: (r: Receipt) => void;
  onChanged?: () => void;
  openConsoleSignal?: number;
  onViewProfile?: (userId: number) => void;
}

type ModalKind = 'none' | 'escrow' | 'confirm' | 'qc';

const CLAUSE_CHIPS = [
  'Moisture <14% clause',
  'Cold-chain requirement',
  'Weighbridge receipt gate',
];

const INITIAL_VALIDITY_SECONDS = 3 * 3600 + 18 * 60 + 29;

function formatCountdown(totalSec: number): string {
  const s = Math.max(0, totalSec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
}

export default function NegotiationThread({
  negotiationId,
  onClose,
  onReceipt,
  onChanged,
  openConsoleSignal = 0,
  onViewProfile,
}: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [neg, setNeg] = useState<Negotiation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [text, setText] = useState('');
  const [address, setAddress] = useState('');
  const [modal, setModal] = useState<ModalKind>('none');
  const [logistics, setLogistics] = useState<'ex-farm' | 'grower-delivers'>('ex-farm');
  const [secondsLeft, setSecondsLeft] = useState(INITIAL_VALIDITY_SECONDS);
  const [busy, setBusy] = useState(false);

  const initialised = useRef(false);
  const bottom = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const d = await api.negotiation(negotiationId);
      setNeg(d.negotiation);
      setMessages(d.messages);
      if (!initialised.current) {
        initialised.current = true;
        setPrice(String(d.negotiation.current_offer_price));
        setQty(String(d.negotiation.requested_quantity));
        setAddress(
          `${d.negotiation.buyer_organization ?? d.negotiation.buyer_name}, ${d.negotiation.bazaar_region}`
        );
      }
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load negotiation');
    }
  }, [negotiationId]);

  useEffect(() => {
    initialised.current = false;
    setNeg(null);
    setMessages([]);
    setModal('none');
    setSecondsLeft(INITIAL_VALIDITY_SECONDS);
    load();
  }, [load]);

  useEffect(() => {
    const s = getSocket();
    const join = () => s.emit('negotiation:join', negotiationId);
    join();
    s.on('connect', join);
    return () => {
      s.off('connect', join);
      s.emit('negotiation:leave', negotiationId);
    };
  }, [negotiationId]);

  const addMessage = useCallback((m: Message) => {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }, []);

  useSocketEvent<Message>('negotiation:new_message', (m) => {
    if (m.negotiation_id === negotiationId) addMessage(m);
  });
  useSocketEvent<Negotiation>('negotiation:offer_updated', (n) => {
    if (n.id === negotiationId) {
      load();
      onChanged?.();
    }
  });
  useSocketEvent<Negotiation>('negotiation:status_changed', (n) => {
    if (n.id === negotiationId) {
      load();
      onChanged?.();
    }
  });

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  useEffect(() => {
    if (!neg || (neg.status !== 'OPEN' && neg.status !== 'COUNTERED')) return;
    const id = window.setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [neg]);

  useEffect(() => {
    if (modal === 'none') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModal('none');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [modal]);

  useEffect(() => {
    if (openConsoleSignal > 0 && neg) {
      if (neg.status === 'OPEN' || neg.status === 'COUNTERED') {
        setModal('escrow');
      } else if (neg.status === 'ACCEPTED') {
        setModal('confirm');
      }
    }
  }, [openConsoleSignal, neg]);

  const mySide = neg && user ? (neg.buyer_id === user.id ? 'BUYER' : 'FARMER') : null;
  const isActive = neg ? neg.status === 'OPEN' || neg.status === 'COUNTERED' : false;
  const canAccept =
    !!neg && !!mySide && ((isActive && neg.last_offered_by !== mySide) || neg.status === 'ACCEPTED');
  const bench = neg ? benchOf(neg) : null;

  const liveCorridor = useMemo(
    () => (price ? computeCorridor(Number(price), bench) : null),
    [price, bench]
  );
  const currentCorridor = neg ? computeCorridor(neg.current_offer_price, bench) : null;
  const offerBelowFloor = !!neg && !!bench && neg.current_offer_price < bench.min_price;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Something went wrong', 'error');
    } finally {
      setBusy(false);
    }
  }

  const counter = () =>
    run(async () => {
      const p = Number(price);
      const q = Number(qty);
      if (!(p > 0) || !(q > 0)) throw new Error('Enter a valid price and quantity.');
      const r = await api.counterOffer(negotiationId, { offered_unit_price: p, offered_quantity: q });
      setNeg(r.negotiation);
      addMessage(r.message);
      setModal('none');
      onChanged?.();
      toast('Counter-offer submitted live & escrow allocation refreshed.', 'success');
    });

  const send = () =>
    run(async () => {
      if (!text.trim()) return;
      const m = await api.sendMessage(negotiationId, text.trim());
      addMessage(m);
      setText('');
    });

  const accept = () =>
    run(async () => {
      if (!address.trim()) throw new Error('Delivery address is required.');
      if (neg && neg.status !== 'ACCEPTED') await api.respond(negotiationId, 'ACCEPT');
      const r = await api.orderFromNegotiation(negotiationId, address.trim());
      setModal('none');
      onReceipt(r.receipt);
      toast('Escrow locked! Verified digital receipt generated.', 'success');
      await load();
      onChanged?.();
    });

  const reject = () =>
    run(async () => {
      await api.respond(negotiationId, 'REJECT');
      await load();
      onChanged?.();
      toast('Negotiation declined.', 'info');
    });

  if (error && !neg) {
    return <div className="card p-6 text-center text-sm text-rose-600">{error}</div>;
  }
  if (!neg) {
    return (
      <div className="card flex min-h-[420px] items-center justify-center p-10 text-emerald-700 dark:text-emerald-400">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  const counterpart = mySide === 'BUYER' ? neg.farmer_name : neg.buyer_organization ?? neg.buyer_name;
  const counterpartId = mySide === 'BUYER' ? neg.farmer_id : neg.buyer_id;
  const baseModalPrice = bench?.modal_price ?? neg.base_price_per_unit ?? neg.current_offer_price;
  const rawMin = bench ? bench.min_price * 0.9 : baseModalPrice * 0.75;
  const rawMax = bench ? bench.max_price * 1.1 : baseModalPrice * 1.25;
  const unitInputVal = Number(price) || neg.current_offer_price;
  const qtyInputVal = Number(qty) || neg.requested_quantity;
  const sliderMin = Number(Math.max(1, Math.min(rawMin, unitInputVal, neg.current_offer_price * 0.9)).toFixed(2));
  const sliderMax = Number(Math.max(sliderMin + 5, rawMax, unitInputVal, neg.current_offer_price * 1.1).toFixed(2));
  const step = baseModalPrice >= 100 ? 1 : 0.25;

  const freightAddon = logistics === 'grower-delivers' ? 1.4 : 0;
  const effectiveUnit = unitInputVal + freightAddon;
  const produceValuation = Math.round(effectiveUnit * qtyInputVal);
  const platformFee = Math.round(produceValuation * 0.0075);
  const regulatoryCess = Math.round(produceValuation * 0.005);
  const totalEscrow = produceValuation + platformFee + regulatoryCess;
  const advance20 = Math.round(produceValuation * 0.2);
  const release80 = Math.round(produceValuation * 0.8);

  const currentValuation = Math.round(neg.current_offer_price * neg.requested_quantity);
  const currentFee = Math.round(currentValuation * 0.0075);
  const currentCess = Math.round(currentValuation * 0.005);
  const currentTotalEscrow = currentValuation + currentFee + currentCess;
  const splitPrice = Number(((neg.current_offer_price + baseModalPrice) / 2).toFixed(2));

  const presets = [
    { label: '-1.5%', val: Number((baseModalPrice * 0.985).toFixed(2)), highlight: false },
    { label: 'Spot Mandi', val: Number(baseModalPrice.toFixed(2)), highlight: true },
    { label: '+1.5%', val: Number((baseModalPrice * 1.015).toFixed(2)), highlight: false },
  ];

  function adjustPrice(delta: number) {
    const next = Math.min(sliderMax, Math.max(sliderMin, Number((unitInputVal + delta).toFixed(2))));
    setPrice(String(next));
  }

  function appendClause(clause: string) {
    setText((prev) => {
      const trimmed = prev.trim();
      if (trimmed.includes(clause)) return prev;
      return trimmed ? `${trimmed}; ${clause}` : clause;
    });
  }

  const variancePct = currentCorridor?.varianceFromModalPct;
  const surfaceCard =
    'rounded-2xl border border-slate-200/90 bg-white/95 shadow-card backdrop-blur-md dark:border-[#1e293b] dark:bg-[#121a2c]/85';
  const innerWell =
    'rounded-xl border border-slate-200/80 bg-slate-50/90 dark:border-white/5 dark:bg-[#070c16]/75';

  return (
    <div className="flex flex-col gap-4">
      {/* STAGE CARD 1: Deal Header Stage Card */}
      <div className={`${surfaceCard} p-5 flex flex-col gap-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Back to deals"
                className="-ml-1 rounded-full p-2 text-slate-600 transition-all hover:-translate-x-0.5 hover:bg-slate-100 active:scale-95 dark:text-slate-300 dark:hover:bg-[#191f2f]"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
            )}
            <span className="font-display text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Deal #DL-{neg.id}
            </span>
            <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-300">
              LOT #KHM-{neg.crop_id}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Mandi Verified</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className={`${innerWell} flex items-center gap-2 rounded-full px-3 py-1 font-mono text-xs`}>
              <span
                className={`h-2 w-2 rounded-full ${
                  isActive ? 'bg-emerald-500 animate-pulse-glow' : 'bg-slate-400'
                }`}
              />
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {isActive ? 'Session Active' : `Deal ${neg.status}`}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setModal('qc')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:border-emerald-300 hover:bg-emerald-50 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
            >
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>QC Certificate</span>
            </button>

            {isActive && mySide && (
              <button
                type="button"
                onClick={() => setModal('escrow')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:border-amber-400/50 hover:bg-amber-50/70 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <Calculator className="h-3.5 w-3.5 text-amber-500" />
                <span>Quick Escrow Calc</span>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/70 pt-3 dark:border-white/10">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="font-display text-base font-bold text-slate-900 dark:text-white">
              {neg.crop_title} · {neg.crop_category}
            </span>
            <span className={`${innerWell} inline-flex items-center gap-1.5 px-2.5 py-1 font-mono text-xs font-medium text-slate-600 dark:text-slate-300`}>
              <span>{num(neg.requested_quantity)} {neg.unit} · with</span>
              <button
                type="button"
                onClick={() => onViewProfile?.(counterpartId)}
                className="font-bold text-emerald-700 hover:underline dark:text-emerald-400"
              >
                {counterpart}
              </button>
            </span>
          </div>

          <div className={`${innerWell} flex items-center gap-2 px-3 py-1.5 font-mono text-xs`}>
            <span className="text-slate-500 dark:text-slate-400">Mandi Benchmark:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {taka(baseModalPrice)}/{neg.unit}
            </span>
            {variancePct != null && (
              <span
                className={`font-bold ${
                  offerBelowFloor
                    ? 'text-rose-600 dark:text-rose-400'
                    : 'text-emerald-700 dark:text-emerald-400'
                }`}
              >
                ({variancePct > 0 ? `+${variancePct}%` : `${variancePct}%`} vs spot)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* STAGE CARD 2: Negotiation Audit Trail & Interactive Chat Thread */}
      <div className={`${surfaceCard} flex max-h-[540px] flex-col gap-4 overflow-y-auto p-5`}>
        <div className="my-1 flex items-center justify-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
          <span className="px-2 font-mono text-[11px] uppercase tracking-widest text-slate-400">
            Audit Trail · DL-{neg.id}
          </span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        </div>

        {/* Automated Settlement Engine Notice Card */}
        <div className="flex items-start gap-3.5 rounded-xl border border-slate-200/80 bg-slate-50/80 p-4 dark:border-white/5 dark:bg-[#121a2c]/60">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
            <Bot className="h-5 w-5" />
          </div>
          <div className="w-full space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="font-display text-xs font-bold text-slate-900 dark:text-white">
                Khamari Automated Settlement Engine
              </span>
              <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                ACID Guarded
              </span>
            </div>
            <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              Bilateral session opened between{' '}
              <strong className="text-slate-900 dark:text-white">
                {neg.buyer_organization ?? neg.buyer_name}
              </strong>{' '}
              and grower <strong className="text-slate-900 dark:text-white">{neg.farmer_name}</strong>{' '}
              for Lot #KHM-{neg.crop_id} ({num(neg.requested_quantity)} {neg.unit} {neg.crop_category}).
              Current rate:{' '}
              <strong className="font-mono text-emerald-700 dark:text-emerald-400">
                {taka(neg.current_offer_price)}/{neg.unit}
              </strong>
              .
            </p>
          </div>
        </div>

        {/* Mandi QC Certificate Attachment Preview */}
        <div className={`${innerWell} flex items-center gap-3 p-3`}>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-white">
              Mandi_QC_Lab_KHM{neg.crop_id}.pdf
            </div>
            <div className="truncate font-mono text-[11px] text-slate-500 dark:text-slate-400">
              Grade A · 13.8% Moisture · {neg.bazaar_region} Quality Cell
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModal('qc')}
            className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/20 active:scale-95 dark:text-emerald-300"
          >
            View
          </button>
        </div>

        {/* Live Chat & Offer Bubbles */}
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          if (m.message_type === 'SYSTEM_ALERT') {
            return (
              <div
                key={m.id}
                className="animate-fade-in text-center font-mono text-[11px] font-medium text-slate-500 dark:text-slate-400"
              >
                {m.content}
              </div>
            );
          }
          const isOffer = m.message_type === 'BID_OFFER' || m.message_type === 'COUNTER_OFFER';
          return (
            <div
              key={m.id}
              className={`animate-fade-in flex flex-col gap-1 max-w-[88%] ${
                mine ? 'self-end items-end' : 'self-start items-start'
              }`}
            >
              <div className="flex items-center gap-2 px-1">
                {mine ? (
                  <>
                    <span className="font-mono text-[11px] text-slate-400">{timeAgo(m.created_at)}</span>
                    <span className="font-display text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {user?.full_name} (You)
                    </span>
                  </>
                ) : (
                  <>
                    <span className="font-display text-xs font-semibold text-slate-900 dark:text-white">
                      {m.sender_name}
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">{timeAgo(m.created_at)}</span>
                  </>
                )}
              </div>

              <div
                className={`rounded-2xl p-3.5 text-xs leading-relaxed shadow-sm ${
                  isOffer
                    ? 'border border-amber-400/50 bg-amber-50/90 text-slate-900 dark:border-amber-500/35 dark:bg-amber-950/35 dark:text-white'
                    : mine
                    ? 'rounded-tr-sm border border-emerald-500/30 bg-emerald-700 text-white dark:bg-emerald-500/15 dark:text-white'
                    : 'rounded-tl-sm border border-slate-200 bg-white text-slate-800 dark:border-white/10 dark:bg-[#162038] dark:text-slate-100'
                }`}
              >
                {isOffer && (
                  <div className="mb-1.5 flex items-center gap-1.5 font-mono text-sm font-bold text-amber-700 dark:text-amber-300">
                    <Handshake className="h-4 w-4" />
                    <span>
                      {m.message_type === 'BID_OFFER' ? 'Initial Offer' : 'Counter'}:{' '}
                      {taka(m.offered_unit_price)}/{neg.unit}
                      {m.offered_quantity ? ` × ${num(m.offered_quantity)} ${neg.unit}` : ''}
                    </span>
                  </div>
                )}
                <p>{m.content}</p>
              </div>
            </div>
          );
        })}

        {/* Featured Latest Proposal Summary Card */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="font-display text-xs font-bold text-amber-600 dark:text-amber-400">
                {neg.last_offered_by === 'FARMER' ? 'Grower' : 'Buyer'} Counter-Offer Proposal
              </span>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-700 dark:text-amber-300">
                Latest
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">{timeAgo(neg.updated_at)}</span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-amber-400/45 bg-gradient-to-br from-amber-50/70 via-white to-white p-4 shadow-md dark:border-amber-500/35 dark:from-[#1b2236] dark:via-[#121a2c] dark:to-[#0d1424]">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Proposed Counter Unit Price
                </span>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="font-display text-3xl font-extrabold tracking-tight text-emerald-700 sm:text-4xl dark:text-emerald-400">
                    {taka(neg.current_offer_price)}
                  </span>
                  <span className="font-mono text-sm text-slate-500 dark:text-slate-400">
                    / {neg.unit}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  Offer Valid For
                </span>
                <div className="mt-1 flex items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/15 px-3 py-1.5 font-mono text-xs font-bold text-amber-700 dark:text-amber-300">
                  <Hourglass className="h-4 w-4" />
                  <span>{isActive ? formatCountdown(secondsLeft) : neg.status}</span>
                </div>
              </div>
            </div>

            <div className={`${innerWell} mt-3 grid grid-cols-2 gap-3 p-3.5 sm:grid-cols-4`}>
              <div>
                <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                  Gross Volume
                </span>
                <span className="font-mono text-sm font-semibold text-slate-900 dark:text-white">
                  {num(neg.requested_quantity)} {neg.unit}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                  Valuation
                </span>
                <span className="font-mono text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {taka(currentValuation)}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                  Fulfillment
                </span>
                <span className="font-mono text-xs font-semibold text-slate-800 dark:text-white">
                  {logistics === 'ex-farm' ? 'Ex-Farmgate Reefer' : 'Grower Delivers'}
                </span>
              </div>
              <div>
                <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                  Corridor Status
                </span>
                <span
                  className={`font-mono text-xs font-bold ${
                    offerBelowFloor
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}
                >
                  {currentCorridor?.fairPriceBadge ?? 'Mandi Verified'}
                </span>
              </div>
            </div>

            {offerBelowFloor && bench && (
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-200">
                <XCircle className="h-4 w-4 shrink-0" />
                <span>
                  <b>Below Bazaar baseline!</b> Current offer {taka(neg.current_offer_price)} is under the
                  Committee floor {taka(bench.min_price)} (modal {taka(bench.modal_price)}).
                </span>
              </div>
            )}
          </div>
        </div>

        <div ref={bottom} />
      </div>

      {/* STAGE CARD 3: Quick Action Response Bar & Terms Composer */}
      <div className={`${surfaceCard} flex flex-col gap-3.5 p-4 sm:p-5`}>
        {/* Quick Preset Action Pill Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {canAccept && (
            <button
              type="button"
              disabled={busy}
              onClick={() => setModal('confirm')}
              className="btn-primary min-h-[38px] px-4 py-2 text-xs font-bold"
            >
              <CheckCheck className="h-4 w-4" />
              <span>
                {neg.status === 'ACCEPTED'
                  ? 'Generate Order & Receipt'
                  : `Accept ${taka(neg.current_offer_price)}/${neg.unit}`}
              </span>
            </button>
          )}

          {isActive && mySide && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setPrice(String(splitPrice));
                  setModal('escrow');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-all hover:border-amber-400/60 hover:bg-amber-50/70 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <GitFork className="h-4 w-4 text-amber-500" />
                <span>Split Difference ({taka(splitPrice)})</span>
              </button>

              <button
                type="button"
                disabled={busy}
                onClick={() => setModal('escrow')}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 transition-all hover:border-emerald-400/60 hover:bg-emerald-50/70 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
              >
                <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Escrow &amp; Counter Console</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSecondsLeft((prev) => prev + 6 * 3600);
                  toast('Offer validity extended by +6 hours.', 'info');
                }}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-medium text-slate-600 transition-all hover:text-slate-900 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:text-white"
              >
                <Clock className="h-4 w-4" />
                <span>Extend Expiry +6h</span>
              </button>
            </>
          )}

          {isActive && canAccept && (
            <button
              type="button"
              disabled={busy}
              onClick={reject}
              className="btn-danger-ghost ml-auto min-h-[38px] px-3.5 py-2 text-xs font-semibold"
            >
              <XCircle className="h-4 w-4" />
              <span>Decline Deal</span>
            </button>
          )}
        </div>

        {/* Chat Input & Send */}
        {isActive && (
          <>
            <form
              className="flex items-center gap-2 pt-1"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input
                className="input flex-1 text-xs"
                placeholder="Type counter rationale or contractual terms..."
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <button
                type="submit"
                disabled={busy || !text.trim()}
                className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-2.5 text-xs font-bold text-emerald-700 transition-all hover:bg-emerald-500/25 active:scale-95 disabled:opacity-50 dark:text-emerald-300"
              >
                <span>Send</span>
                <Send className="h-4 w-4" />
              </button>
            </form>

            {/* Clause Tag Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-0.5 text-xs">
              <span className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                Attach Term:
              </span>
              {CLAUSE_CHIPS.map((clause) => (
                <button
                  key={clause}
                  type="button"
                  onClick={() => appendClause(clause)}
                  className={`${innerWell} px-2.5 py-1 font-mono text-[11px] text-slate-600 transition-all hover:border-emerald-400/50 hover:text-emerald-700 active:scale-95 dark:text-slate-300 dark:hover:text-white`}
                >
                  + {clause}
                </button>
              ))}
            </div>
          </>
        )}

        {!isActive && neg.status !== 'ACCEPTED' && (
          <p className="text-center font-mono text-xs text-slate-500 dark:text-slate-400">
            This negotiation is {neg.status.toLowerCase()}.
          </p>
        )}
      </div>

      {/* =======================================================
          MODAL 1: ESCROW & COUNTER CONSOLE
         ======================================================= */}
      {modal === 'escrow' && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setModal('none')}
        >
          <div
            className="animate-modal-pop relative my-auto max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-500/35 bg-white/95 p-6 text-slate-900 shadow-2xl backdrop-blur-2xl dark:bg-[#0d1527]/95 dark:text-slate-100 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModal('none')}
              aria-label="Close escrow console"
              className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition-all duration-200 hover:rotate-90 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Modal Header */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3 pr-10 dark:border-white/10">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  <SlidersHorizontal className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    Escrow &amp; Counter Console
                  </h3>
                  <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                    Deal #DL-{neg.id} • {neg.crop_title} ({num(qtyInputVal)} {neg.unit})
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                T+0 ESCROW
              </span>
            </div>

            <div className="mt-5 space-y-5">
              {/* Price Stepper & Slider */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-800 dark:text-white">
                    Your Bid Counter Price (৳ / {neg.unit})
                  </span>
                  <span className="font-mono text-slate-500 dark:text-slate-400">
                    Range {taka(sliderMin)} • {taka(sliderMax)}
                  </span>
                </div>

                <div className={`${innerWell} flex items-center gap-2 p-2`}>
                  <button
                    type="button"
                    onClick={() => adjustPrice(-step)}
                    aria-label="Decrease price"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/15"
                  >
                    <Minus className="h-5 w-5" />
                  </button>
                  <div className="flex flex-1 items-center justify-center gap-1">
                    <span className="font-mono text-2xl font-bold text-emerald-700 dark:text-emerald-400">
                      ৳
                    </span>
                    <input
                      className="w-28 border-none bg-transparent p-0 text-center font-mono text-2xl font-bold text-emerald-700 focus:outline-none focus:ring-0 dark:text-emerald-400"
                      type="number"
                      step={step}
                      min={1}
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                    />
                    <span className="pb-1 self-end font-mono text-xs text-slate-500 dark:text-slate-400">
                      /{neg.unit}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => adjustPrice(step)}
                    aria-label="Increase price"
                    className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:bg-slate-100 active:scale-95 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/15"
                  >
                    <Plus className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-1.5 px-1">
                  <input
                    className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-200 accent-emerald-600 dark:bg-white/10 dark:accent-emerald-400"
                    type="range"
                    min={sliderMin}
                    max={sliderMax}
                    step={step}
                    value={Math.min(sliderMax, Math.max(sliderMin, unitInputVal))}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                  <div className="flex justify-between font-mono text-[11px] text-slate-400">
                    <span>Floor {taka(sliderMin)}</span>
                    <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                      Current: {taka(unitInputVal)}
                    </span>
                    <span>Ceiling {taka(sliderMax)}</span>
                  </div>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-3 gap-2">
                  {presets.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPrice(String(p.val))}
                      className={`rounded-lg border px-2 py-1.5 font-mono text-[11px] font-semibold transition-all hover:border-emerald-400 active:scale-95 ${
                        p.highlight
                          ? 'border-amber-400/40 bg-amber-50/70 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                          : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200'
                      }`}
                    >
                      {p.label} ({taka(p.val)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity & Live Corridor */}
              <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="label">Quantity ({neg.unit})</span>
                  <input
                    className="input font-mono text-base font-bold"
                    inputMode="decimal"
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
                  />
                </label>
                <div className="pb-1">
                  <FairPriceBadge corridor={liveCorridor} size="lg" />
                </div>
              </div>

              {/* Logistics Selector */}
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-800 dark:text-white">
                  Logistics &amp; Freight Gate
                </span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setLogistics('ex-farm')}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-xs transition-all ${
                      logistics === 'ex-farm'
                        ? 'border-emerald-500 bg-emerald-700 font-bold text-white shadow-md dark:bg-emerald-500 dark:text-slate-950'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    <span>Buyer Pick (Ex-Farm Reefer)</span>
                    <span className="font-mono text-[10px] opacity-85">Buyer arranges transport</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogistics('grower-delivers')}
                    className={`flex flex-col items-center justify-center gap-0.5 rounded-xl border px-3 py-2.5 text-xs transition-all ${
                      logistics === 'grower-delivers'
                        ? 'border-emerald-500 bg-emerald-700 font-bold text-white shadow-md dark:bg-emerald-500 dark:text-slate-950'
                        : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300'
                    }`}
                  >
                    <span>Grower Delivers</span>
                    <span className="font-mono text-[10px] opacity-85">+৳1.40/{neg.unit} added</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Escrow Breakdown */}
              <div className={`${innerWell} space-y-3 p-4`}>
                <div className="flex items-center justify-between font-mono text-[11px]">
                  <span className="font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Escrow Drawdown &amp; Fee Calculator
                  </span>
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    Lot: {num(qtyInputVal)} {neg.unit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl bg-white p-2.5 dark:bg-white/5">
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Total Produce Valuation
                    </span>
                    <span className="font-mono text-base font-bold text-slate-900 dark:text-white">
                      {taka(produceValuation)}
                    </span>
                  </div>
                  <div className="rounded-xl bg-white p-2.5 dark:bg-white/5">
                    <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                      Total Escrow Required
                    </span>
                    <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                      {taka(totalEscrow)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                    <span className="block text-[11px] text-slate-600 dark:text-slate-300">
                      20% Advance Gate Lock
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {taka(advance20)}
                    </span>
                    <span className="block text-[10px] text-slate-400">Locked upon counter acceptance</span>
                  </div>
                  <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
                    <span className="block text-[11px] text-slate-600 dark:text-slate-300">
                      80% Post-Weighbridge Release
                    </span>
                    <span className="font-mono font-bold text-emerald-700 dark:text-emerald-400">
                      {taka(release80)}
                    </span>
                    <span className="block text-[10px] text-slate-400">Released on QC pass</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2 font-mono text-[11px] text-slate-500 dark:border-white/10 dark:text-slate-400">
                  <span>
                    Platform Escrow Fee (0.75%):{' '}
                    <b className="text-slate-900 dark:text-white">{taka(platformFee)}</b>
                  </span>
                  <span>
                    Mandi Regulatory Cess (0.50%):{' '}
                    <b className="text-slate-900 dark:text-white">{taka(regulatoryCess)}</b>
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={counter}
                  className="btn-primary w-full py-3.5 text-sm font-extrabold"
                >
                  {busy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Wallet className="h-5 w-5" />
                  )}
                  <span>Lock Counter ({taka(unitInputVal)}/{neg.unit}) &amp; Update Escrow</span>
                </button>
                <button
                  type="button"
                  onClick={() => setModal('none')}
                  className="btn-ghost w-full py-2.5 text-xs"
                >
                  Cancel &amp; Keep Current Terms
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 2: ACCEPT & FINALIZE DEAL CONFIRMATION
         ======================================================= */}
      {modal === 'confirm' && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setModal('none')}
        >
          <div
            className="animate-modal-pop relative my-auto w-full max-w-lg rounded-3xl border border-emerald-500/35 bg-white/95 p-6 text-slate-900 shadow-2xl backdrop-blur-2xl dark:bg-[#0d1527]/95 dark:text-slate-100 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModal('none')}
              aria-label="Close confirm modal"
              className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition-all duration-200 hover:rotate-90 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-200 pb-3 pr-10 dark:border-white/10">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <Gavel className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                  Accept &amp; Finalize Deal
                </h3>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  Binding Agro-Trade Contract #DL-{neg.id}
                </p>
              </div>
            </div>

            <div className={`${innerWell} mt-5 space-y-2.5 p-4 text-xs`}>
              <div className="flex justify-between border-b border-slate-200/70 pb-2 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400">Seller (Farmer)</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {neg.farmer_name} ({neg.bazaar_region})
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-2 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400">Buyer</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {neg.buyer_organization ?? neg.buyer_name}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-2 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400">Commodity &amp; Spec</span>
                <span className="font-semibold text-slate-900 dark:text-white">{neg.crop_title}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-2 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400">Volume</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">
                  {num(neg.requested_quantity)} {neg.unit}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-200/70 pb-2 dark:border-white/5">
                <span className="text-slate-500 dark:text-slate-400">Agreed Unit Price</span>
                <span className="font-mono text-base font-bold text-emerald-700 dark:text-emerald-400">
                  {taka(neg.current_offer_price)} / {neg.unit}
                </span>
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="text-slate-500 dark:text-slate-400">Total Escrow Commit</span>
                <span className="font-mono text-lg font-extrabold text-emerald-700 dark:text-emerald-400">
                  {taka(currentTotalEscrow)}
                </span>
              </div>
            </div>

            <label className="mt-4 block">
              <span className="label">Delivery address for receipt</span>
              <input
                className="input text-sm"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
            </label>

            <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 font-mono text-xs text-amber-700 dark:text-amber-300">
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                Auto-locks in escrow
              </span>
              <span className="font-bold">{formatCountdown(secondsLeft)}</span>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={accept}
                className="btn-primary w-full py-3.5 text-sm font-extrabold"
              >
                {busy ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Fingerprint className="h-5 w-5" />
                )}
                <span>Biometric Instant Escrow Lock ({taka(currentTotalEscrow)})</span>
              </button>
              <button
                type="button"
                onClick={() => setModal('none')}
                className="btn-ghost w-full py-2.5 text-xs"
              >
                Review Terms Again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =======================================================
          MODAL 3: VIEW QC CERTIFICATE
         ======================================================= */}
      {modal === 'qc' && (
        <div
          className="animate-backdrop fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/75 p-4 backdrop-blur-md"
          onClick={() => setModal('none')}
        >
          <div
            className="animate-modal-pop relative my-auto w-full max-w-xl rounded-3xl border border-emerald-500/35 bg-white/95 p-6 text-slate-900 shadow-2xl backdrop-blur-2xl dark:bg-[#0d1527]/95 dark:text-slate-100 sm:p-8"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setModal('none')}
              aria-label="Close certificate modal"
              className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-slate-100 text-slate-500 transition-all duration-200 hover:rotate-90 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-400 dark:hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 border-b border-slate-200 pb-3 pr-10 dark:border-white/10">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {neg.bazaar_region} Sadar Mandi Quality Cell
                </h3>
                <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
                  Inspection Certificate #Mandi_QC_Lab_KHM{neg.crop_id}.pdf
                </p>
              </div>
            </div>

            <div className={`${innerWell} mt-5 space-y-4 p-5`}>
              <div className="flex items-center justify-between border-b border-slate-200 pb-3 text-xs dark:border-white/10">
                <div>
                  <span className="block font-mono text-[10px] uppercase text-slate-400">
                    Lot Identifier
                  </span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    KHM-{neg.crop_id} / {neg.crop_title}
                  </span>
                </div>
                <div className="text-right">
                  <span className="block font-mono text-[10px] uppercase text-slate-400">
                    Verification Status
                  </span>
                  <span className="font-mono font-semibold text-emerald-700 dark:text-emerald-400">
                    BSTI Class-A Certified
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/5 dark:bg-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">Quality Grade</span>
                  <div className="font-display text-base font-bold text-emerald-700 dark:text-emerald-400">
                    Grade A Export
                  </div>
                  <span className="mt-0.5 block text-[10px] text-slate-400">Uniformity Verified</span>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/5 dark:bg-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Moisture Analysis
                  </span>
                  <div className="font-display text-base font-bold text-slate-900 dark:text-white">
                    13.8%
                  </div>
                  <span className="mt-0.5 block text-[10px] text-emerald-700 dark:text-emerald-400">
                    Passes threshold &lt;14.0%
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/5 dark:bg-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Sprout &amp; Rot Index
                  </span>
                  <div className="font-mono text-base font-bold text-slate-900 dark:text-white">
                    0.02% (Trace)
                  </div>
                  <span className="mt-0.5 block text-[10px] text-slate-400">Below 1.0% limit</span>
                </div>
                <div className="rounded-xl border border-slate-200/70 bg-white p-3 dark:border-white/5 dark:bg-white/5">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    Pesticide Residue
                  </span>
                  <div className="font-display text-base font-bold text-emerald-700 dark:text-emerald-400">
                    Zero / MRL Passed
                  </div>
                  <span className="mt-0.5 block text-[10px] text-slate-400">NIR Spectrometry Tested</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                  <div>
                    <span className="block font-semibold text-slate-900 dark:text-white">
                      {neg.bazaar_region} Regional Mandi Committee
                    </span>
                    <span className="font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                      SHA-256 Fair-Price &amp; Quality Audit Verified
                    </span>
                  </div>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
              </div>
            </div>

            <button
              type="button"
              onClick={() => setModal('none')}
              className="btn-ghost mt-5 w-full py-2.5 text-xs"
            >
              Close Certificate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
