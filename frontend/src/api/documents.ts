import api from './client';

export const fetchDocuments = (params?: {
  category?: string; site_id?: number;
  employee_id?: number; equipment_id?: number; folder_id?: number; search?: string;
  limit?: number; offset?: number;
}) => api.get('/documents/', { params }).then(r => r.data as { total: number; items: import('../types').Document[] });

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

export const moveDocument = (id: number, folder_id: number | null) =>
  api.patch(`/documents/${id}/move/`, { folder_id }).then(r => r.data);

export const updateDocMeta = (id: number, body: { name?: string; tags?: string; expires_at?: string }) =>
  api.patch(`/documents/${id}/meta/`, body).then(r => r.data);

export const getDocVersions = (id: number) => api.get(`/documents/${id}/versions/`).then(r => r.data);

export const bulkDocAction = (ids: number[], action: 'delete' | 'move', folder_id?: number | null) =>
  api.post('/documents/bulk/', { ids, action, folder_id }).then(r => r.data);
