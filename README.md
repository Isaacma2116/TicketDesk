# TicketDesk — Plataforma de gestión de tickets

- **Etapa 1:** autenticación, usuarios, roles (RBAC), dashboard y navegación.
- **Etapa 2:** empresa (multiempresa), departamentos, pertenencia de usuarios, responsables, logo y auditoría.
- **Etapa 3:** catálogo de solicitudes (categorías y tipos por departamento) y constructor de formularios dinámicos.

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite + JavaScript, CSS propio (`frontend/`) |
| Backend | Node.js + Express 5 (`backend/`) |
| Base de datos | MySQL 8 (`backend/database/migrations/`) |

## Puesta en marcha

Requisitos: Node.js 20+ y MySQL 8 en ejecución.

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env              # completa DB_*, SESSION_SECRET y SUPERADMIN_*
npm run db:setup                  # crea la BD, aplica migraciones y sincroniza roles/permisos
npm run create-superadmin         # crea el PRIMER superadministrador (solo una vez)
npm run dev                       # API en http://localhost:4000/api

# 2. Frontend (otra terminal)
cd frontend
npm install
cp .env.example .env
npm run dev                       # App en http://localhost:5173
```

Inicia sesión con `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD`. El sistema obligará a cambiar
esa contraseña en el primer acceso. Después puedes borrar `SUPERADMIN_PASSWORD` del `.env`.

## Scripts

| Comando (en `backend/`) | Qué hace |
|---|---|
| `npm run dev` | API con recarga automática |
| `npm run db:migrate` | Aplica migraciones pendientes (`database/migrations/*.sql`) |
| `npm run db:seed` | Sincroniza roles y permisos con `config/rbac.js` (idempotente) |
| `npm run create-superadmin` | Crea el primer superadmin; no hace nada si ya existe uno activo |
| `npm test` | Pruebas de integración contra la BD `tickets_per_test` (se recrea en cada ejecución) |

## Seguridad: decisiones principales

- **Sesiones en servidor + cookie HttpOnly** (no JWT en el navegador). La cookie contiene un token
  aleatorio de 256 bits; en BD solo se guarda su HMAC‑SHA256. Permite cerrar sesión de verdad,
  revocar sesiones al desactivar un usuario, cambiar su rol o su contraseña, y el JavaScript del
  frontend nunca puede leer el token (mitiga robo por XSS).
- Cookie `SameSite=Strict`, `Secure` + prefijo `__Host-` en producción, y verificación de `Origin`
  en peticiones de escritura (defensa CSRF).
- Expiración: 8 h (cookie de sesión del navegador) o 30 días con **Recordarme**; cierre por
  inactividad a las 2 h en sesiones normales.
- Contraseñas con **bcrypt** (coste 12) y política mínima (8+ caracteres, mayúscula, minúscula, número).
- Protección contra fuerza bruta: límite por IP, límite por IP+correo y **bloqueo de cuenta** de 15 min
  tras 5 fallos. Mensajes genéricos para no revelar qué correos existen.
- Validación con **zod** en todos los endpoints (campos desconocidos rechazados), `helmet`, límite de
  tamaño de cuerpo, consultas parametrizadas y errores internos nunca expuestos al cliente.
- Contraseñas temporales: toda contraseña asignada por un administrador obliga a cambiarla en el
  siguiente acceso.

## Multiempresa

- Cada usuario pertenece a una empresa (`users.company_id`) y cada departamento también.
- El `companyId` sale **siempre de la sesión**, nunca de la petición: todas las consultas se acotan
  a la empresa del usuario. Un id de otra empresa responde **404** (como si no existiera).
- La base de datos lo refuerza con **claves foráneas compuestas** `(id, company_id)`: es imposible
  asignar como responsable o integrante a un usuario de otra empresa, aunque fallara la aplicación.
- El código de departamento es único **por empresa** (`UNIQUE(company_id, code)`).
- La empresa inicial se crea en la migración 002 como "Mi Empresa" (se edita en Configuración → Empresa).
- Si una empresa se desactiva, solo sus superadministradores pueden iniciar sesión.

## Departamentos y pertenencia (`user_departments`)

Tabla intermedia N:M desde ahora, con un **departamento principal** por usuario (garantizado por un
índice único) y membresías secundarias. Hoy la interfaz gestiona el principal; más adelante podrá
asignarse más de uno sin migrar datos.

- `is_agent`: prepara la relación de agentes para la Etapa 3. Se marca automáticamente para usuarios
  con rol Agente (y se actualiza si cambia el rol).
- **Responsable** (`departments.manager_id`): usuario activo de la misma empresa. Al asignarlo pasa a
  ser integrante (principal si no tenía departamento, secundario si ya tenía uno). Mientras sea
  responsable no puede salir de su departamento principal.
- **Desactivar** un departamento conserva usuarios e historial, pero deja de ofrecerse para nuevas
  asignaciones. La **eliminación física** solo es posible sin integrantes y la hace el superadmin.

## Logo de la empresa

Se guarda en disco (`backend/uploads/company-logos/`, configurable con `UPLOAD_DIR`) con un nombre
aleatorio; en BD solo se guarda la ruta relativa. Solo PNG, JPG y WEBP de hasta 2 MB, validados por su
**firma binaria** (no por la extensión). SVG queda excluido porque puede contener JavaScript. El logo
se sirve por `GET /api/company/logo` (solo para usuarios de esa empresa) con `nosniff` y CSP `sandbox`.

## Auditoría

La tabla `audit_logs` registra quién, qué, cuándo, desde qué IP y los cambios (`{ campo: { from, to } }`):
empresa modificada, logo, departamento creado/modificado/activado/desactivado/eliminado, responsable
cambiado, usuarios creados/modificados/desactivados/eliminados y usuario asignado a departamento.
La pantalla de consulta llegará en una etapa posterior.

## Catálogo de solicitudes y formularios dinámicos (Etapa 3)

```
Empresa → Departamento → Categoría → Tipo de solicitud → Formulario (campos) → [Ticket, Etapa 4]
```

- **Categorías** (`categories`): por departamento, ordenables, activas/inactivas. Nombre único por departamento.
- **Tipos de solicitud** (`ticket_types`): nombre, código (único por departamento), descripción, categoría
  del mismo departamento, prioridad predeterminada (baja/media/alta/urgente), responsable (grupo de agentes
  del departamento o un integrante concreto), orden y estado. El departamento no se cambia tras crearlo.
- **Formularios** (`form_fields` + `form_field_options`): 18 tipos de campo (texto corto/largo, número,
  moneda, fecha, hora, fecha y hora, correo, teléfono, lista, selección múltiple, sí/no, archivo, imagen,
  usuario, departamento, equipo, ubicación). Cada campo tiene etiqueta, nombre interno, ayuda, ejemplo,
  obligatorio, valor predeterminado, orden, visibilidad para solicitante/agente, estado, opciones y reglas
  (longitud mín./máx., mínimo/máximo, decimales, moneda, nº de opciones, nº/tamaño/formatos de archivo y
  **mostrar si** otro campo anterior cumple una condición).
- **Una sola validación**: `backend/services/formValidation.js` valida la definición al guardar (incluido
  el valor predeterminado) y los valores enviados. La vista previa del constructor ya la usa
  (`POST /api/ticket-types/:id/form/validate`) y la Etapa 4 la usará para crear tickets.
- **Versionado**: cada guardado incrementa `ticket_types.form_version`. Los tickets guardarán la versión y
  una copia del formulario, así que editarlo no altera solicitudes históricas.
- **Equipo y Ubicación** usan por ahora la lista de opciones del campo; podrán conectarse a catálogos.
- **Alcance**: con `departments.view` (administradores) se configura cualquier departamento de la empresa;
  sin él (supervisores), solo los departamentos de los que el usuario es responsable.

## Roles y permisos (RBAC)

| Rol | Nivel | Permisos en esta etapa |
|---|---|---|
| Superadministrador | 100 | Todos (incluye editar empresa y eliminar usuarios/departamentos) |
| Administrador | 80 | Usuarios (sin eliminar), ver empresa, gestionar departamentos (sin eliminar) |
| Supervisor | 60 | Dashboard, ver su departamento y a sus integrantes |
| Agente | 40 | Dashboard, información básica de su departamento |
| Usuario | 20 | Dashboard, información básica de su departamento |

Permisos de la Etapa 3: `categories.view|create|update|change_status`,
`ticket_types.view|create|update|change_status`, `forms.view`, `forms.update` (administrador: todo;
supervisor: solo departamentos que dirige) y `request_catalog.view` (todos los roles).

Permisos de la Etapa 2: `company.view`, `company.update`, `departments.view` (todos),
`departments.view_own` (los propios), `departments.members_view`, `departments.create`,
`departments.update`, `departments.change_status`, `departments.delete`.

Reglas de jerarquía: solo se gestionan usuarios con un rol de nivel inferior (el superadmin gestiona
a todos), nadie puede cambiarse el rol, desactivarse ni eliminarse a sí mismo, y siempre queda al
menos un superadmin activo. La eliminación es lógica (`deleted_at`).

Para añadir permisos en próximas etapas: decláralos en `backend/config/rbac.js`, asígnalos a los roles,
ejecuta `npm run db:seed` y añade la constante en `frontend/src/utils/permissions.js`.

## API

| Método | Ruta | Permiso |
|---|---|---|
| POST | `/api/auth/login` | público (con límite de intentos) |
| POST | `/api/auth/logout` | — |
| GET | `/api/auth/me` | sesión |
| POST | `/api/auth/change-password` | sesión |
| GET | `/api/dashboard/summary` | `dashboard.view` |
| GET | `/api/roles` | `roles.view` |
| GET | `/api/users?search=&roleId=&departmentId=&status=&page=&pageSize=&sortBy=&sortDir=` | `users.view` (`departmentId=none` = sin departamento) |
| GET | `/api/users/:id` | `users.view` |
| POST | `/api/users` | `users.create` |
| PUT | `/api/users/:id` | `users.update` (`resetPassword: true` genera una contraseña temporal) |
| PATCH | `/api/users/:id/status` | `users.change_status` |
| DELETE | `/api/users/:id` | `users.delete` |
| GET | `/api/company` | `company.view` |
| PUT | `/api/company` | `company.update` |
| GET | `/api/company/logo` | sesión (logo de su empresa) |
| POST / DELETE | `/api/company/logo` | `company.update` (multipart, campo `logo`) |
| GET | `/api/departments?search=&status=&page=&sortBy=&sortDir=` | `departments.view` o `departments.view_own` |
| GET | `/api/departments/options` | `departments.view` o `users.view` (selectores) |
| GET | `/api/departments/manager-options` | `departments.create` o `departments.update` |
| GET | `/api/departments/:id` | ver todos, o pertenecer al departamento |
| GET | `/api/departments/:id/users` | `departments.members_view` + visibilidad |
| POST | `/api/departments` | `departments.create` |
| PUT | `/api/departments/:id` | `departments.update` (+ `change_status` si cambia el estado) |
| PATCH | `/api/departments/:id/status` | `departments.change_status` |
| DELETE | `/api/departments/:id` | `departments.delete` (solo si está vacío) |
| GET | `/api/categories?search=&departmentId=&status=` · `/api/categories/:id` | `categories.view` |
| GET | `/api/categories/departments` | departamentos configurables por el usuario |
| POST · PUT · PATCH | `/api/categories` · `/:id` · `/:id/status` | `categories.create` · `update` · `change_status` |
| PUT | `/api/categories/order` | `categories.update` (`{ departmentId, ids }`) |
| GET | `/api/ticket-types?search=&departmentId=&categoryId=&status=` · `/:id` | `ticket_types.view` |
| POST · PUT · PATCH | `/api/ticket-types` · `/:id` · `/:id/status` | `ticket_types.create` · `update` · `change_status` |
| PUT | `/api/ticket-types/order` | `ticket_types.update` |
| GET | `/api/ticket-types/assignee-options?departmentId=` | crear/editar tipos |
| GET · PUT | `/api/ticket-types/:id/form` | `forms.view` · `forms.update` (formulario completo, atómico) |
| POST | `/api/ticket-types/:id/form/validate` | `forms.view` (valida valores; admite borrador) |
| GET · POST | `/api/ticket-types/:id/fields` · PUT `/:id/fields/order` | `forms.view` · `forms.update` |
| PUT · PATCH · DELETE | `/api/form-fields/:fieldId` · `/status` | `forms.update` |
| GET · POST | `/api/form-fields/:fieldId/options` | `forms.view` · `forms.update` |
| PUT · DELETE | `/api/field-options/:optionId` | `forms.update` |
| GET | `/api/request-catalog` · `/types/:id/form` · `/lookups/users` · `/lookups/departments` | `request_catalog.view` |
| POST | `/api/request-catalog/types/:id/validate` | `request_catalog.view` |

## Estructura

```
backend/
  app.js, server.js
  config/        env, conexión MySQL, catálogo RBAC
  controllers/   capa HTTP
  routes/        definición de rutas y middlewares por ruta
  middleware/    autenticación, autorización, validación, seguridad, errores
  services/      lógica de negocio (auth, usuarios, departamentos, empresa, dashboard, auditoría)
  models/        acceso a datos (SQL)
  validators/    esquemas zod
  utils/         errores, contraseñas, tokens, serializadores
  database/      migraciones SQL, migrador, seed y backups/ (ignorado por git)
  uploads/       archivos subidos (ignorado por git)
  scripts/       create-superadmin
  tests/         pruebas de integración
frontend/src/
  components/    ui/ (botones, campos, modal…), layout/, users/, departments/, company/
  pages/         auth/, account/, dashboard/, users/, departments/, settings/, config/, errors/
  components/forms/  DynamicForm (renderizador reutilizable), FieldEditor, metadatos de tipos de campo
  layouts/       AppLayout (privado), AuthLayout (público)
  routes/        AppRouter y guards (ProtectedRoute, RequirePermission…)
  services/      cliente HTTP y servicios del API
  context/       Auth, Toasts, Confirmaciones
  hooks/  utils/  config/  styles/
```

## Producción (resumen)

`NODE_ENV=production`, `COOKIE_SECURE=true`, HTTPS obligatorio, `CORS_ORIGINS` con el dominio real,
`TRUST_PROXY=1` si hay un proxy inverso, y servir `frontend/dist` y `/api` bajo el mismo dominio.
