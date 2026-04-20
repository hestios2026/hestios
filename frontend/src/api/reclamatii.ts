import api from './client';

export const fetchReclamatii  = (params?: object) => api.get('/reclamatii/', { params }).then(r => r.data);
export const createReclamatie = (body: object)    => api.post('/reclamatii/', body).then(r => r.data);
export const updateReclamatie = (id: number, body: object) => api.patch(`/reclamatii/${id}/`, body).then(r => r.data);
export const deleteReclamatie = (id: number)      => api.delete(`/reclamatii/${id}/`);

export const uploadAttachment  = (id: number, fd: FormData) =>
  api.post(`/reclamatii/${id}/attachments/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const listAttachments   = (id: number) => api.get(`/reclamatii/${id}/attachments/`).then(r => r.data);
export const deleteAttachment  = (rid: number, aid: number) => api.delete(`/reclamatii/${rid}/attachments/${aid}/`);
