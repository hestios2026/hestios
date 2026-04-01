import api from './client';

export const fetchTagesberichtEntries = (params?: { site_id?: number; work_type?: string; date_from?: string; date_to?: string }) =>
  api.get('/tagesbericht/', { params }).then(r => r.data);

export const getTagesberichtEntry = (id: number) =>
  api.get(`/tagesbericht/${id}/`).then(r => r.data);
