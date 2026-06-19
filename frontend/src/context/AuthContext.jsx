import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('token')));

  // Restore the session on first load if a token is already stored.
  useEffect(() => {
    let active = true;
    async function loadUser() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (active) setUser(data.user);
      } catch {
        localStorage.removeItem('token');
        if (active) setToken(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadUser();
    return () => {
      active = false;
    };
  }, [token]);

  const persist = useCallback((data) => {
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      persist(data);
    },
    [persist]
  );

  const register = useCallback(
    async (name, email, password) => {
      const { data } = await api.post('/auth/register', { name, email, password });
      persist(data);
    },
    [persist]
  );

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ token, user, loading, login, register, logout }),
    [token, user, loading, login, register, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
