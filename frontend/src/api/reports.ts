import api from './client';

export const fetchReportSummary = () => api.get('/reports/summary/').then(r => r.data);
export const fetchCostsReport = (params?: { site_id?: number; date_from?: string; date_to?: string }) =>
  api.get('/reports/costs/', { params }).then(r => r.data);
export const fetchAufmassReport = (params?: { site_id?: number; date_from?: string; date_to?: string; status?: string }) =>
  api.get('/reports/aufmass/', { params }).then(r => r.data);
