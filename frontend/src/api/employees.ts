import api from './client';

export const fetchEmployees  = () => api.get('/employees/').then(r => r.data);
export const createEmployee  = (body: object) => api.post('/employees/', body).then(r => r.data);
export const updateEmployee  = (id: number, body: object) => api.put(`/employees/${id}/`, body).then(r => r.data);
