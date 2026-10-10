/**
 * Catálogo de roles y permisos (RBAC).
 *
 * Es la fuente de verdad que usa el seed para poblar las tablas `roles`,
 * `permissions` y `role_permissions`. Para añadir un módulo en futuras etapas
 * (tickets, categorías, reportes...) basta con declarar sus permisos aquí,
 * asignarlos a los roles y volver a ejecutar `npm run db:seed`.
 */

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

const P = PERMISSIONS;

export const PERMISSION_DEFINITIONS = [
  { code: P.DASHBOARD_VIEW, module: 'dashboard', name: 'Ver dashboard', description: 'Acceso al panel principal' },
  { code: P.USERS_VIEW, module: 'users', name: 'Ver usuarios', description: 'Consultar el listado y detalle de usuarios' },
  { code: P.USERS_CREATE, module: 'users', name: 'Crear usuarios', description: 'Dar de alta nuevos usuarios' },
  { code: P.USERS_UPDATE, module: 'users', name: 'Editar usuarios', description: 'Modificar datos, rol y departamento de usuarios' },
  { code: P.USERS_CHANGE_STATUS, module: 'users', name: 'Activar/desactivar usuarios', description: 'Cambiar el estado de acceso de un usuario' },
  { code: P.USERS_DELETE, module: 'users', name: 'Eliminar usuarios', description: 'Eliminar (borrado lógico) usuarios' },
  { code: P.ROLES_VIEW, module: 'roles', name: 'Ver roles', description: 'Consultar roles disponibles' },
  { code: P.COMPANY_VIEW, module: 'company', name: 'Ver empresa', description: 'Consultar los datos de la empresa' },
  { code: P.COMPANY_UPDATE, module: 'company', name: 'Editar empresa', description: 'Modificar los datos y el logo de la empresa' },
  { code: P.DEPARTMENTS_VIEW, module: 'departments', name: 'Ver departamentos', description: 'Consultar todos los departamentos de la empresa' },
  { code: P.DEPARTMENTS_VIEW_OWN, module: 'departments', name: 'Ver mi departamento', description: 'Consultar los departamentos a los que pertenece' },
  { code: P.DEPARTMENTS_MEMBERS_VIEW, module: 'departments', name: 'Ver miembros de departamento', description: 'Consultar los usuarios de los departamentos visibles' },
  { code: P.DEPARTMENTS_CREATE, module: 'departments', name: 'Crear departamentos', description: 'Dar de alta departamentos' },
  { code: P.DEPARTMENTS_UPDATE, module: 'departments', name: 'Editar departamentos', description: 'Modificar datos y responsable de departamentos' },
  { code: P.DEPARTMENTS_CHANGE_STATUS, module: 'departments', name: 'Activar/desactivar departamentos', description: 'Cambiar el estado de un departamento' },
  { code: P.DEPARTMENTS_DELETE, module: 'departments', name: 'Eliminar departamentos', description: 'Eliminar departamentos vacíos (sin usuarios ni datos)' },
  // Etapa 3. Sin departments.view, estos permisos se limitan a los departamentos de los que el usuario es responsable.
  { code: P.CATEGORIES_VIEW, module: 'categories', name: 'Ver categorías', description: 'Consultar categorías de solicitudes' },
  { code: P.CATEGORIES_CREATE, module: 'categories', name: 'Crear categorías', description: 'Dar de alta categorías' },
  { code: P.CATEGORIES_UPDATE, module: 'categories', name: 'Editar categorías', description: 'Modificar y ordenar categorías' },
  { code: P.CATEGORIES_CHANGE_STATUS, module: 'categories', name: 'Activar/desactivar categorías', description: 'Cambiar el estado de una categoría' },
  { code: P.TICKET_TYPES_VIEW, module: 'ticket_types', name: 'Ver tipos de solicitud', description: 'Consultar tipos de solicitud' },
  { code: P.TICKET_TYPES_CREATE, module: 'ticket_types', name: 'Crear tipos de solicitud', description: 'Dar de alta tipos de solicitud' },
  { code: P.TICKET_TYPES_UPDATE, module: 'ticket_types', name: 'Editar tipos de solicitud', description: 'Modificar y ordenar tipos de solicitud' },
  { code: P.TICKET_TYPES_CHANGE_STATUS, module: 'ticket_types', name: 'Activar/desactivar tipos', description: 'Cambiar el estado de un tipo de solicitud' },
  { code: P.FORMS_VIEW, module: 'forms', name: 'Ver formularios', description: 'Consultar formularios dinámicos' },
  { code: P.FORMS_UPDATE, module: 'forms', name: 'Diseñar formularios', description: 'Crear, editar y ordenar campos de formularios' },
  { code: P.REQUEST_CATALOG_VIEW, module: 'requests', name: 'Ver catálogo de solicitudes', description: 'Consultar tipos de solicitud disponibles y sus formularios' },
];

