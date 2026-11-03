import { Printer, ShieldCheck, X } from 'lucide-react';
import type { Receipt } from '../lib/types';
import { dateOnly, num, taka } from '../lib/format';

export default function ReceiptView({ receipt, onClose }: { receipt: Receipt; onClose?: () => void }) {
  const li = receipt.lineItem;
  return (
    <div className="rounded-2xl border border-emerald-200 bg-white shadow-2xl dark:border-[#1e293b] dark:bg-[#141b2b] print:border-0 print:shadow-none">
      <div className="flex items-start justify-between rounded-t-2xl bg-gradient-to-r from-forest-900 to-forest-950 px-5 py-4 text-white">
        <div>
          <div className="font-mono text-[11px] uppercase tracking-widest text-emerald-300">
            Khamari Digital Receipt
          </div>
          <div className="mt-0.5 font-display text-base font-bold leading-tight">{receipt.documentTitle}</div>
          <div className="mt-1 font-mono text-sm font-semibold text-amber-300">{receipt.receiptNumber}</div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="rounded-full p-1.5 text-white/80 hover:bg-white/10 hover:text-white print:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="space-y-4 p-5 text-sm">
        {receipt.certificationBadge && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
            <ShieldCheck className="h-5 w-5 shrink-0" />
            <span className="font-semibold">Bazaar Committee fair-price certified</span>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Seller (Farmer)
            </div>
            <div className="font-semibold text-slate-900 dark:text-white">{receipt.seller.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{receipt.seller.region}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase text-slate-500 dark:text-slate-400">
              Buyer
            </div>
            <div className="font-semibold text-slate-900 dark:text-white">{receipt.buyer.name}</div>
            <div className="text-xs text-slate-500 dark:text-slate-400">{receipt.buyer.organization}</div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 dark:border-[#1e293b] dark:bg-[#070e1d]">
          <div className="font-display font-bold text-slate-900 dark:text-white">{li.cropTitle}</div>
          <div className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {li.cropCategory} | {li.qualityGrade.replace('_', ' ')}
          </div>
          <dl className="mt-2.5 space-y-1.5">
            <Row k="Quantity" v={`${num(li.quantity)} ${li.unit}`} />
            <Row k="Agreed unit price" v={taka(li.unitPriceAgreed)} />
            <Row k="Subtotal" v={taka(li.subtotalAmount)} />
            <Row
              k={`Discount (${li.pricingStrategy.replace(/_/g, ' ').toLowerCase()})`}
              v={`- ${taka(li.discountAmount)}`}
            />
            <div className="flex justify-between border-t border-slate-300 pt-2 font-mono text-base font-bold text-emerald-800 dark:border-slate-700 dark:text-emerald-400">
              <dt>Total payable</dt>
              <dd>{taka(li.totalAmount)}</dd>
            </div>
          </dl>
        </div>

        {receipt.bazaarCorridorSnapshot && (
          <div className="rounded-xl border border-emerald-200 p-3 text-xs dark:border-emerald-500/25 dark:bg-emerald-950/20">
            <div className="mb-1 font-mono font-semibold text-emerald-800 dark:text-emerald-300">
              Bazaar baseline snapshot ({receipt.bazaarCorridorSnapshot.region})
            </div>
            <div className="flex justify-between font-mono text-slate-600 dark:text-slate-300">
              <span>Min {taka(receipt.bazaarCorridorSnapshot.minPrice)}</span>
              <span>Modal {taka(receipt.bazaarCorridorSnapshot.modalPrice)}</span>
              <span>Max {taka(receipt.bazaarCorridorSnapshot.maxPrice)}</span>
            </div>
            <div className="mt-1 font-mono text-slate-400">
              Effective {dateOnly(receipt.bazaarCorridorSnapshot.effectiveDate)}
            </div>
          </div>
        )}

        <div className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
          <div>
            <b>Deliver to:</b> {receipt.deliveryAddress}
          </div>
          <div>
            <b>Payment:</b> {receipt.paymentStatus.replace('_', ' ')} | <b>Status:</b>{' '}
            {receipt.orderStatus}
          </div>
          <div>
            <b>Issued:</b> {dateOnly(receipt.issuedAt)}
          </div>
          {receipt.gatePassCode && (
            <div>
              <b>Gate pass:</b> <span className="font-mono">{receipt.gatePassCode}</span>
            </div>
          )}
          {receipt.procurementVoucherId && (
            <div>
              <b>Voucher:</b> <span className="font-mono">{receipt.procurementVoucherId}</span>
            </div>
          )}
          {receipt.taxNotice && <div className="italic">{receipt.taxNotice}</div>}
          {receipt.escrowInstructions && <div className="italic">{receipt.escrowInstructions}</div>}
        </div>

        <button type="button" onClick={() => window.print()} className="btn-ghost w-full print:hidden">
          <Printer className="h-4 w-4" /> Print / Save as PDF
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="capitalize text-slate-600 dark:text-slate-400">{k}</dt>
      <dd className="font-mono font-semibold text-slate-900 dark:text-white">{v}</dd>
    </div>
  );
}
