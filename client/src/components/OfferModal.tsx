import { useEffect, useState } from 'react';
import { Handshake, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import { benchOf, computeCorridor, dateOnly, num, taka } from '../lib/format';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';
import FairPriceBadge from './FairPriceBadge';
import type { Crop, PricePreview } from '../lib/types';

export default function OfferModal({
  crop,
  onClose,
  onStarted,
}: {
  crop: Crop;
  onClose: () => void;
  onStarted: (negotiationId: number) => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [price, setPrice] = useState(String(crop.base_price_per_unit));
  const [qty, setQty] = useState(
    String(Math.max(crop.min_order_quantity, crop.bulk_threshold_qty ?? crop.min_order_quantity))
  );
  const [note, setNote] = useState('');
  const [preview, setPreview] = useState<PricePreview | null>(null);
  const [busy, setBusy] = useState(false);

  const corridor = computeCorridor(Number(price) || 0, benchOf(crop));

  useEffect(() => {
    const q = Number(qty);
    const p = Number(price);
    if (!(q > 0) || !(p > 0)) return;
    const t = setTimeout(() => {
      api
        .pricePreview(crop.id, { quantity: q, proposed_unit_price: p, buyer_role: user?.role })
        .then(setPreview)
        .catch(() => setPreview(null));
    }, 250);
    return () => clearTimeout(t);
  }, [qty, price, crop.id, user?.role]);

  async function submit() {
    const q = Number(qty);
    const p = Number(price);
    if (!(p > 0) || !(q > 0)) return toast('Enter a valid price and quantity.', 'error');
    setBusy(true);
    try {
      const r = await api.startNegotiation({
        crop_id: crop.id,
        requested_quantity: q,
        offered_unit_price: p,
        initial_message: note.trim() || undefined,
      });
      toast('Offer sent to the farmer.', 'success');
      onStarted(r.negotiation.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not send offer', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="animate-backdrop fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="animate-sheet-up sm:animate-modal-pop max-h-full w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200 bg-white p-5 shadow-2xl dark:border-[#1e293b] dark:bg-[#141b2b] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Make Wholesale Offer
            </h3>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{crop.title}</p>
            <p className="font-mono text-xs text-slate-500 dark:text-slate-400">
              {crop.farmer_name} | {crop.bazaar_region} | harvested {dateOnly(crop.harvest_date)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-2 text-slate-500 transition-all duration-200 hover:rotate-90 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-[#191f2f] dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 font-mono text-xs dark:border-[#1e293b] dark:bg-[#070e1d]">
          Asking <b>{taka(crop.base_price_per_unit)}/{crop.unit}</b> | {num(crop.quantity_available)}{' '}
          {crop.unit} available | min order {num(crop.min_order_quantity)}
          {crop.bulk_threshold_qty
            ? ` | ${crop.bulk_discount_pct}% off at ${num(crop.bulk_threshold_qty)}+`
            : ''}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <label className="block">
            <span className="label">Your price / {crop.unit}</span>
            <input
              className="input font-mono text-lg font-bold"
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="label">Quantity ({crop.unit})</span>
            <input
              className="input font-mono text-lg font-bold"
              inputMode="decimal"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </label>
        </div>
        <div className="mt-2.5">
          <FairPriceBadge corridor={corridor} size="lg" />
        </div>

        {preview && (
          <div className="animate-fade-in mt-4 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3.5 text-sm dark:border-emerald-500/25 dark:bg-emerald-950/20">
            <div className="mb-1.5 font-mono text-[11px] font-bold uppercase text-emerald-700 dark:text-emerald-400">
              Strategy: {preview.strategyUsed.replace(/_/g, ' ')}
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-300">Subtotal</span>
              <span className="font-mono font-semibold">{taka(preview.subtotalAmount)}</span>
            </div>
            <div className="flex justify-between text-amber-700 dark:text-amber-400">
              <span>Discount ({preview.discountPct}%)</span>
              <span className="font-mono font-semibold">- {taka(preview.discountAmount)}</span>
            </div>
            <div className="mt-1.5 flex justify-between border-t border-emerald-200 pt-1.5 font-mono text-base font-bold text-emerald-800 dark:border-emerald-500/25 dark:text-emerald-400">
              <span>Estimated total</span>
              <span>{taka(preview.totalAmount)}</span>
            </div>
          </div>
        )}

        <label className="mt-4 block">
          <span className="label">Message (optional)</span>
          <textarea
            className="input"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Delivery timing, packaging, payment terms..."
          />
        </label>

        <button type="button" className="btn-amber mt-4 w-full" disabled={busy} onClick={submit}>
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Handshake className="h-5 w-5" />}{' '}
          Send Offer
        </button>
      </div>
    </div>
  );
}
