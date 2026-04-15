import api from './client';

export const fetchUsers   = () => api.get('/users/').then(r => r.data);
export const createUser   = (body: object) => api.post('/users/', body).then(r => r.data);
export const updateUser   = (id: number, body: object) => api.put(`/users/${id}/`, body).then(r => r.data);
export const deleteUser   = (id: number) => api.delete(`/users/${id}/`).then(r => r.data);
export const assignSites  = (id: number, site_ids: number[]) => api.put(`/users/${id}/sites/`, { site_ids }).then(r => r.data);
