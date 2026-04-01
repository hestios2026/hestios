import api from './client';

export async function login(email: string, password: string) {
  const params = new URLSearchParams({ username: email, password });
  const { data } = await api.post('/auth/login/', params, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  return data;
}

export async function getMe() {
  const { data } = await api.get('/auth/me/');
  return data;
}
