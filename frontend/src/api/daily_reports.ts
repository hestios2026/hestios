import api from './client';

export const fetchDailyReports  = (params?: object) => api.get('/daily-reports/', { params }).then(r => r.data);
export const getDailyReport     = (id: number) => api.get(`/daily-reports/${id}/`).then(r => r.data);
export const createDailyReport  = (body: object) => api.post('/daily-reports/', body).then(r => r.data);
export const updateDailyReport  = (id: number, body: object) => api.put(`/daily-reports/${id}/`, body).then(r => r.data);
export const submitDailyReport  = (id: number) => api.post(`/daily-reports/${id}/submit/`).then(r => r.data);
export const approveDailyReport = (id: number) => api.post(`/daily-reports/${id}/approve/`).then(r => r.data);
export const deleteDailyReport  = (id: number) => api.delete(`/daily-reports/${id}/`);
