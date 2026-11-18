import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info } from 'lucide-react';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  msg: string;
  tone: Tone;
}

const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => undefined);
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((msg: string, tone: Tone = 'info') => {
    const id = ++seq;
    setItems((x) => [...x, { id, msg, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4500);
  }, []);

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[100] flex flex-col items-center gap-2 px-3">
        {items.map((t) => (
          <div
            key={t.id}
            className={`animate-toast-in pointer-events-auto flex max-w-md items-start gap-2.5 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_14px_34px_rgba(0,0,0,0.22)] backdrop-blur-xl ${
              t.tone === 'success'
                ? 'border-emerald-400/40 bg-emerald-900/95 text-white shadow-emerald-950/30'
                : t.tone === 'error'
                ? 'border-rose-400/45 bg-rose-700/95 text-white shadow-rose-950/30'
                : 'border-slate-700/70 bg-slate-900/95 text-slate-100'
            }`}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
            ) : t.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-200" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
