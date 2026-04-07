import api from './client';

export const fetchNotifications    = (params?: object) => api.get('/notifications/', { params }).then(r => r.data);
export const fetchUnreadCount      = () => api.get('/notifications/unread-count/').then(r => r.data);
export const markNotificationRead  = (id: number) => api.post(`/notifications/${id}/read/`).then(r => r.data);
export const markAllNotificationsRead = () => api.post('/notifications/mark-all-read/').then(r => r.data);
