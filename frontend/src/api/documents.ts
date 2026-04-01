import api from './client';

export const fetchDocuments = (params?: {
  category?: string; site_id?: number;
  employee_id?: number; equipment_id?: number; search?: string;
}) => api.get('/documents/', { params }).then(r => r.data);

export const uploadDocument = (formData: FormData) =>
  api.post('/documents/upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(r => r.data);

export const getDocument = (id: number) => api.get(`/documents/${id}/`).then(r => r.data);
export const deleteDocument = (id: number) => api.delete(`/documents/${id}/`).then(r => r.data);
export const getDownloadUrl = (id: number) => `${api.defaults.baseURL}/documents/${id}/download/`;
export const getDocumentContent = (id: number) => api.get(`/documents/${id}/content/`).then(r => r.data as string);
export const updateDocumentContent = (id: number, content: string) =>
  api.put(`/documents/${id}/content/`, { content }).then(r => r.data);
