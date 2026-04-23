import api from './client';

export interface Programare {
  id: number;
  client_name: string;
  client_phone: string | null;
  address: string;
  city: string | null;
  zip_code: string | null;
  connection_type: string | null;
  status: string;
  scheduled_date: string;
  assigned_site_id: number | null;
  assigned_site_name: string | null;
  assigned_team_id: number | null;
  assigned_team_name: string | null;
  notes: string | null;
  completed_at: string | null;
}

export async function fetchProgramariZi(day: string, siteId?: number): Promise<Programare[]> {
  const params: Record<string, any> = { day };
  if (siteId) params.site_id = siteId;
  const { data } = await api.get('/programari/', { params });
  return data;
}

export async function updateProgramareStatus(id: number, status: string): Promise<Programare> {
  const { data } = await api.put(`/programari/${id}/`, { status });
  return data;
}
