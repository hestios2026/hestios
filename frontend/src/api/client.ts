import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('hestios_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

let isRefreshing = false;
let pendingQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  pendingQueue.forEach(p => error ? p.reject(error) : p.resolve(token!));
  pendingQueue = [];
}

function logout() {
  localStorage.removeItem('hestios_token');
  localStorage.removeItem('hestios_refresh_token');
  localStorage.removeItem('hestios_user');
  window.dispatchEvent(new Event('hestios:logout'));
}

api.interceptors.response.use(
  r => r,
  async err => {
    const original = err.config;

    if (err.response?.status !== 401 || original._retry) {
      return Promise.reject(err);
    }

    const refreshToken = localStorage.getItem('hestios_refresh_token');
    if (!refreshToken) {
      logout();
      return Promise.reject(err);
    }

    // Dacă un refresh e deja în curs, pune request-ul în coadă
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        pendingQueue.push({ resolve, reject });
      }).then(token => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const { data } = await axios.post('/api/auth/refresh/', { refresh_token: refreshToken });
      localStorage.setItem('hestios_token', data.access_token);
      localStorage.setItem('hestios_refresh_token', data.refresh_token);
      localStorage.setItem('hestios_user', JSON.stringify(data.user));
      api.defaults.headers.common.Authorization = `Bearer ${data.access_token}`;
      processQueue(null, data.access_token);
      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshErr) {
      processQueue(refreshErr, null);
      logout();
      return Promise.reject(refreshErr);
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;
