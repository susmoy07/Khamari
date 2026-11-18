import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Moon, Sun } from 'lucide-react';

export type Theme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
}

const THEME_KEY = 'khamari_theme';

const Ctx = createContext<ThemeCtx>({
  theme: 'light',
  toggleTheme: () => undefined,
  setTheme: () => undefined,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return <Ctx.Provider value={{ theme, toggleTheme, setTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  return useContext(Ctx);
}

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Theme`}
      className={`group inline-flex items-center gap-2 rounded-full border px-3 py-1.5 font-mono text-[11px] font-bold transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-0.5 hover:shadow-md hover:shadow-emerald-500/15 active:translate-y-0 active:scale-95 ${
        isDark
          ? 'border-[#1e293b] bg-[#141b2b]/90 text-emerald-300 backdrop-blur-md hover:border-emerald-500/60'
          : 'border-emerald-200 bg-emerald-50/90 text-emerald-800 backdrop-blur-md hover:border-emerald-300 hover:bg-emerald-100'
      }`}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse-glow" />
      {isDark ? (
        <Moon className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-12 group-hover:scale-110" />
      ) : (
        <Sun className="h-3.5 w-3.5 transition-transform duration-300 group-hover:rotate-45 group-hover:scale-110" />
      )}
      {!compact && (
        <span className="hidden sm:inline">
          {isDark ? 'Dark Mode: Active' : 'Light Theme: Active'}
        </span>
      )}
    </button>
  );
}
