import api from './client';

export const fetchCatalogs = (params?: { site_id?: number; work_type?: string; templates_only?: boolean }) =>
  api.get('/lv/', { params }).then(r => r.data);

export const createCatalog = (body: object) => api.post('/lv/', body).then(r => r.data);
export const getCatalog    = (id: number)    => api.get(`/lv/${id}/`).then(r => r.data);
export const updateCatalog = (id: number, body: object) => api.put(`/lv/${id}/`, body).then(r => r.data);
export const deleteCatalog = (id: number)    => api.delete(`/lv/${id}/`).then(r => r.data);
export const cloneCatalog  = (id: number, body: object) => api.post(`/lv/${id}/clone/`, body).then(r => r.data);

export const addPosition    = (lvId: number, body: object) =>
  api.post(`/lv/${lvId}/positions/`, body).then(r => r.data);
export const updatePosition = (lvId: number, posId: number, body: object) =>
  api.put(`/lv/${lvId}/positions/${posId}/`, body).then(r => r.data);
export const deletePosition = (lvId: number, posId: number) =>
  api.delete(`/lv/${lvId}/positions/${posId}/`).then(r => r.data);

export const searchPositions = (params: { q?: string; site_id?: number; work_type?: string; limit?: number }) =>
  api.get('/lv/positions/search/', { params }).then(r => r.data);

export const reorderPositions = (lvId: number, order: number[]) =>
  api.put(`/lv/${lvId}/positions/reorder/`, { order }).then(r => r.data);

export const importCSV = (lvId: number, file: File, replace = false) => {
  const form = new FormData();
  form.append('file', file);
  return api.post(`/lv/${lvId}/import/?replace=${replace}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);
};

export const exportCSVUrl = (lvId: number) =>
  `/api/lv/${lvId}/export/`;
