import { AlertTriangle, BadgeCheck, HelpCircle, TrendingUp } from 'lucide-react';
import type { Corridor } from '../lib/types';

export default function FairPriceBadge({
  corridor,
  size = 'md',
}: {
  corridor: Corridor | null | undefined;
  size?: 'sm' | 'md' | 'lg';
}) {
  if (!corridor) return null;
  const pad =
    size === 'lg'
      ? 'px-3.5 py-2 text-xs'
      : size === 'sm'
      ? 'px-2 py-0.5 text-[11px]'
      : 'px-2.5 py-1 text-xs';
  const icon = size === 'lg' ? 'h-4 w-4' : 'h-3.5 w-3.5';
  const v = corridor.varianceFromModalPct;
  const suffix =
    v != null && corridor.complianceStatus !== 'UNBENCHMARKED'
      ? ` (${v > 0 ? '+' : ''}${v}%)`
      : '';

  let cls =
    'bg-emerald-50 text-emerald-800 ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30';
  let Icon = BadgeCheck;
  if (corridor.complianceStatus === 'BELOW_FLOOR') {
    cls =
      'bg-rose-50 text-rose-800 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30';
    Icon = AlertTriangle;
  } else if (corridor.complianceStatus === 'ABOVE_CEILING') {
    cls =
      'bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30';
    Icon = TrendingUp;
  } else if (corridor.complianceStatus === 'UNBENCHMARKED') {
    cls =
      'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700';
    Icon = HelpCircle;
  }

  return (
    <span
      title={corridor.message}
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full font-mono font-semibold ring-1 ${pad} ${cls}`}
    >
      <Icon className={icon} />
      {corridor.fairPriceBadge}
      {suffix}
    </span>
  );
}
