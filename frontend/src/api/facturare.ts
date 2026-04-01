import api from './client';

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const fetchInvoices = (params?: { status?: string; site_id?: number; invoice_type?: string }) =>
  api.get('/invoices/', { params }).then(r => r.data);
export const createInvoice = (body: object) => api.post('/invoices/', body).then(r => r.data);
export const getInvoice = (id: number) => api.get(`/invoices/${id}/`).then(r => r.data);
export const updateInvoice = (id: number, body: object) => api.put(`/invoices/${id}/`, body).then(r => r.data);
export const deleteInvoice = (id: number) => api.delete(`/invoices/${id}/`).then(r => r.data);
export const fetchInvoiceStats = () => api.get('/invoices/stats/').then(r => r.data);
export const getAufmassForImport = (invoiceId: number, siteId: number) =>
  api.get(`/invoices/${invoiceId}/aufmass-import/`, { params: { site_id: siteId } }).then(r => r.data);
export const registerPayment = (id: number, body: { paid_amount: number; payment_date: string; payment_ref?: string }) =>
  api.post(`/invoices/${id}/payment/`, body).then(r => r.data);
export const releaseRetention = (id: number, release_date: string) =>
  api.post(`/invoices/${id}/release-retention/`, null, { params: { release_date } }).then(r => r.data);
export const exportDATEV = (year?: number, month?: number) => {
  const params: Record<string, number> = {};
  if (year) params.year = year;
  if (month) params.month = month;
  return api.get('/invoices/export/datev/', { params, responseType: 'blob' }).then(r => r.data);
};

// ─── Billing config ───────────────────────────────────────────────────────────
export const getBillingConfig = (siteId: number) =>
  api.get(`/invoices/sites/${siteId}/billing/`).then(r => r.data);
export const saveBillingConfig = (siteId: number, body: object) =>
  api.put(`/invoices/sites/${siteId}/billing/`, body).then(r => r.data);

// ─── Situatii ─────────────────────────────────────────────────────────────────
export const fetchSituatii = (params?: { site_id?: number; status?: string }) =>
  api.get('/situatii/', { params }).then(r => r.data);
export const createSituatie = (body: object) => api.post('/situatii/', body).then(r => r.data);
export const getSituatie = (id: number) => api.get(`/situatii/${id}/`).then(r => r.data);
export const updateSituatie = (id: number, body: object) => api.put(`/situatii/${id}/`, body).then(r => r.data);
export const deleteSituatie = (id: number) => api.delete(`/situatii/${id}/`).then(r => r.data);
export const getAvailableEntries = (sitId: number) =>
  api.get(`/situatii/${sitId}/available-entries/`).then(r => r.data);
export const addEntriesToSituatie = (sitId: number, entry_ids: number[]) =>
  api.post(`/situatii/${sitId}/add-entries/`, entry_ids).then(r => r.data);
export const removeEntryFromSituatie = (sitId: number, entryId: number) =>
  api.delete(`/situatii/${sitId}/entries/${entryId}/`).then(r => r.data);
export const generateInvoiceFromSituatie = (sitId: number) =>
  api.post(`/situatii/${sitId}/invoice/`).then(r => r.data);
