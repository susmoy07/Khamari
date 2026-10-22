import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, getToken, setToken, type RegisterInput } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { User } from '../lib/types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(!!getToken());

  useEffect(() => {
    if (!getToken()) return;
    api
      .me()
      .then((d) => {
        setUser(d.user);
        connectSocket();
      })
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api.login(email, password);
    setToken(d.token);
    setUser(d.user);
    connectSocket();
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const d = await api.register(input);
    setToken(d.token);
    setUser(d.user);
    connectSocket();
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    disconnectSocket();
  }, []);

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within AuthProvider');
  return c;
}
