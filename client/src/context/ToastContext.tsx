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
            className={`pointer-events-auto flex max-w-md items-start gap-2 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
              t.tone === 'success'
                ? 'bg-forest-800 text-white'
                : t.tone === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-ink text-white'
            }`}
          >
            {t.tone === 'success' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : t.tone === 'error' ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
