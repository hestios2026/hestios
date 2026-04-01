import api from './client';

export const fetchSettings = () => api.get('/settings/').then(r => r.data);
export const saveSettings  = (body: Record<string, string>) => api.put('/settings/', body).then(r => r.data);

export interface DocCategory {
  key: string;
  label: string;
  color: string;
  icon: string;
}

export const fetchDocumentCategories = () => api.get('/settings/document-categories/').then(r => r.data as DocCategory[]);
export const saveDocumentCategories  = (cats: DocCategory[]) => api.put('/settings/document-categories/', cats).then(r => r.data);

export const fetchConnectionTypes = () => api.get('/settings/connection-types/').then(r => r.data as string[]);
export const saveConnectionTypes  = (types: string[]) => api.put('/settings/connection-types/', types).then(r => r.data);
