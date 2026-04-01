import api from './client';

export interface FolderItem {
  id: number;
  name: string;
  parent_id: number | null;
  site_id: number | null;
  site_name: string | null;
  site_kostenstelle: string | null;
  created_by: number | null;
  creator_name: string | null;
  created_at: string;
  description: string | null;
  doc_count: number;
  children?: FolderItem[];
}

export const fetchFolders = (params?: { site_id?: number; parent_id?: number }) =>
  api.get('/folders/', { params }).then(r => r.data as FolderItem[]);

export const createFolder = (data: { name: string; site_id?: number; parent_id?: number; description?: string }) =>
  api.post('/folders/', data).then(r => r.data as FolderItem);

export const renameFolder = (id: number, data: { name: string; description?: string }) =>
  api.patch(`/folders/${id}/`, data).then(r => r.data as FolderItem);

export const deleteFolder = (id: number) =>
  api.delete(`/folders/${id}/`).then(r => r.data);
