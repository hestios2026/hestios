import api, { BASE_URL } from './client';
import type { WorkEntry } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

export const uploadPhoto = async (
  entryId: number,
  uri: string,
  category: string,
  filename: string,
): Promise<string> => {
  const token = await AsyncStorage.getItem('hestios_token');
  const formData = new FormData();
  formData.append('file', { uri, name: filename, type: 'image/jpeg' } as any);
  formData.append('category', category);
  formData.append('entry_id', String(entryId));

  const res = await fetch(`${BASE_URL}/tagesbericht/photos/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'multipart/form-data',
    },
    body: formData,
  });
  const data = await res.json();
  return data.url;
};

export const fetchEntries = async (siteId?: number) => {
  const params = siteId ? `?site_id=${siteId}` : '';
  const res = await api.get(`/tagesbericht/${params}`);
  return res.data;
};
