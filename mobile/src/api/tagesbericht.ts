import api, { BASE_URL } from './client';
import type { WorkEntry } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';

export const uploadEntry = async (entry: WorkEntry): Promise<number> => {
  const payload = {
    id: entry.id,
    site_id: entry.site_id,
    nvt_number: entry.nvt_number,
    work_type: entry.work_type,
    created_by: entry.created_by,
    created_by_name: entry.created_by_name,
    created_at: entry.created_at,
    data: entry.data,
  };
  const res = await api.post('/tagesbericht/', payload);
  return res.data.id;
};

/**
 * Upload a photo using FileSystem.uploadAsync (expo-file-system).
 *
 * WHY NOT fetch/axios + FormData:
 *   Expo 54 replaces the global FormData with its own standards-compliant
 *   implementation (expo/src/winter/FormData.ts) that does NOT support
 *   the React Native-specific { uri, name, type } file object pattern.
 *   This causes silent failures where the file body is empty or malformed.
 *
 * FileSystem.uploadAsync is a native implementation that handles all
 * local URI types (file://, content://) correctly on Android.
 */
export const uploadPhoto = async (
  entryId: number,
  uri: string,
  category: string,
  _filename: string,
): Promise<string> => {
  const token = await AsyncStorage.getItem('hestios_token');

  const result = await FileSystem.uploadAsync(
    `${BASE_URL}/tagesbericht/photos/`,
    uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'image/jpeg',
      parameters: {
        category,
        entry_id: String(entryId),
      },
      headers: {
        Authorization: `Bearer ${token ?? ''}`,
      },
    },
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Upload failed ${result.status}: ${result.body}`);
  }

  const data = JSON.parse(result.body);
  return data.url;
};

export const fetchEntries = async (siteId?: number) => {
  const params = siteId ? `?site_id=${siteId}` : '';
  const res = await api.get(`/tagesbericht/${params}`);
  return res.data;
};
