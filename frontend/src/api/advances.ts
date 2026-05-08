import client from './client';

export interface Advance {
  id: number;
  employee_id: number;
  employee_name: string | null;
  amount: number;
  currency: string;
  date: string;
  description: string | null;
  site_id: number | null;
  site_name: string | null;
  settled: boolean;
  settled_at: string | null;
  settled_note: string | null;
  notes: string | null;
  recorded_by: string | null;
  created_at: string;
}

export async function fetchAdvances(params?: { employee_id?: number; settled?: boolean }) {
  const res = await client.get<{ items: Advance[]; total_open: number }>('/advances/', { params });
  return res.data;
}

export async function createAdvance(data: {
  employee_id: number;
  amount: number;
  currency?: string;
  date?: string;
  description?: string;
  site_id?: number;
  notes?: string;
}) {
  const res = await client.post<Advance>('/advances/', data);
  return res.data;
}

export async function settleAdvance(id: number, settled_note?: string) {
  const res = await client.post<Advance>(`/advances/${id}/settle/`, { settled_note });
  return res.data;
}

export async function deleteAdvance(id: number) {
  await client.delete(`/advances/${id}/`);
}
