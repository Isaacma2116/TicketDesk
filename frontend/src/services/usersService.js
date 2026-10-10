import { api } from './api';

export const usersService = {
  list: (params, options) => api.get('/users', { ...options, params }),
  get: (id, options) => api.get(`/users/${id}`, options),
  create: (payload) => api.post('/users', payload),
  update: (id, payload) => api.put(`/users/${id}`, payload),
  changeStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  remove: (id) => api.delete(`/users/${id}`),
};

export const rolesService = {
  list: (options) => api.get('/roles', options),
};

export const dashboardService = {
  summary: (options) => api.get('/dashboard/summary', options),
};
