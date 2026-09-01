import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore, useState, type ReactNode } from 'react';
import { db, type User } from '../lib/db';
import { currentUser, logout as doLogout, can, getSetting } from '../lib/services';
import { translate, type Lang, type TKey } from '../lib/i18n';

/* ---------- db reactivity ---------- */
export function useDB(): number {
  return useSyncExternalStore((cb) => db.subscribe(cb), () => db.revision(), () => 0);
}

/* ---------- toasts ---------- */
export interface Toast { id: number; kind: 'success' | 'error' | 'info' | 'warning'; msg: string; }

/* ---------- app context ---------- */
type ThemeMode = 'light' | 'dark' | 'system';

interface AppState {
  user: User | null;
  setUser: (u: User | null) => void;
  refreshUser: () => void;
  logout: () => void;
  theme: ThemeMode; setTheme: (t: ThemeMode) => void;
  lang: Lang; setLang: (l: Lang) => void;
  t: (key: TKey, vars?: Record<string, string | number>) => string;
  toasts: Toast[];
  toast: (kind: Toast['kind'], msg: string) => void;
  dismissToast: (id: number) => void;
}

const DEFAULT_FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Crect x='1' y='1' width='22' height='22' rx='6' fill='%2314b8a6'/%3E%3Cpath d='M8 6v12M8 12l6-5M8 12l6 5' stroke='%2304211d' stroke-width='2.4' stroke-linecap='round' fill='none'/%3E%3C/svg%3E";

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => currentUser());
  const [theme, setThemeState] = useState<ThemeMode>(() => (localStorage.getItem('kmsit_pref_theme') as ThemeMode) || 'system');
  const [lang, setLangState] = useState<Lang>(() => ((localStorage.getItem('kmsit_pref_lang') as Lang) || (getSetting('default_language', 'id') as Lang) || 'id'));
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const apply = () => {
      const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);

  /* favicon dinamis dari settings CMS */
  const rev = useDB();
  useEffect(() => {
    const fav = db.settings().favicon || '';
    let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.type = fav.includes('svg') ? 'image/svg+xml' : 'image/png';
    link.href = fav || DEFAULT_FAVICON;
  }, [rev]);

  const setTheme = useCallback((t: ThemeMode) => { setThemeState(t); localStorage.setItem('kmsit_pref_theme', t); }, []);
  const setLang = useCallback((l: Lang) => { setLangState(l); localStorage.setItem('kmsit_pref_lang', l); }, []);
  const t = useCallback((key: TKey, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);

  const dismissToast = useCallback((id: number) => setToasts((ts) => ts.filter((x) => x.id !== id)), []);
  const toast = useCallback((kind: Toast['kind'], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts.slice(-3), { id, kind, msg }]);
    window.setTimeout(() => setToasts((ts) => ts.filter((x) => x.id !== id)), 4200);
  }, []);

  const refreshUser = useCallback(() => setUser(currentUser()), []);
  const logout = useCallback(() => { doLogout(user); setUser(null); }, [user]);

  const value = useMemo<AppState>(() => ({
    user, setUser, refreshUser, logout, theme, setTheme, lang, setLang, t, toasts, toast, dismissToast,
  }), [user, theme, lang, toasts, setTheme, setLang, t, toast, dismissToast, refreshUser, logout]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp must be used within AppProvider');
  return v;
}

export function usePerm(perm: string): boolean {
  const { user } = useApp();
  return can(user, perm);
}
