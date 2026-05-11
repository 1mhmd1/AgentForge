import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  login as apiLogin,
  logout as apiLogout,
  register as apiRegister,
  me as apiMe,
  refresh as apiRefresh,
  AuthUser,
} from '../api/auth';
import { getAccessToken, onUnauthorizedResponse, setAccessToken } from '../api/client';

interface AuthState {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function useAuth(): AuthState {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  // Boot: if we have a stored access token, try `/auth/me`. If that 401s,
  // try refreshing via cookie. If both fail, mark unauthenticated.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getAccessToken();
      if (token) {
        const payload = await apiMe();
        if (cancelled) return;
        if (payload) {
          setUser({ id: payload.sub, email: payload.email, role: payload.role });
          setStatus('authenticated');
          return;
        }
      }
      // No valid access token; try refresh.
      const refreshed = await apiRefresh();
      if (cancelled) return;
      if (refreshed) {
        setUser(refreshed.user);
        setStatus('authenticated');
      } else {
        setStatus('unauthenticated');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Backend-emitted 401 (e.g. token expired mid-session) -> drop the user.
  // The Login page will be re-rendered by App. The refresh cookie may still
  // be valid; reloading will trigger the boot flow above.
  useEffect(() => {
    return onUnauthorizedResponse(() => {
      setAccessToken(null);
      if (mounted.current) {
        setUser(null);
        setStatus('unauthenticated');
      }
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await apiLogin(email, password);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (email: string, password: string, name?: string) => {
    const res = await apiRegister(email, password, name);
    setUser(res.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, status, login, register, logout }),
    [user, status, login, register, logout],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
