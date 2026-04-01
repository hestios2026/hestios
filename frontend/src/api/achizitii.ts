import api from './client';

export const fetchSuppliers = () => api.get('/suppliers/').then(r => r.data);
export const createSupplier = (body: object) => api.post('/suppliers/', body).then(r => r.data);
export const getSupplier = (id: number) => api.get(`/suppliers/${id}/`).then(r => r.data);
export const updateSupplier = (id: number, body: object) => api.put(`/suppliers/${id}/`, body).then(r => r.data);
export const deleteSupplier = (id: number) => api.delete(`/suppliers/${id}/`).then(r => r.data);

export const addPrice = (supplierId: number, body: object) => api.post(`/suppliers/${supplierId}/prices/`, body).then(r => r.data);
export const updatePrice = (supplierId: number, priceId: number, body: object) => api.put(`/suppliers/${supplierId}/prices/${priceId}/`, body).then(r => r.data);
export const deletePrice = (supplierId: number, priceId: number) => api.delete(`/suppliers/${supplierId}/prices/${priceId}/`).then(r => r.data);

export const fetchOrders = (params?: { status?: string; site_id?: number }) => api.get('/orders/', { params }).then(r => r.data);
export const createOrder = (body: object) => api.post('/orders/', body).then(r => r.data);
export const getOrder = (id: number) => api.get(`/orders/${id}/`).then(r => r.data);
export const updateOrder = (id: number, body: object) => api.put(`/orders/${id}/`, body).then(r => r.data);
export const deleteOrder = (id: number) => api.delete(`/orders/${id}/`).then(r => r.data);
