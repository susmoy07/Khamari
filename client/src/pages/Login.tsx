import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MessageSquare,
  Shield,
  Sprout,
  Store,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { BD_DIVISIONS, DIVISION_LIST } from '../lib/bangladeshRegions';
import type { Role } from '../lib/types';

type AuthMode = 'login' | 'register';
type RegisterRole = Exclude<Role, 'ADMIN'>;

interface LoginModalProps {
  initialMode?: AuthMode;
  initialRole?: RegisterRole;
  onClose?: () => void;
}

const ROLE_CARDS: {
  value: RegisterRole;
  label: string;
  icon: typeof Sprout;
}[] = [
  { value: 'FARMER', label: 'Farmer / Cluster', icon: Sprout },
  { value: 'BAZAAR_COMMITTEE', label: 'Bazar Committee', icon: Store },
  { value: 'BUYER', label: 'Buyer', icon: Building2 },
];

export default function Login({
  initialMode = 'login',
  initialRole = 'FARMER',
  onClose,
}: LoginModalProps) {
  const { login, register } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<AuthMode>(initialMode);

  // Login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [twoFaMethod, setTwoFaMethod] = useState<'SMS' | 'FIDO'>('SMS');

  // Register state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [role, setRole] = useState<RegisterRole>(
    initialRole === 'INSTITUTION' ? 'BUYER' : initialRole
  );
  const [division, setDivision] = useState('Rajshahi');
  const [district, setDistrict] = useState('Bogura');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [certified, setCertified] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const districts = BD_DIVISIONS[division] ?? [];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onClose) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  function handleDivisionChange(nextDivision: string) {
    setDivision(nextDivision);
    const nextDistricts = BD_DIVISIONS[nextDivision] ?? [];
    setDistrict(nextDistricts[0] ?? '');
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setError(null);
  }

  async function submitLogin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(e: FormEvent) {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!certified) {
      setError('Please certify authorization before completing registration.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await register({
        full_name: fullName,
        email,
        phone,
        password,
        role,
        region: district,
        organization_name: organizationName.trim() || undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  const fieldCls =
    'w-full rounded-xl border border-[#1c283e] bg-[#070c17] px-3.5 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition-all focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20';
  const labelCls =
    'mb-1.5 block font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-400';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-md"
      onClick={onClose}
    >
      <div
        className={`animate-fade-in relative my-auto w-full overflow-hidden rounded-2xl border border-emerald-500/25 bg-[#0a101d] text-slate-100 shadow-[0_25px_75px_rgba(0,0,0,0.75)] ${
          mode === 'register' ? 'max-w-[580px]' : 'max-w-[540px]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 pb-4 pt-5">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-500 text-slate-950 shadow-[0_0_22px_rgba(16,185,129,0.45)]">
              <Shield className="h-5 w-5 stroke-[2.4]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-extrabold leading-tight text-white">
                Khamari Agro Terminal
              </h2>
              <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-widest text-emerald-400">
                Mandi Access &amp; Escrow Gateway
              </p>
            </div>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1a2234] text-slate-400 transition hover:bg-[#242e45] hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Full-Width Dual Tab Bar */}
        <div className="grid grid-cols-2 border-y border-[#1b2436]">
          <button
            type="button"
            onClick={() => switchMode('register')}
            className={`py-3 text-center text-xs font-bold tracking-wide transition-all sm:text-sm ${
              mode === 'register'
                ? 'border-b-2 border-emerald-400 bg-emerald-500/10 text-emerald-400'
                : 'text-slate-400 hover:bg-white/[0.02] hover:text-slate-200'
            }`}
          >
            Register Institution / Entity
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            className={`py-3 text-center text-xs font-bold tracking-wide transition-all sm:text-sm ${
              mode === 'login'
                ? 'border-b-2 border-emerald-400 bg-emerald-500/10 text-emerald-400'
                : 'text-slate-400 hover:bg-white/[0.02] hover:text-slate-200'
            }`}
          >
            Institutional Login
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {mode === 'login' ? (
            <form key="login" onSubmit={submitLogin} className="animate-fade-in space-y-4">
              <div>
                <label className={labelCls}>Trader Email or Terminal ID</label>
                <input
                  className={fieldCls}
                  type="email"
                  autoComplete="username"
                  placeholder="trader-882@khamari.gov.bd"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className={labelCls}>Terminal Password</label>
                <div className="relative">
                  <input
                    className={`${fieldCls} pr-10`}
                    type={showPass ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass((v) => !v)}
                    aria-label={showPass ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-200"
                  >
                    {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <span className={labelCls}>Two-Factor Authentication (2FA)</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTwoFaMethod('SMS')}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                      twoFaMethod === 'SMS'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-[#1c283e] bg-[#070c17] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <MessageSquare className="h-4 w-4" />
                    <span>SMS OTP</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTwoFaMethod('FIDO')}
                    className={`flex items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition ${
                      twoFaMethod === 'FIDO'
                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                        : 'border-[#1c283e] bg-[#070c17] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                    }`}
                  >
                    <KeyRound className="h-4 w-4" />
                    <span>FIDO / YubiKey</span>
                  </button>
                </div>
              </div>

              {error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-950/50 px-3.5 py-2.5 text-xs font-medium text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2fe2a5] to-[#17c98e] py-3.5 text-sm font-bold text-[#031910] shadow-[0_8px_28px_rgba(47,226,165,0.3)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Sign In to Khamari Terminal</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <div className="pt-1 text-center">
                <button
                  type="button"
                  onClick={() =>
                    toast('Contact your Regional Mandi Coordinator to reset terminal access.', 'info')
                  }
                  className="text-xs font-medium text-slate-400 transition hover:text-emerald-400"
                >
                  Forgot terminal security key?
                </button>
              </div>
            </form>
          ) : (
            <form key="register" onSubmit={submitRegister} className="animate-fade-in space-y-3.5">
              {/* Row 1: Full Legal Name & Email */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Full Legal Name</label>
                  <input
                    className={fieldCls}
                    type="text"
                    placeholder="Mohammad Rafiqul Islam"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Official Email Address</label>
                  <input
                    className={fieldCls}
                    type="email"
                    autoComplete="email"
                    placeholder="rafiqul@khamari.gov.bd"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Row 2: Phone & Farm / Org */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Phone Number (+880)</label>
                  <input
                    className={fieldCls}
                    type="tel"
                    placeholder="+880 1712-345678"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Farm / Organization Name</label>
                  <input
                    className={fieldCls}
                    type="text"
                    placeholder="Bogura Krishi Khamar Ltd."
                    value={organizationName}
                    onChange={(e) => setOrganizationName(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 3: 3 Unified Role Selector Cards */}
              <div>
                <span className={labelCls}>Select Terminal Account Role</span>
                <div className="grid grid-cols-3 gap-2.5">
                  {ROLE_CARDS.map((card) => {
                    const active = role === card.value;
                    return (
                      <button
                        key={card.value}
                        type="button"
                        onClick={() => setRole(card.value)}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all ${
                          active
                            ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.18)]'
                            : 'border-[#1c283e] bg-[#070c17] text-slate-400 hover:border-slate-600 hover:text-slate-200'
                        }`}
                      >
                        <card.icon className={`h-5 w-5 ${active ? 'text-emerald-400' : 'text-slate-300'}`} />
                        <span className="text-[11px] font-bold leading-tight sm:text-xs">
                          {card.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Row 4: Cascading Mandi Division -> District Hub Node */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Mandi Division</label>
                  <select
                    className={fieldCls}
                    value={division}
                    onChange={(e) => handleDivisionChange(e.target.value)}
                    required
                  >
                    {DIVISION_LIST.map((div) => (
                      <option key={div} value={div}>
                        {div}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>District Hub Node</label>
                  <select
                    className={fieldCls}
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    required
                  >
                    {districts.map((dist) => (
                      <option key={dist} value={dist}>
                        {dist} Mandi Node
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 5: Password & Confirm Password */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className={labelCls}>Password</label>
                  <div className="relative">
                    <input
                      className={`${fieldCls} pr-10`}
                      type={showPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label="Toggle password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Confirm Password</label>
                  <div className="relative">
                    <input
                      className={`${fieldCls} pr-10`}
                      type={showConfirmPass ? 'text' : 'password'}
                      autoComplete="new-password"
                      minLength={6}
                      placeholder="••••••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPass((v) => !v)}
                      aria-label="Toggle confirm password visibility"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    >
                      {showConfirmPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Authorization Checkbox */}
              <label className="flex cursor-pointer items-start gap-2.5 pt-1 text-[11px] leading-relaxed text-slate-400">
                <input
                  type="checkbox"
                  checked={certified}
                  onChange={(e) => setCertified(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-600 bg-white text-emerald-500 focus:ring-emerald-500"
                />
                <span>
                  I certify authorization to bind this entity to Bangladesh Bank BACS Escrow rules,
                  digital tare weighbridge audit policies, and Mandi Directorate regulations.
                </span>
              </label>

              {error && (
                <p className="rounded-xl border border-rose-500/30 bg-rose-950/50 px-3.5 py-2 text-xs font-medium text-rose-300">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#2fe2a5] to-[#17c98e] py-3.5 text-sm font-bold text-[#031910] shadow-[0_8px_28px_rgba(47,226,165,0.3)] transition hover:brightness-105 active:scale-[0.99] disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Complete Institutional Registration</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
