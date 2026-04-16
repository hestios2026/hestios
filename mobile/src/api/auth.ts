import api from './client';
import type { AuthUser } from '../types';

export interface MobileUser {
  id: number;
  full_name: string;
  role: string;
}

export const fetchMobileUsers = async (): Promise<MobileUser[]> => {
  const res = await api.get('/auth/mobile-users/');
  return res.data;
};

export const loginWithPin = async (userId: number, pin: string): Promise<{ token: string; user: AuthUser }> => {
  const res = await api.post('/auth/pin-login/', { user_id: userId, pin });
  return res.data;
};

export const fetchSites = async () => {
  const res = await api.get('/sites/?baustellen_only=true');
  return res.data.map((s: any) => ({ id: s.id, name: s.name, kst: s.kostenstelle ?? '' }));
};
