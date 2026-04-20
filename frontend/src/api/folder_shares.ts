import api from './client';
import axios from 'axios';

const baseURL = (api.defaults.baseURL as string || '/api').replace(/\/$/, '');

export const listShares  = (folder_id: number) => api.get(`/folders/${folder_id}/shares/`).then(r => r.data);
export const createShare = (folder_id: number, body: object) => api.post(`/folders/${folder_id}/shares/`, body).then(r => r.data);
export const revokeShare = (token: string) => api.delete(`/folder-shares/${token}/`);

// Public (no auth) — use plain axios with absolute URLs
const pub = axios.create({ baseURL: '/api' });

export const publicGetShare  = (token: string) => pub.get(`/public/share/${token}/`).then(r => r.data);
export const publicUpload    = (token: string, fd: FormData) =>
  pub.post(`/public/share/${token}/upload/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }).then(r => r.data);
export const publicDeleteDoc = (token: string, doc_id: number) =>
  pub.delete(`/public/share/${token}/documents/${doc_id}/`);
