/**
 * Offline queue — persists unsent WorkEntry objects to AsyncStorage.
 * On sync, uploads entries + photos sequentially.
 *
 * Safety: uploadEntry is idempotent on the backend (returns existing id if
 * local_uuid already exists). If a photo file no longer exists on device,
 * it is skipped so one missing file doesn't block the entire entry.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Network from 'expo-network';
import * as FileSystem from 'expo-file-system/legacy';
import type { WorkEntry } from '../types';
import { uploadEntry, uploadPhoto } from '../api/tagesbericht';

const QUEUE_KEY = 'hestios_offline_queue';

export async function enqueue(entry: WorkEntry): Promise<void> {
  const existing = await getQueue();
  existing.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(existing));
}

export async function getQueue(): Promise<WorkEntry[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearSynced(): Promise<void> {
  const queue = await getQueue();
  const remaining = queue.filter(e => !e.synced);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
}

async function fileExists(uri: string): Promise<boolean> {
  try {
    if (!uri.startsWith('file://') && !uri.startsWith('/')) return true;
    const info = await FileSystem.getInfoAsync(uri);
    return info.exists;
  } catch {
    return false;
  }
}

export async function syncQueue(
  onProgress?: (current: number, total: number) => void,
): Promise<{ synced: number; failed: number; lastError?: string }> {
  const net = await Network.getNetworkStateAsync();
  if (!net.isConnected) return { synced: 0, failed: 0 };

  const queue = await getQueue();
  const pending = queue.filter(e => !e.synced);
  let synced = 0;
  let failed = 0;
  let lastError: string | undefined;

  for (let i = 0; i < pending.length; i++) {
    const entry = pending[i];
    onProgress?.(i + 1, pending.length);
    try {
      // uploadEntry is idempotent — backend returns existing id if already created
      const remoteId = await uploadEntry(entry);
      entry.remote_id = remoteId;

      const data = entry.data as any;
      if (data?.photos) {
        for (const photo of data.photos) {
          if (photo.uploaded) continue;
          if (!photo.uri) { photo.uploaded = true; continue; }

          const exists = await fileExists(photo.uri);
          if (!exists) {
            console.warn('[syncQueue] Photo file missing, skipping:', photo.uri);
            photo.uploaded = true;
            continue;
          }

          const filename = `${entry.id}_${Date.now()}.jpg`;
          const url = await uploadPhoto(remoteId, photo.uri, photo.category, filename);
          photo.remote_url = url;
          photo.uploaded = true;
        }
      }

      entry.synced = true;
      synced++;
    } catch (err: any) {
      failed++;
      const msg = err?.message ?? String(err);
      lastError = msg;
      console.error('[syncQueue] Entry failed:', entry.id, msg);
    }
  }

  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  return { synced, failed, lastError };
}
