import api from './client';

export const fetchReclamatii  = (params?: object) => api.get('/reclamatii/', { params }).then(r => r.data);
export const createReclamatie = (body: object)    => api.post('/reclamatii/', body).then(r => r.data);
export const updateReclamatie = (id: number, body: object) => api.patch(`/reclamatii/${id}/`, body).then(r => r.data);
export const deleteReclamatie = (id: number)      => api.delete(`/reclamatii/${id}/`);
