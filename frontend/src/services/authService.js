import { api } from './api';

export const authService = {
  login: (credentials) => api.post('/auth/login', credentials),
  logout: () => api.post('/auth/logout'),
  me: (options) => api.get('/auth/me', options),
  changePassword: (payload) => api.post('/auth/change-password', payload),
};
