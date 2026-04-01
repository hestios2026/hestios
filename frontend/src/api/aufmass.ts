import api from './client';

export const fetchEntries = (params?: { site_id?: number; status?: string; date_from?: string; date_to?: string }) =>
  api.get('/aufmass/', { params }).then(r => r.data);

export const createEntry = (body: object) => api.post('/aufmass/', body).then(r => r.data);
export const getEntry = (id: number) => api.get(`/aufmass/${id}/`).then(r => r.data);
export const updateEntry = (id: number, body: object) => api.put(`/aufmass/${id}/`, body).then(r => r.data);
export const deleteEntry = (id: number) => api.delete(`/aufmass/${id}/`).then(r => r.data);
export const fetchSummary = (siteId?: number) =>
  api.get('/aufmass-summary/', { params: siteId ? { site_id: siteId } : undefined }).then(r => r.data);