/** Permisos de configuración del catálogo (gestión completa). */
const CATALOG_MANAGEMENT = [
  P.CATEGORIES_VIEW,
  P.CATEGORIES_CREATE,
  P.CATEGORIES_UPDATE,
  P.CATEGORIES_CHANGE_STATUS,
  P.TICKET_TYPES_VIEW,
  P.TICKET_TYPES_CREATE,
  P.TICKET_TYPES_UPDATE,
  P.TICKET_TYPES_CHANGE_STATUS,
  P.FORMS_VIEW,
  P.FORMS_UPDATE,
];

export const ROLES = Object.freeze({
  SUPERADMIN: 'superadmin',
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  AGENT: 'agent',
  USER: 'user',
});

const ALL = PERMISSION_DEFINITIONS.map((p) => p.code);

export const ROLE_DEFINITIONS = [
  {
    code: ROLES.SUPERADMIN,
    name: 'Superadministrador',
    description: 'Control total de la plataforma',
    level: 100,
    permissions: ALL,
  },
  {
    code: ROLES.ADMIN,
    name: 'Administrador',
    description: 'Administra usuarios y departamentos de la organización',
    level: 80,
    permissions: [
      P.DASHBOARD_VIEW,
      P.USERS_VIEW,
      P.USERS_CREATE,
      P.USERS_UPDATE,
      P.USERS_CHANGE_STATUS,
      P.ROLES_VIEW,
      P.COMPANY_VIEW,
      P.DEPARTMENTS_VIEW,
      P.DEPARTMENTS_VIEW_OWN,
      P.DEPARTMENTS_MEMBERS_VIEW,
      P.DEPARTMENTS_CREATE,
      P.DEPARTMENTS_UPDATE,
      P.DEPARTMENTS_CHANGE_STATUS,
      ...CATALOG_MANAGEMENT,
      P.REQUEST_CATALOG_VIEW,
    ],
  },
  {
    code: ROLES.SUPERVISOR,
    name: 'Supervisor',
    description: 'Consulta su departamento; configura el catálogo de los departamentos de los que es responsable',
    level: 60,
    // El catálogo queda limitado a los departamentos donde es responsable (no tiene departments.view).
    permissions: [P.DASHBOARD_VIEW, P.DEPARTMENTS_VIEW_OWN, P.DEPARTMENTS_MEMBERS_VIEW, ...CATALOG_MANAGEMENT, P.REQUEST_CATALOG_VIEW],
  },
  {
    code: ROLES.AGENT,
    name: 'Agente',
    description: 'Atiende solicitudes de su departamento (tickets en próximas etapas)',
    level: 40,
    permissions: [P.DASHBOARD_VIEW, P.DEPARTMENTS_VIEW_OWN, P.REQUEST_CATALOG_VIEW],
  },
  {
    code: ROLES.USER,
    name: 'Usuario',
    description: 'Solicitante de servicios',
    level: 20,
    permissions: [P.DASHBOARD_VIEW, P.DEPARTMENTS_VIEW_OWN, P.REQUEST_CATALOG_VIEW],
  },
];
