import { useState, useEffect } from 'react';
import type { User } from '../types';

export function useAuth() {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('hestios_user') || 'null'); }
    catch { return null; }
  });

  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('hestios:logout', handler);
    return () => window.removeEventListener('hestios:logout', handler);
  }, []);

  function signIn(accessToken: string, refreshToken: string, userData: User) {
    localStorage.setItem('hestios_token', accessToken);
    localStorage.setItem('hestios_refresh_token', refreshToken);
    localStorage.setItem('hestios_user', JSON.stringify(userData));
    setUser(userData);
  }

  function signOut() {
    localStorage.removeItem('hestios_token');
    localStorage.removeItem('hestios_refresh_token');
    localStorage.removeItem('hestios_user');
    setUser(null);
  }

  return { user, signIn, signOut, isAuthenticated: !!user };
}
