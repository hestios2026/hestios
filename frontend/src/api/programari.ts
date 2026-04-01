import api from './client';

export const fetchProgramari  = (params?: object) => api.get('/programari/', { params }).then(r => r.data);
export const createProgramare = (body: object) => api.post('/programari/', body).then(r => r.data);
export const updateProgramare = (id: number, body: object) => api.put(`/programari/${id}/`, body).then(r => r.data);
export const deleteProgramare = (id: number) => api.delete(`/programari/${id}/`);
