import api from './client';
import type { AuthUser } from '../types';

export const loginWithPin = async (pin: string): Promise<{ token: string; user: AuthUser }> => {
  const res = await api.post('/auth/pin-login/', { pin });
  return res.data;
};

export const fetchSites = async () => {
  const res = await api.get('/sites/?baustellen_only=true');
  return res.data.map((s: any) => ({ id: s.id, name: s.name, kst: s.kostenstelle ?? '' }));
};
