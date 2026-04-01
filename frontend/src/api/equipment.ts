import api from './client';

export const fetchEquipment   = () => api.get('/equipment/').then(r => r.data);
export const createEquipment  = (body: object) => api.post('/equipment/', body).then(r => r.data);
export const updateEquipment  = (id: number, body: object) => api.put(`/equipment/${id}/`, body).then(r => r.data);
export const moveEquipment    = (id: number, body: object) => api.post(`/equipment/${id}/move/`, body).then(r => r.data);
export const fetchMovements   = (id: number) => api.get(`/equipment/${id}/movements/`).then(r => r.data);
