// Debe mantenerse alineado con backend/config/rbac.js.
// El frontend solo usa los permisos para mostrar u ocultar opciones; la
// autorización real siempre la aplica el backend.
export const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard.view',
  USERS_VIEW: 'users.view',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_CHANGE_STATUS: 'users.change_status',
  USERS_DELETE: 'users.delete',
  ROLES_VIEW: 'roles.view',
  COMPANY_VIEW: 'company.view',
  COMPANY_UPDATE: 'company.update',
  DEPARTMENTS_VIEW: 'departments.view',
  DEPARTMENTS_VIEW_OWN: 'departments.view_own',
  DEPARTMENTS_MEMBERS_VIEW: 'departments.members_view',
  DEPARTMENTS_CREATE: 'departments.create',
  DEPARTMENTS_UPDATE: 'departments.update',
  DEPARTMENTS_CHANGE_STATUS: 'departments.change_status',
  DEPARTMENTS_DELETE: 'departments.delete',
  CATEGORIES_VIEW: 'categories.view',
  CATEGORIES_CREATE: 'categories.create',
  CATEGORIES_UPDATE: 'categories.update',
  CATEGORIES_CHANGE_STATUS: 'categories.change_status',
  TICKET_TYPES_VIEW: 'ticket_types.view',
  TICKET_TYPES_CREATE: 'ticket_types.create',
  TICKET_TYPES_UPDATE: 'ticket_types.update',
  TICKET_TYPES_CHANGE_STATUS: 'ticket_types.change_status',
  FORMS_VIEW: 'forms.view',
  FORMS_UPDATE: 'forms.update',
  REQUEST_CATALOG_VIEW: 'request_catalog.view',
});

/** Cualquiera de estos permite entrar al módulo Departamentos. */
export const DEPARTMENTS_ACCESS = [PERMISSIONS.DEPARTMENTS_VIEW, PERMISSIONS.DEPARTMENTS_VIEW_OWN];
