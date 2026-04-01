import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Change this to your server URL in production
export const BASE_URL = __DEV__
  ? 'http://10.0.2.2:8002/api'       // dev: Android emulator → host machine
  : 'https://erp.hesti-rossmann.de/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('hestios_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On 401, clear token so App.tsx redirects to login on next render
api.interceptors.response.use(
  res => res,
  async err => {
    if (err?.response?.status === 401) {
      await AsyncStorage.multiRemove(['hestios_token', 'hestios_user']);
    }
    return Promise.reject(err);
  },
);

export default api;
