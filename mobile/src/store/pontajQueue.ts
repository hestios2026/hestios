import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import type { PontajPayload } from '../api/pontaj';
import { submitPontaj } from '../api/pontaj';

const KEY = 'hestios_pontaj_queue';

export interface QueuedPontaj extends PontajPayload {
  synced: boolean;
}

export async function enqueuePontaj(p: PontajPayload): Promise<void> {
  const q = await getPontajQueue();
  // Replace if same date+site combo already queued and not synced
  const idx = q.findIndex(x => x.date === p.date && x.site_id === p.site_id && !x.synced);
  if (idx >= 0) q[idx] = { ...p, synced: false };
  else q.push({ ...p, synced: false });
  await AsyncStorage.setItem(KEY, JSON.stringify(q));
}

export async function getPontajQueue(): Promise<QueuedPontaj[]> {
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function syncPontajQueue(): Promise<{ synced: number; failed: number; lastError?: string }> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return { synced: 0, failed: 0 };

  const q = await getPontajQueue();
  const pending = q.filter(p => !p.synced);
  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (const item of pending) {
    try {
      await submitPontaj(item);
      item.synced = true;
      synced++;
    } catch (err: any) {
      failed++;
      lastError = err?.response?.data?.detail ?? err?.message ?? String(err);
      console.error('[pontajQueue] sync failed:', lastError);
    }
  }

  await AsyncStorage.setItem(KEY, JSON.stringify(q));
  return { synced, failed, lastError };
}
