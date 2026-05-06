import api from './client';

export const fetchEquipment   = () => api.get('/equipment/').then(r => r.data);
export const createEquipment  = (body: object) => api.post('/equipment/', body).then(r => r.data);
export const updateEquipment  = (id: number, body: object) => api.put(`/equipment/${id}/`, body).then(r => r.data);
export const moveEquipment    = (id: number, body: object) => api.post(`/equipment/${id}/move/`, body).then(r => r.data);
export const fetchMovements   = (id: number) => api.get(`/equipment/${id}/movements/`).then(r => r.data);
export const logEquipmentCost    = (id: number, body: object) => api.post(`/equipment/${id}/cost/`, body).then(r => r.data);
export const fetchEquipmentCosts = (id: number) => api.get(`/equipment/${id}/costs/`).then(r => r.data);
export const updateEquipmentCost = (id: number, costId: number, body: object) => api.put(`/equipment/${id}/costs/${costId}/`, body).then(r => r.data);
export const deleteEquipmentCost = (id: number, costId: number) => api.delete(`/equipment/${id}/costs/${costId}/`);
