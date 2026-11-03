import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CheckCircle2, Handshake, Loader2, Send, XCircle } from 'lucide-react';
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
}

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  COUNTERED: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
  ACCEPTED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  CANCELLED: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export default function NegotiationThread({ negotiationId, onClose, onReceipt, onChanged }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [neg, setNeg] = useState<Negotiation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('');
  const [text, setText] = useState('');
  const [address, setAddress] = useState('');
  const [showAccept, setShowAccept] = useState(false);
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
      onChanged?.();
      toast('Offer sent live.', 'success');
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
      setShowAccept(false);
      onReceipt(r.receipt);
      toast('Deal accepted. Receipt generated.', 'success');
      await load();
      onChanged?.();
    });

  const reject = () =>
    run(async () => {
      await api.respond(negotiationId, 'REJECT');
      await load();
      onChanged?.();
    });

  if (error && !neg) {
    return <div className="p-6 text-center text-sm text-rose-600">{error}</div>;
  }
  if (!neg) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-emerald-700 dark:text-emerald-400">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const counterpart = mySide === 'BUYER' ? neg.farmer_name : neg.buyer_organization ?? neg.buyer_name;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f4f7f4] dark:bg-[#0c1322]">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 dark:border-[#1e293b] dark:bg-[#141b2b]">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Back"
              className="-ml-1 rounded-full p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#191f2f]"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate font-display font-bold text-slate-900 dark:text-white">
              {neg.crop_title}
            </div>
            <div className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
              with {counterpart} | {neg.bazaar_region}
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-1 font-mono text-xs font-bold ${STATUS_STYLE[neg.status]}`}>
            {neg.status}
          </span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-lg bg-amber-50 px-2.5 py-1 font-mono font-bold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
            {taka(neg.current_offer_price)}/{neg.unit} x {num(neg.requested_quantity)} {neg.unit}
          </span>
          <FairPriceBadge corridor={currentCorridor} size="sm" />
        </div>
      </div>

      {offerBelowFloor && bench && (
        <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-800 dark:border-rose-500/30 dark:bg-rose-950/40 dark:text-rose-200">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>
            <b>Below Bazaar baseline!</b> Current offer {taka(neg.current_offer_price)} is under the
            Committee floor {taka(bench.min_price)} (modal {taka(bench.modal_price)}).
          </span>
        </div>
      )}

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.map((m) => {
          const mine = m.sender_id === user?.id;
          if (m.message_type === 'SYSTEM_ALERT') {
            return (
              <div key={m.id} className="text-center font-mono text-xs font-medium text-slate-500 dark:text-slate-400">
                {m.content}
              </div>
            );
          }
          const isOffer = m.message_type === 'BID_OFFER' || m.message_type === 'COUNTER_OFFER';
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm ${
                  isOffer
                    ? 'border-2 border-amber-300 bg-amber-50 text-slate-900 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-white'
                    : mine
                    ? 'bg-emerald-700 text-white dark:bg-emerald-600'
                    : 'border border-slate-200 bg-white text-slate-900 dark:border-[#1e293b] dark:bg-[#141b2b] dark:text-[#dce2f7]'
                }`}
              >
                <div
                  className={`mb-0.5 font-mono text-[11px] font-semibold ${
                    mine && !isOffer ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {mine ? 'You' : m.sender_name} | {timeAgo(m.created_at)}
                </div>
                {isOffer && (
                  <div className="mb-1 flex items-center gap-1.5 font-mono text-base font-bold text-amber-700 dark:text-amber-300">
                    <Handshake className="h-4 w-4" />
                    {m.message_type === 'BID_OFFER' ? 'Offer' : 'Counter'}:{' '}
                    {taka(m.offered_unit_price)}/{neg.unit}
                    {m.offered_quantity ? ` x ${num(m.offered_quantity)}` : ''}
                  </div>
                )}
                <div>{m.content}</div>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>

      {/* Actions */}
      <div className="space-y-3 border-t border-slate-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] dark:border-[#1e293b] dark:bg-[#141b2b]">
        {isActive && mySide && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-[#1e293b] dark:bg-[#070e1d]">
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="label">Price / {neg.unit}</span>
                <input
                  className="input font-mono text-base font-bold"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>
              <label className="block">
                <span className="label">Quantity ({neg.unit})</span>
                <input
                  className="input font-mono text-base font-bold"
                  inputMode="decimal"
                  value={qty}
                  onChange={(e) => setQty(e.target.value)}
                />
              </label>
            </div>
            <div className="mt-2">
              <FairPriceBadge corridor={liveCorridor} />
            </div>
            <button type="button" className="btn-amber mt-3 w-full" disabled={busy} onClick={counter}>
              <Handshake className="h-5 w-5" /> Counter Offer
            </button>
          </div>
        )}

        {canAccept && !showAccept && (
          <button type="button" className="btn-primary w-full" onClick={() => setShowAccept(true)} disabled={busy}>
            <CheckCircle2 className="h-5 w-5" /> Accept &amp; Generate Receipt
          </button>
        )}
        {canAccept && showAccept && (
          <div className="rounded-xl border-2 border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-500/40 dark:bg-emerald-950/30">
            <label className="block">
              <span className="label">Delivery address for receipt</span>
              <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button type="button" className="btn-ghost" onClick={() => setShowAccept(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={accept} disabled={busy}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckCircle2 className="h-5 w-5" />}{' '}
                Confirm
              </button>
            </div>
          </div>
        )}
        {isActive && canAccept && (
          <button type="button" className="btn-danger-ghost w-full" onClick={reject} disabled={busy}>
            <XCircle className="h-4 w-4" /> Decline offer
          </button>
        )}

        {isActive && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
          >
            <input
              className="input flex-1"
              placeholder="Type a message..."
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button
              className="btn-primary px-4"
              type="submit"
              disabled={busy || !text.trim()}
              aria-label="Send"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        )}
        {!isActive && neg.status !== 'ACCEPTED' && (
          <p className="text-center font-mono text-xs text-slate-500 dark:text-slate-400">
            This negotiation is {neg.status.toLowerCase()}.
          </p>
        )}
      </div>
    </div>
  );
}
