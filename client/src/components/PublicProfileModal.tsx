import { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  Calendar,
  Handshake,
  Loader2,
  Mail,
  MapPin,
  Package,
  Phone,
  ShieldAlert,
  ShieldCheck,
  Sprout,
  UserCheck,
  X,
} from 'lucide-react';
import { api, API_BASE } from '../lib/api';
import { dateOnly, num, taka } from '../lib/format';
import { useAuth } from '../context/AuthContext';
import FairPriceBadge from './FairPriceBadge';
import type { PublicProfileResponse } from '../lib/types';

interface Props {
  userId: number;
  onClose: () => void;
  onOfferCrop?: (cropId: number) => void;
}

export default function PublicProfileModal({ userId, onClose, onOfferCrop }: Props) {
  const { user: currentUser } = useAuth();
  const [data, setData] = useState<PublicProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    api
      .userProfile(userId)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const canMakeOffer =
    !!onOfferCrop &&
    !!currentUser &&
    (currentUser.role === 'BUYER' || currentUser.role === 'INSTITUTION');

  const profile = data?.profile;
  const stats = data?.stats;
  const crops = data?.crops ?? [];

  const initials = (profile?.full_name ?? 'KH')
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  const isFullyVerified = Boolean(profile?.is_verified && profile?.email_verified);
  const isVerifiedAny = Boolean(profile?.is_verified);

  return (
    <div
      className="animate-backdrop fixed inset-0 z-[70] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className="animate-modal-pop relative my-auto max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-emerald-500/30 bg-white/95 text-slate-900 shadow-2xl backdrop-blur-2xl dark:bg-[#0d1527]/95 dark:text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close public profile"
          className="absolute right-5 top-5 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur-md transition-all duration-200 hover:rotate-90 hover:bg-black/60"
        >
          <X className="h-4 w-4" />
        </button>

        {loading ? (
          <div className="flex min-h-[320px] items-center justify-center text-emerald-700 dark:text-emerald-400">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : error || !profile || !stats ? (
          <div className="p-10 text-center text-sm text-rose-600 dark:text-rose-400">
            {error ?? 'User profile unavailable.'}
          </div>
        ) : (
          <div>
            {/* Top Gradient Banner & Avatar */}
            <div className="relative h-28 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 dark:from-[#08241d] dark:via-[#0b382c] dark:to-[#0c1a32]">
              <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />
            </div>

            <div className="px-6 pb-6">
              <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
                <div className="flex items-end gap-4">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-emerald-100 shadow-lg dark:border-[#0d1527] dark:bg-emerald-950">
                    {profile.avatar_url ? (
                      <img
                        src={`${API_BASE}${profile.avatar_url}`}
                        alt={profile.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center font-display text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">
                        {initials}
                      </div>
                    )}
                  </div>

                  <div className="pb-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-extrabold text-slate-900 dark:text-white">
                        {profile.full_name}
                      </h2>
                      {isFullyVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <BadgeCheck className="h-3.5 w-3.5" />
                          ID &amp; Email Verified
                        </span>
                      ) : isVerifiedAny ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-300">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Verified Member
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-800 dark:text-amber-300">
                          <ShieldAlert className="h-3.5 w-3.5" />
                          Unverified
                        </span>
                      )}
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-slate-500 dark:text-slate-400">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-bold uppercase text-slate-700 dark:bg-[#191f2f] dark:text-emerald-300">
                        {profile.role === 'INSTITUTION' ? 'BUYER' : profile.role.replace('_', ' ')}
                      </span>
                      {profile.organization_name && (
                        <span className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <Building2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          {profile.organization_name}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bio Box */}
              <div className="mt-5 rounded-2xl border border-slate-200/80 bg-slate-50/90 p-4 dark:border-white/5 dark:bg-[#070e1d]">
                <div className="mb-1 font-mono text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Trader Biography &amp; Operations
                </div>
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                  {profile.bio || 'No biography added yet.'}
                </p>
              </div>

              {/* Trade Stats Strip */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center dark:border-white/5 dark:bg-[#141b2b]">
                  <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                    {profile.role === 'BAZAAR_COMMITTEE' ? 'Benchmarks' : 'Active Lots'}
                  </span>
                  <strong className="mt-0.5 block font-mono text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                    {profile.role === 'BAZAAR_COMMITTEE'
                      ? stats.published_prices
                      : stats.active_listings}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center dark:border-white/5 dark:bg-[#141b2b]">
                  <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                    Total Orders
                  </span>
                  <strong className="mt-0.5 block font-mono text-xl font-extrabold text-slate-900 dark:text-white">
                    {stats.total_orders}
                  </strong>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-3 text-center dark:border-white/5 dark:bg-[#141b2b]">
                  <span className="block font-mono text-[10px] uppercase text-slate-500 dark:text-slate-400">
                    Delivered
                  </span>
                  <strong className="mt-0.5 block font-mono text-xl font-extrabold text-emerald-700 dark:text-emerald-400">
                    {stats.delivered_orders}
                  </strong>
                </div>
              </div>

              {/* Public Details Grid */}
              <div className="mt-4 grid grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-[#070e1d]">
                  <MapPin className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="block font-mono text-[10px] text-slate-400">Mandi Region</span>
                    <strong className="text-slate-800 dark:text-white">{profile.region}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-[#070e1d]">
                  <UserCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="block font-mono text-[10px] text-slate-400">Verified ID</span>
                    <strong className="font-mono text-slate-800 dark:text-white">
                      {profile.nid_number ?? 'Not provided'}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-[#070e1d]">
                  <Mail className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div className="min-w-0">
                    <span className="block font-mono text-[10px] text-slate-400">Email</span>
                    <strong className="block truncate text-slate-800 dark:text-white">
                      {profile.email}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-[#070e1d]">
                  <Phone className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <div>
                    <span className="block font-mono text-[10px] text-slate-400">Phone</span>
                    <strong className="font-mono text-slate-800 dark:text-white">
                      {profile.phone}
                    </strong>
                  </div>
                </div>

                {profile.specialty_crops && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-[#070e1d]">
                    <Sprout className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <div>
                      <span className="block font-mono text-[10px] text-slate-400">
                        Specialty Commodities
                      </span>
                      <strong className="text-slate-800 dark:text-white">
                        {profile.specialty_crops}
                      </strong>
                    </div>
                  </div>
                )}

                {(profile.years_experience != null || profile.created_at) && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 dark:border-white/5 dark:bg-[#070e1d]">
                    {profile.years_experience != null ? (
                      <Briefcase className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Calendar className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                    <div>
                      <span className="block font-mono text-[10px] text-slate-400">
                        {profile.years_experience != null ? 'Experience' : 'Member Since'}
                      </span>
                      <strong className="text-slate-800 dark:text-white">
                        {profile.years_experience != null
                          ? `${profile.years_experience} Years in Agro Trade`
                          : dateOnly(profile.created_at ?? new Date().toISOString())}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              {profile.address && (
                <div className="mt-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 px-3.5 py-2.5 text-xs dark:border-white/5 dark:bg-[#070e1d]">
                  <span className="block font-mono text-[10px] text-slate-400">
                    Dispatch / Warehouse Address
                  </span>
                  <strong className="text-slate-800 dark:text-white">{profile.address}</strong>
                </div>
              )}

              {/* Active Harvest Listings for Farmers */}
              {crops.length > 0 && (
                <div className="mt-5 space-y-2.5">
                  <div className="flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <Package className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Available Harvest Lots ({crops.length})</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {crops.map((c) => (
                      <div
                        key={c.id}
                        className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-[#1e293b] dark:bg-[#141b2b]"
                      >
                        <div>
                          <div className="truncate font-display text-sm font-bold text-slate-900 dark:text-white">
                            {c.title}
                          </div>
                          <div className="mt-0.5 flex items-center justify-between font-mono text-xs">
                            <span className="text-slate-500 dark:text-slate-400">
                              {num(c.quantity_available)} {c.unit}
                            </span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-400">
                              {taka(c.base_price_per_unit)}/{c.unit}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <FairPriceBadge corridor={c.fair_price_indicator} size="sm" />
                          {canMakeOffer && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOfferCrop(c.id);
                              }}
                              className="btn-primary min-h-[30px] px-2.5 py-1 text-[11px]"
                            >
                              <Handshake className="h-3.5 w-3.5" />
                              Offer
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
