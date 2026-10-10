import { api } from './api';

export const categoriesService = {
  list: (params, options) => api.get('/categories', { ...options, params }),
  scopeDepartments: (options) => api.get('/categories/departments', options),
  get: (id, options) => api.get(`/categories/${id}`, options),
  create: (payload) => api.post('/categories', payload),
  update: (id, payload) => api.put(`/categories/${id}`, payload),
  changeStatus: (id, status) => api.patch(`/categories/${id}/status`, { status }),
  reorder: (departmentId, ids) => api.put('/categories/order', { departmentId, ids }),
};

export const ticketTypesService = {
  list: (params, options) => api.get('/ticket-types', { ...options, params }),
  get: (id, options) => api.get(`/ticket-types/${id}`, options),
  create: (payload) => api.post('/ticket-types', payload),
  update: (id, payload) => api.put(`/ticket-types/${id}`, payload),
  changeStatus: (id, status) => api.patch(`/ticket-types/${id}/status`, { status }),
  reorder: (departmentId, ids) => api.put('/ticket-types/order', { departmentId, ids }),
  assigneeOptions: (departmentId, options) => api.get('/ticket-types/assignee-options', { ...options, params: { departmentId } }),
};

export const formsService = {
  get: (ticketTypeId, options) => api.get(`/ticket-types/${ticketTypeId}/form`, options),
  save: (ticketTypeId, fields) => api.put(`/ticket-types/${ticketTypeId}/form`, { fields }),
  validate: (ticketTypeId, payload) => api.post(`/ticket-types/${ticketTypeId}/form/validate`, payload),
};

/** Catálogo de solicitudes y opciones dinámicas (campos Usuario / Departamento). */
export const requestCatalogService = {
  catalog: (options) => api.get('/request-catalog', options),
  users: (options) => api.get('/request-catalog/lookups/users', options),
  departments: (options) => api.get('/request-catalog/lookups/departments', options),
};
