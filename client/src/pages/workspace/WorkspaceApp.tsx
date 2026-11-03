import { useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardCheck,
  Handshake,
  LayoutGrid,
  Loader2,
  LogOut,
  MapPin,
  Megaphone,
  PlusCircle,
  Receipt as ReceiptIcon,
  Search,
  Sprout,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { ThemeToggle } from '../../context/ThemeContext';
import { useMarket } from '../../hooks/useMarket';
import { taka, timeAgo } from '../../lib/format';
import OfferModal from '../../components/OfferModal';
import ReceiptView from '../../components/ReceiptView';
import {
  ComplianceView,
  DealRoomView,
  FarmerAddCropView,
  FarmerLotsView,
  MarketView,
  OrdersView,
  PublishView,
  TrackerView,
} from '../desktop/Views';
import type { Receipt, User } from '../../lib/types';

type TabId =
  | 'market'
  | 'tracker'
  | 'deal-room'
  | 'orders'
  | 'my-lots'
  | 'add-lot'
  | 'publish'
  | 'compliance';

interface NavItem {
  id: TabId;
  label: string;
  shortLabel: string;
  icon: typeof Sprout;
}

const BUYER_NAV: NavItem[] = [
  { id: 'market', label: 'Supply Board', shortLabel: 'Market', icon: LayoutGrid },
  { id: 'tracker', label: 'Live Price Index', shortLabel: 'Prices', icon: BarChart3 },
  { id: 'deal-room', label: 'Deal Room', shortLabel: 'Deals', icon: Handshake },
  { id: 'orders', label: 'Orders & Receipts', shortLabel: 'Orders', icon: ReceiptIcon },
];

const FARMER_NAV: NavItem[] = [
  { id: 'my-lots', label: 'My Harvest Lots', shortLabel: 'My Lots', icon: Sprout },
  { id: 'add-lot', label: 'Post Harvest Lot', shortLabel: 'Add Lot', icon: PlusCircle },
  { id: 'deal-room', label: 'Deal Room', shortLabel: 'Offers', icon: Handshake },
  { id: 'orders', label: 'Orders & Dispatches', shortLabel: 'Orders', icon: ReceiptIcon },
];

const COMMITTEE_NAV: NavItem[] = [
  { id: 'publish', label: 'Bazaar Verifications', shortLabel: 'Publish', icon: Megaphone },
  { id: 'tracker', label: 'Live Price Index', shortLabel: 'Prices', icon: BarChart3 },
  { id: 'compliance', label: 'Listing Compliance', shortLabel: 'Audit', icon: ClipboardCheck },
];

export default function WorkspaceApp({ user }: { user: User }) {
  const { logout } = useAuth();
  const m = useMarket(user);

  const nav = useMemo(() => {
    if (user.role === 'FARMER') return FARMER_NAV;
    if (user.role === 'BAZAAR_COMMITTEE' || user.role === 'ADMIN') return COMMITTEE_NAV;
    return BUYER_NAV;
  }, [user.role]);

  const [tab, setTab] = useState<TabId>(nav[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [offerCropId, setOfferCropId] = useState<number | null>(null);
  const [selectedNegId, setSelectedNegId] = useState<number | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const offerCrop = m.crops.find((c) => c.id === offerCropId) ?? null;
  const activeTabTitle = nav.find((n) => n.id === tab)?.label ?? 'Khamari';

  const pendingDeals = m.negotiations.filter((n) => {
    const isActive = n.status === 'OPEN' || n.status === 'COUNTERED';
    if (!isActive) return false;
    const mySide = n.buyer_id === user.id ? 'BUYER' : 'FARMER';
    return n.last_offered_by !== mySide;
  }).length;

  const initials = user.full_name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#f4f7f4] text-slate-900 transition-colors duration-200 dark:bg-[#0c1322] dark:text-[#dce2f7]">
      {/* Desktop Hover-to-Expand Left Icon Rail */}
      <aside className="glass-rail group fixed left-0 top-0 z-40 hidden h-screen w-16 flex-col justify-between overflow-hidden py-4 transition-all duration-300 ease-out hover:w-64 lg:flex">
        <div className="flex flex-col gap-6 px-2.5">
          {/* Brand Logo */}
          <div className="flex items-center gap-3 overflow-hidden px-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/25 transition-transform duration-300 group-hover:scale-105 dark:bg-emerald-500 dark:text-slate-950">
              <Sprout className="h-5 w-5" />
            </div>
            <div className="flex flex-col whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <span className="font-display text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
                Khamari
              </span>
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
                {user.role === 'INSTITUTION' || user.role === 'BUYER'
                  ? 'BUYER'
                  : user.role.replace('_', ' ')}
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1.5">
            {nav.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => setTab(item.id)}
                  className={`relative flex items-center gap-3 overflow-hidden rounded-xl px-2.5 py-2.5 text-left transition-all duration-200 ${
                    active
                      ? 'bg-emerald-700 font-bold text-white shadow-md shadow-emerald-700/25 dark:bg-emerald-500 dark:text-slate-950'
                      : 'text-slate-600 hover:bg-emerald-50 hover:text-emerald-900 dark:text-slate-300 dark:hover:bg-[#141b2b] dark:hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span className="flex-1 whitespace-nowrap text-sm opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                    {item.label}
                  </span>
                  {item.id === 'deal-room' && pendingDeals > 0 && (
                    <>
                      <span className="hidden rounded-full bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-950 group-hover:inline-flex">
                        {pendingDeals}
                      </span>
                      <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500 group-hover:hidden" />
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User Profile & Sign Out */}
        <div className="mx-2.5 overflow-hidden rounded-xl border border-slate-200/80 bg-slate-50/90 p-2.5 dark:border-[#1e293b] dark:bg-[#141b2b]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-100 font-mono text-xs font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
              {initials}
            </div>
            <div className="min-w-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              <div className="truncate text-xs font-bold text-slate-900 dark:text-white">
                {user.full_name}
              </div>
              <div className="truncate font-mono text-[10px] text-slate-500 dark:text-slate-400">
                {user.region}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={logout}
            title="Sign out"
            className="mt-2.5 flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Sign out
            </span>
          </button>
        </div>
      </aside>

      {/* Main Layout Container (offset by w-16 on desktop) */}
      <div className="flex min-h-screen flex-col lg:pl-16">
        {/* Desktop & Mobile Top Glassmorphic Header */}
        <header className="glass-panel sticky top-0 z-30 border-b px-4 py-2.5 lg:mx-6 lg:mt-3 lg:rounded-2xl lg:border">
          <div className="flex items-center justify-between gap-3">
            {/* Left: Mobile Brand + Desktop Title / Search */}
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex items-center gap-2 lg:hidden">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-700 text-white dark:bg-emerald-500 dark:text-slate-950">
                  <Sprout className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-extrabold text-slate-900 dark:text-white">
                    Khamari
                  </div>
                  <div className="flex items-center gap-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">
                    <MapPin className="h-3 w-3" /> {user.region}
                  </div>
                </div>
              </div>

              <div className="hidden min-w-0 items-center gap-4 lg:flex lg:flex-1">
                <h1 className="shrink-0 font-display text-lg font-extrabold text-slate-900 dark:text-white">
                  {activeTabTitle}
                </h1>
                {tab === 'market' && (
                  <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      className="input rounded-full py-1.5 pl-9 text-xs"
                      placeholder="Search crop, mandi, farmer, or Lot #KHM..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Right: Mandi Pill, Theme Toggle, Live Status, Mobile Sign Out */}
            <div className="flex shrink-0 items-center gap-2">
              <div className="hidden items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 font-mono text-xs dark:border-[#1e293b] dark:bg-[#070e1d] md:flex">
                <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-slate-500 dark:text-slate-400">Mandi:</span>
                <strong className="text-slate-900 dark:text-white">{user.region}</strong>
              </div>

              <ThemeToggle />

              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 font-mono text-[11px] font-bold ${
                  m.connected
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
                }`}
              >
                {m.connected ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{m.connected ? 'Live' : 'Offline'}</span>
              </span>

              {m.lastLive && (
                <span className="hidden font-mono text-[11px] text-slate-500 dark:text-slate-400 xl:inline">
                  Updated {timeAgo(m.lastLive)}
                </span>
              )}

              <button
                type="button"
                onClick={logout}
                aria-label="Sign out"
                className="rounded-xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-100 dark:border-[#1e293b] dark:text-slate-300 dark:hover:bg-[#191f2f] lg:hidden"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        {/* Live Bazaar Benchmarks Ticker Bar */}
        {m.benchmarks.length > 0 && (
          <div className="mx-0 mt-2 flex gap-4 overflow-x-auto bg-emerald-950 px-4 py-2 font-mono text-xs text-emerald-100 no-scrollbar lg:mx-6 lg:rounded-xl">
            <span className="shrink-0 font-bold text-amber-400">BAZAAR LIVE</span>
            {m.benchmarks.map((b) => (
              <span key={b.id} className="shrink-0 whitespace-nowrap">
                {b.crop_category} ({b.bazaar_region}){' '}
                <strong className="text-white">{taka(b.modal_price)}</strong>{' '}
                <span className="text-emerald-300">
                  [{taka(b.min_price)}-{taka(b.max_price)}]
                </span>
              </span>
            ))}
          </div>
        )}

        {/* Main Active View */}
        <main key={tab} className="animate-fade-in flex-1 px-4 pb-28 pt-5 lg:px-6 lg:pb-10">
          {m.error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
              {m.error}
            </div>
          )}

          {m.loading ? (
            <div className="flex justify-center py-20 text-emerald-700 dark:text-emerald-400">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : tab === 'market' ? (
            <MarketView
              crops={m.crops}
              benchmarks={m.benchmarks}
              searchQuery={searchQuery}
              onOffer={setOfferCropId}
            />
          ) : tab === 'tracker' ? (
            <TrackerView benchmarks={m.benchmarks} crops={m.crops} />
          ) : tab === 'deal-room' ? (
            <DealRoomView
              negotiations={m.negotiations}
              user={user}
              selectedId={selectedNegId}
              onSelect={setSelectedNegId}
              onReceipt={setReceipt}
              onChanged={m.refresh}
            />
          ) : tab === 'orders' ? (
            <OrdersView
              orders={m.orders}
              user={user}
              onReceipt={setReceipt}
              onChanged={m.refresh}
            />
          ) : tab === 'my-lots' ? (
            <FarmerLotsView
              crops={m.crops}
              negotiations={m.negotiations}
              onAdd={() => setTab('add-lot')}
              onOpenOffers={() => setTab('deal-room')}
            />
          ) : tab === 'add-lot' ? (
            <FarmerAddCropView
              user={user}
              benchmarks={m.benchmarks}
              onDone={async () => {
                await m.refresh();
                setTab('my-lots');
              }}
            />
          ) : tab === 'publish' ? (
            <PublishView benchmarks={m.benchmarks} crops={m.crops} onPublished={m.refresh} />
          ) : (
            <ComplianceView crops={m.crops} />
          )}
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation Bar (Touch Ergonomic >= 64px) */}
      <nav className="glass-panel fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}
        >
          {nav.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                  active
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <span
                  className={`flex h-7 w-12 items-center justify-center rounded-full transition ${
                    active ? 'bg-emerald-100 dark:bg-emerald-500/20' : ''
                  }`}
                >
                  <item.icon className="h-5 w-5" />
                </span>
                <span>{item.shortLabel}</span>
                {item.id === 'deal-room' && pendingDeals > 0 && (
                  <span className="absolute right-[22%] top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-amber-500 px-1 font-mono text-[10px] font-bold text-slate-950">
                    {pendingDeals}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Make Offer Modal */}
      {offerCrop && (
        <OfferModal
          crop={offerCrop}
          onClose={() => setOfferCropId(null)}
          onStarted={(negId) => {
            setOfferCropId(null);
            setTab('deal-room');
            setSelectedNegId(negId);
            m.refresh();
          }}
        />
      )}

      {/* Slide-Over Digital Receipt Modal */}
      {receipt && (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setReceipt(null)}
        >
          <div className="animate-fade-in w-full max-w-md pt-4" onClick={(e) => e.stopPropagation()}>
            <ReceiptView receipt={receipt} onClose={() => setReceipt(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
