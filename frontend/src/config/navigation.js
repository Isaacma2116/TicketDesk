import {
  BarChart3,
  Building,
  Building2,
  FormInput,
  GitBranch,
  LayoutDashboard,
  ShieldCheck,
  Shapes,
  Tags,
  Ticket,
  Users,
} from 'lucide-react';
import { DEPARTMENTS_ACCESS, PERMISSIONS } from '../utils/permissions';

/**
 * Definición del menú lateral.
 *  - `permission`: el elemento solo se muestra si el usuario tiene ese permiso.
 *  - `anyOf`: se muestra si tiene AL MENOS UNO de esos permisos.
 *  - `comingSoon`: módulo planificado; se muestra deshabilitado.
 * Las secciones sin elementos visibles no se muestran.
 */
export const NAVIGATION = [
  {
    title: 'General',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, permission: PERMISSIONS.DASHBOARD_VIEW }],
  },
  {
    title: 'Gestión',
    items: [
      { label: 'Usuarios', to: '/usuarios', icon: Users, permission: PERMISSIONS.USERS_VIEW },
      { label: 'Departamentos', to: '/departamentos', icon: Building2, anyOf: DEPARTMENTS_ACCESS },
    ],
  },
  {
    title: 'Configuración',
    items: [
      { label: 'Empresa', to: '/configuracion/empresa', icon: Building, permission: PERMISSIONS.COMPANY_VIEW },
      { label: 'Categorías', to: '/configuracion/categorias', icon: Tags, permission: PERMISSIONS.CATEGORIES_VIEW },
      { label: 'Tipos de solicitud', to: '/configuracion/tipos-solicitud', icon: Shapes, permission: PERMISSIONS.TICKET_TYPES_VIEW },
      { label: 'Formularios', to: '/configuracion/formularios', icon: FormInput, permission: PERMISSIONS.FORMS_VIEW },
    ],
  },
  {
    title: 'Próximamente',
    items: [
      { label: 'Tickets', icon: Ticket, comingSoon: true },
      { label: 'Flujos', icon: GitBranch, comingSoon: true },
      { label: 'Reportes', icon: BarChart3, comingSoon: true },
      { label: 'Auditoría', icon: ShieldCheck, comingSoon: true },
    ],
  },
];

/** Títulos para la barra superior según la ruta. */
export const ROUTE_TITLES = [
  { match: /^\/dashboard/, section: 'General', title: 'Dashboard' },
  { match: /^\/usuarios\/nuevo/, section: 'Usuarios', title: 'Nuevo usuario' },
  { match: /^\/usuarios\/\d+\/editar/, section: 'Usuarios', title: 'Editar usuario' },
  { match: /^\/usuarios\/\d+/, section: 'Usuarios', title: 'Detalle de usuario' },
  { match: /^\/usuarios/, section: 'Gestión', title: 'Usuarios' },
  { match: /^\/departamentos\/nuevo/, section: 'Departamentos', title: 'Nuevo departamento' },
  { match: /^\/departamentos\/\d+\/editar/, section: 'Departamentos', title: 'Editar departamento' },
  { match: /^\/departamentos\/\d+/, section: 'Departamentos', title: 'Detalle de departamento' },
  { match: /^\/departamentos/, section: 'Gestión', title: 'Departamentos' },
  { match: /^\/configuracion\/empresa/, section: 'Configuración', title: 'Empresa' },
  { match: /^\/configuracion\/categorias/, section: 'Configuración', title: 'Categorías' },
  { match: /^\/configuracion\/tipos-solicitud\/nuevo/, section: 'Tipos de solicitud', title: 'Nuevo tipo' },
  { match: /^\/configuracion\/tipos-solicitud\/\d+\/editar/, section: 'Tipos de solicitud', title: 'Editar tipo' },
  { match: /^\/configuracion\/tipos-solicitud\/\d+/, section: 'Tipos de solicitud', title: 'Detalle' },
  { match: /^\/configuracion\/tipos-solicitud/, section: 'Configuración', title: 'Tipos de solicitud' },
  { match: /^\/configuracion\/formularios\/\d+/, section: 'Formularios', title: 'Constructor de formulario' },
  { match: /^\/configuracion\/formularios/, section: 'Configuración', title: 'Formularios' },
  { match: /^\/perfil/, section: 'Mi cuenta', title: 'Mi perfil' },
  { match: /^\/cuenta\/contrasena/, section: 'Mi cuenta', title: 'Cambiar contraseña' },
];
