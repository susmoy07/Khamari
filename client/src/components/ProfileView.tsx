import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react';
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  MapPin,
  Save,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UserCircle,
} from 'lucide-react';
import { api, API_BASE } from '../lib/api';
import { BD_DIVISIONS, DIVISION_LIST } from '../lib/bangladeshRegions';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { User } from '../lib/types';

interface Props {
  user: User;
  onViewPublic: (userId: number) => void;
}

function resolveInitialDivision(region: string): string {
  for (const [div, districts] of Object.entries(BD_DIVISIONS)) {
    if (districts.some((d) => region === d || region.startsWith(d))) {
      return div;
    }
  }
  return 'Rajshahi';
}

export default function ProfileView({ user, onViewPublic }: Props) {
  const { updateUser } = useAuth();
  const toast = useToast();

  // Profile fields
  const [fullName, setFullName] = useState(user.full_name);
  const [phone, setPhone] = useState(user.phone);
  const [organizationName, setOrganizationName] = useState(user.organization_name ?? '');
  const [division, setDivision] = useState(() => resolveInitialDivision(user.region));
  const [region, setRegion] = useState(user.region);
  const [address, setAddress] = useState(user.address ?? '');
  const [specialtyCrops, setSpecialtyCrops] = useState(user.specialty_crops ?? '');
  const [yearsExperience, setYearsExperience] = useState(
    user.years_experience != null ? String(user.years_experience) : ''
  );
  const [bio, setBio] = useState(user.bio ?? '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Avatar state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Verification / OTP state
  const [nidNumber, setNidNumber] = useState(user.nid_number ?? '');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [otpSentInfo, setOtpSentInfo] = useState<{
    message: string;
    devOtp?: string;
    email: string;
  } | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    setFullName(user.full_name);
    setPhone(user.phone);
    setOrganizationName(user.organization_name ?? '');
    setDivision(resolveInitialDivision(user.region));
    setRegion(user.region);
    setAddress(user.address ?? '');
    setSpecialtyCrops(user.specialty_crops ?? '');
    setYearsExperience(user.years_experience != null ? String(user.years_experience) : '');
    setBio(user.bio ?? '');
    if (user.nid_number) setNidNumber(user.nid_number);
  }, [user]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = window.setInterval(() => {
      setResendCooldown((c) => (c > 0 ? c - 1 : 0));
    }, 1000);
    return () => window.clearInterval(t);
  }, [resendCooldown]);

  const districts = BD_DIVISIONS[division] ?? [];
  const initials = user.full_name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
  const isFullyVerified = Boolean(user.is_verified && user.email_verified);
  const otpCode = otpDigits.join('');

  async function handleAvatarChange(file: File | null) {
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await api.uploadAvatar(file);
      updateUser(res.user);
      toast('Profile picture updated!', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to upload profile photo', 'error');
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await api.updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        organization_name: organizationName.trim(),
        region: region.trim(),
        bio: bio.trim(),
        nid_number: nidNumber.trim(),
        address: address.trim(),
        specialty_crops: specialtyCrops.trim(),
        years_experience: yearsExperience === '' ? null : Number(yearsExperience),
      });
      updateUser(res.user);
      toast('Profile details saved successfully.', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not save profile', 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleSendOtp() {
    if (!nidNumber.trim() || nidNumber.trim().length < 5) {
      toast('Enter your National ID / Krishi ID / Trade License first (min 5 chars).', 'error');
      return;
    }
    setSendingOtp(true);
    try {
      const res = await api.sendVerificationOtp({ nid_number: nidNumber.trim() });
      setOtpSentInfo({
        message: res.message,
        devOtp: res.dev_otp,
        email: res.email,
      });
      setResendCooldown(30);
      toast(res.message, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Failed to send verification OTP', 'error');
    } finally {
      setSendingOtp(false);
    }
  }

  function handleOtpChange(idx: number, val: string) {
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      setOtpDigits((prev) => prev.map((d, i) => (i === idx ? '' : d)));
      return;
    }
    if (clean.length > 1) {
      const next = [...otpDigits];
      for (let i = 0; i < 6; i++) {
        next[i] = clean[i] ?? next[i];
      }
      setOtpDigits(next);
      otpRefs.current[Math.min(5, clean.length - 1)]?.focus();
      return;
    }
    setOtpDigits((prev) => prev.map((d, i) => (i === idx ? clean : d)));
    if (idx < 5) otpRefs.current[idx + 1]?.focus();
  }

  function handleOtpKeyDown(idx: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otpDigits[idx] && idx > 0) {
      otpRefs.current[idx - 1]?.focus();
    }
  }

  function handleOtpPaste(e: ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    e.preventDefault();
    const next = ['', '', '', '', '', ''];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setOtpDigits(next);
    otpRefs.current[Math.min(5, pasted.length - 1)]?.focus();
  }

  async function handleVerifyOtp() {
    if (otpCode.length !== 6) {
      toast('Enter all 6 digits of the email OTP.', 'error');
      return;
    }
    setVerifyingOtp(true);
    try {
      const res = await api.verifyEmailOtp({
        otp: otpCode,
        nid_number: nidNumber.trim() || undefined,
      });
      updateUser(res.user);
      setOtpSentInfo(null);
      setOtpDigits(['', '', '', '', '', '']);
      toast(res.message, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'OTP verification failed', 'error');
    } finally {
      setVerifyingOtp(false);
    }
  }

  async function handlePasswordSave(e: FormEvent) {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast('New passwords do not match.', 'error');
      return;
    }
    setChangingPassword(true);
    try {
      const res = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(res.message, 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Password update failed', 'error');
    } finally {
      setChangingPassword(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Top Hero Profile Banner */}
      <section className="card overflow-hidden p-0 hover:translate-y-0">
        <div className="h-28 bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-700 dark:from-[#08241d] dark:via-[#0b382c] dark:to-[#0c1a32]" />
        <div className="px-6 pb-6">
          <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-wrap items-end gap-4">
              {/* Avatar Upload Button */}
              <div className="group relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-white bg-emerald-100 shadow-lg dark:border-[#141b2b] dark:bg-emerald-950">
                {user.avatar_url ? (
                  <img
                    src={`${API_BASE}${user.avatar_url}`}
                    alt={user.full_name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center font-display text-2xl font-extrabold text-emerald-800 dark:text-emerald-300">
                    {initials}
                  </div>
                )}

                <button
                  type="button"
                  disabled={uploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                  title="Change profile photo"
                  className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-xs font-bold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                >
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <>
                      <Camera className="h-5 w-5" />
                      <span className="mt-1 text-[10px]">Change</span>
                    </>
                  )}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => handleAvatarChange(e.target.files?.[0] ?? null)}
                />
              </div>

              <div className="pb-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-2xl font-extrabold text-slate-900 dark:text-white">
                    {user.full_name}
                  </h2>
                  {isFullyVerified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/35 bg-emerald-500/15 px-3 py-0.5 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                      <BadgeCheck className="h-4 w-4" />
                      ID &amp; Email Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/35 bg-amber-500/15 px-3 py-0.5 font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
                      <ShieldAlert className="h-4 w-4" />
                      Verification Pending
                    </span>
                  )}
                </div>

                <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-xs text-slate-500 dark:text-slate-400">
                  <span className="rounded bg-slate-100 px-2 py-0.5 font-bold uppercase text-slate-700 dark:bg-[#070e1d] dark:text-emerald-300">
                    {user.role === 'INSTITUTION' ? 'BUYER' : user.role.replace('_', ' ')}
                  </span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {user.region}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                    {user.email}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost min-h-[40px] px-4 py-2 text-xs"
              >
                <Camera className="h-4 w-4" />
                <span>{uploadingAvatar ? 'Uploading...' : 'Upload Photo'}</span>
              </button>
              <button
                type="button"
                onClick={() => onViewPublic(user.id)}
                className="btn-primary min-h-[40px] px-4 py-2 text-xs"
              >
                <UserCircle className="h-4 w-4" />
                <span>View Public Profile</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: ID & Email OTP Verification + Change Password */}
        <div className="space-y-6 lg:col-span-5">
          {/* ID & Email OTP Verification Card */}
          <section className="card space-y-4 p-5 hover:translate-y-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                    ID &amp; Email Verification
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confirm your National ID &amp; 6-digit email OTP
                  </p>
                </div>
              </div>
              {isFullyVerified && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>

            {isFullyVerified ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 text-xs dark:bg-emerald-950/25">
                <div className="font-bold text-emerald-800 dark:text-emerald-300">
                  Account Verified Successfully
                </div>
                <p className="mt-1 text-slate-600 dark:text-slate-300">
                  Your email (<strong>{user.email}</strong>) and identity ({user.nid_number || 'Recorded'})
                  are confirmed. Other traders see your verified badge across Khamari.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <label className="block">
                  <span className="label">National ID / Krishi ID / Trade License</span>
                  <input
                    className="input font-mono"
                    placeholder="e.g. NID-1990261834921"
                    value={nidNumber}
                    onChange={(e) => setNidNumber(e.target.value)}
                  />
                </label>

                <div className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-slate-50 px-3.5 py-2.5 text-xs dark:border-white/5 dark:bg-[#070e1d]">
                  <span className="text-slate-500 dark:text-slate-400">OTP Recipient:</span>
                  <strong className="font-mono text-slate-900 dark:text-white">{user.email}</strong>
                </div>

                <button
                  type="button"
                  disabled={sendingOtp || resendCooldown > 0}
                  onClick={handleSendOtp}
                  className="btn-amber w-full min-h-[42px] text-xs font-bold"
                >
                  {sendingOtp ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Mail className="h-4 w-4" />
                  )}
                  <span>
                    {resendCooldown > 0
                      ? `Resend OTP in ${resendCooldown}s`
                      : otpSentInfo
                      ? 'Resend 6-Digit OTP to Email'
                      : 'Send Verification OTP to Email'}
                  </span>
                </button>

                {otpSentInfo && (
                  <div className="animate-fade-in space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-50/60 p-3.5 dark:bg-emerald-950/20">
                    <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                      {otpSentInfo.message}
                    </p>

                    {otpSentInfo.devOtp && (
                      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs dark:bg-amber-950/35">
                        <div className="flex items-center gap-1.5 font-mono text-amber-800 dark:text-amber-300">
                          <Sparkles className="h-3.5 w-3.5" />
                          <span>
                            Mail Preview OTP: <strong>{otpSentInfo.devOtp}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setOtpDigits(otpSentInfo.devOtp!.split(''));
                          }}
                          className="rounded-md bg-amber-500 px-2 py-1 font-mono text-[10px] font-bold text-slate-950 hover:bg-amber-400"
                        >
                          Fill OTP
                        </button>
                      </div>
                    )}

                    <div>
                      <span className="label">Enter 6-Digit Email OTP</span>
                      <div className="grid grid-cols-6 gap-2">
                        {otpDigits.map((digit, idx) => (
                          <input
                            key={idx}
                            ref={(el) => {
                              otpRefs.current[idx] = el;
                            }}
                            type="text"
                            inputMode="numeric"
                            maxLength={6}
                            value={digit}
                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                            onPaste={handleOtpPaste}
                            className="input h-11 px-0 text-center font-mono text-lg font-extrabold"
                          />
                        ))}
                      </div>
                    </div>

                    <button
                      type="button"
                      disabled={verifyingOtp || otpCode.length !== 6}
                      onClick={handleVerifyOtp}
                      className="btn-primary w-full min-h-[42px] text-xs font-bold"
                    >
                      {verifyingOtp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>Confirm OTP &amp; Verify Account</span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Change Password Card */}
          <section className="card space-y-4 p-5 hover:translate-y-0">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-700 dark:text-amber-400">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  Security &amp; Password
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Update your account password anytime
                </p>
              </div>
            </div>

            <form onSubmit={handlePasswordSave} className="space-y-3">
              <div>
                <label className="label">Current Password</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent((v) => !v)}
                    aria-label="Toggle current password visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">New Password (min 6 chars)</label>
                <div className="relative">
                  <input
                    className="input pr-10"
                    type={showNew ? 'text' : 'password'}
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    aria-label="Toggle new password visibility"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="label">Confirm New Password</label>
                <input
                  className="input"
                  type="password"
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={changingPassword}
                className="btn-ghost w-full min-h-[42px] text-xs font-bold"
              >
                {changingPassword ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                <span>Update Password</span>
              </button>
            </form>
          </section>
        </div>

        {/* RIGHT COLUMN: Edit Bio & Trader Details */}
        <section className="card space-y-4 p-5 hover:translate-y-0 lg:col-span-7 sm:p-6">
          <div>
            <h3 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              Profile Details &amp; Public Bio
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Information below appears on your public profile when buyers, farmers, or committees view your account.
            </p>
          </div>

          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="label">Full Legal Name</span>
                <input
                  className="input"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="label">Phone Number (+880)</span>
                <input
                  className="input font-mono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="label">Farm / Organization Name</span>
                <input
                  className="input"
                  placeholder="e.g. Mondol Krishi Khamar"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="label">National ID / License No.</span>
                <input
                  className="input font-mono"
                  placeholder="e.g. NID-1990261834921"
                  value={nidNumber}
                  onChange={(e) => setNidNumber(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="label">Division</span>
                <select
                  className="input"
                  value={division}
                  onChange={(e) => {
                    const nextDiv = e.target.value;
                    setDivision(nextDiv);
                    setRegion((BD_DIVISIONS[nextDiv] ?? [])[0] ?? '');
                  }}
                >
                  {DIVISION_LIST.map((div) => (
                    <option key={div} value={div}>
                      {div}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">District / Mandi Hub</span>
                <select
                  className="input"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                >
                  {!districts.includes(region) && <option value={region}>{region}</option>}
                  {districts.map((dist) => (
                    <option key={dist} value={dist}>
                      {dist}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="label">Specialty Crops / Commodities</span>
                <input
                  className="input"
                  placeholder="e.g. Diamond Potato, Miniket Rice, Onion"
                  value={specialtyCrops}
                  onChange={(e) => setSpecialtyCrops(e.target.value)}
                />
              </label>

              <label className="block">
                <span className="label">Years in Agro Trade</span>
                <input
                  className="input font-mono"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="e.g. 8"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                />
              </label>
            </div>

            <label className="block">
              <span className="label">Warehouse / Farm Dispatch Address</span>
              <input
                className="input"
                placeholder="Village, Upazila, Cold Storage Gate or Wholesale Arat Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="label">Public Biography &amp; Quality Commitment</span>
              <textarea
                className="input"
                rows={4}
                placeholder="Tell buyers or farmers about your farm cluster, storage facilities, sorting standards, or procurement volume..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            </label>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={savingProfile}
                className="btn-primary w-full px-6 sm:w-auto"
              >
                {savingProfile ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                <span>Save Profile Changes</span>
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
