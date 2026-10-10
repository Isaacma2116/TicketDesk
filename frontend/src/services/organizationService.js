import { api } from './api';

export const companyService = {
  get: (options) => api.get('/company', options),
  update: (payload) => api.put('/company', payload),
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('logo', file);
    return api.post('/company/logo', form);
  },
  removeLogo: () => api.delete('/company/logo'),
};

export const departmentsService = {
  list: (params, options) => api.get('/departments', { ...options, params }),
  options: (params, options) => api.get('/departments/options', { ...options, params }),
  managerOptions: (params, options) => api.get('/departments/manager-options', { ...options, params }),
  get: (id, options) => api.get(`/departments/${id}`, options),
  members: (id, options) => api.get(`/departments/${id}/users`, options),
  create: (payload) => api.post('/departments', payload),
  update: (id, payload) => api.put(`/departments/${id}`, payload),
  changeStatus: (id, status) => api.patch(`/departments/${id}/status`, { status }),
  remove: (id) => api.delete(`/departments/${id}`),
};
