import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, AuthUser, clearSession, getUser, saveSession } from './api';

interface AuthCtx {
  user: AuthUser | null;
  ready: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>(null as any);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    getUser().then((u) => { setUser(u); setReady(true); });
  }, []);

  const login = async (email: string, password: string) => {
    const r = await api.login(email, password);
    await saveSession(r.accessToken, r.user);
    setUser(r.user);
  };

  const logout = async () => {
    await clearSession();
    setUser(null);
  };

  return <Ctx.Provider value={{ user, ready, login, logout }}>{children}</Ctx.Provider>;
}
