import api from './client';

export const fetchSites = (baustellenOnly = false) =>
  api.get('/sites/', { params: baustellenOnly ? { baustellen_only: true } : {} }).then(r => r.data);
export const listSites = () => api.get('/sites/').then(r => r.data);
export const fetchSite  = (id: number) => api.get(`/sites/${id}/`).then(r => r.data);
export const createSite = (body: object) => api.post('/sites/', body).then(r => r.data);
export const updateSite = (id: number, body: object) => api.put(`/sites/${id}/`, body).then(r => r.data);

export const fetchCosts   = (id: number) => api.get(`/sites/${id}/costs/`).then(r => r.data);
export const addCost      = (id: number, body: object) => api.post(`/sites/${id}/costs/`, body).then(r => r.data);
export const fetchMaterials = (id: number) => api.get(`/sites/${id}/materials/`).then(r => r.data);
export const addMaterial  = (id: number, body: object) => api.post(`/sites/${id}/materials/`, body).then(r => r.data);
