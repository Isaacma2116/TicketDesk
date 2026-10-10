import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '../layouts/AppLayout';
import { PageLoader } from '../components/ui';
import { DEPARTMENTS_ACCESS, PERMISSIONS } from '../utils/permissions';
import { FORCED_PASSWORD_ROUTE, ProtectedRoute, PublicOnlyRoute, RequirePermission } from './guards';
import { NotFoundPage } from '../pages/errors/ErrorPages';
import LoginPage from '../pages/auth/LoginPage';

// Las páginas privadas se cargan bajo demanda para aligerar el login.
const ForgotPasswordPage = lazy(() => import('../pages/auth/ForgotPasswordPage'));
const DashboardPage = lazy(() => import('../pages/dashboard/DashboardPage'));
const UsersListPage = lazy(() => import('../pages/users/UsersListPage'));
const UserDetailPage = lazy(() => import('../pages/users/UserDetailPage'));
const UserCreatePage = lazy(() => import('../pages/users/UserFormPages').then((m) => ({ default: m.UserCreatePage })));
const UserEditPage = lazy(() => import('../pages/users/UserFormPages').then((m) => ({ default: m.UserEditPage })));
const DepartmentsListPage = lazy(() => import('../pages/departments/DepartmentsListPage'));
const DepartmentDetailPage = lazy(() => import('../pages/departments/DepartmentDetailPage'));
const DepartmentCreatePage = lazy(() =>
  import('../pages/departments/DepartmentFormPages').then((m) => ({ default: m.DepartmentCreatePage })),
);
const DepartmentEditPage = lazy(() =>
  import('../pages/departments/DepartmentFormPages').then((m) => ({ default: m.DepartmentEditPage })),
);
const CompanySettingsPage = lazy(() => import('../pages/settings/CompanySettingsPage'));
const ProfilePage = lazy(() => import('../pages/account/ProfilePage'));
const CategoriesPage = lazy(() => import('../pages/config/CategoriesPage'));
const TicketTypesListPage = lazy(() => import('../pages/config/TicketTypesListPage'));
const TicketTypeDetailPage = lazy(() => import('../pages/config/TicketTypeDetailPage'));
const TicketTypeCreatePage = lazy(() => import('../pages/config/TicketTypeFormPages').then((m) => ({ default: m.TicketTypeCreatePage })));
const TicketTypeEditPage = lazy(() => import('../pages/config/TicketTypeFormPages').then((m) => ({ default: m.TicketTypeEditPage })));
const FormsListPage = lazy(() => import('../pages/config/FormsListPage'));
const FormBuilderPage = lazy(() => import('../pages/config/FormBuilderPage'));
const ForcedChangePasswordPage = lazy(() =>
  import('../pages/auth/ChangePasswordPages').then((m) => ({ default: m.ForcedChangePasswordPage })),
);
const AccountPasswordPage = lazy(() =>
  import('../pages/auth/ChangePasswordPages').then((m) => ({ default: m.AccountPasswordPage })),
);

export function AppRouter() {
  return (
    <Suspense fallback={<PageLoader full />}>
      <Routes>
        {/* Públicas */}
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/olvide-contrasena" element={<ForgotPasswordPage />} />
        </Route>

        {/* Privadas */}
        <Route element={<ProtectedRoute />}>
          <Route path={FORCED_PASSWORD_ROUTE} element={<ForcedChangePasswordPage />} />

          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <RequirePermission permission={PERMISSIONS.DASHBOARD_VIEW}>
                  <DashboardPage />
                </RequirePermission>
              }
            />
            <Route path="/cuenta/contrasena" element={<AccountPasswordPage />} />
            <Route path="/perfil" element={<ProfilePage />} />

            <Route path="/usuarios" element={<RequirePermission permission={PERMISSIONS.USERS_VIEW} />}>
              <Route index element={<UsersListPage />} />
              <Route
                path="nuevo"
                element={
                  <RequirePermission permission={PERMISSIONS.USERS_CREATE}>
                    <UserCreatePage />
                  </RequirePermission>
                }
              />
              <Route path=":id" element={<UserDetailPage />} />
              <Route
                path=":id/editar"
                element={
                  <RequirePermission permission={PERMISSIONS.USERS_UPDATE}>
                    <UserEditPage />
                  </RequirePermission>
                }
              />
            </Route>

            <Route path="/departamentos" element={<RequirePermission anyOf={DEPARTMENTS_ACCESS} />}>
              <Route index element={<DepartmentsListPage />} />
              <Route
                path="nuevo"
                element={
                  <RequirePermission permission={PERMISSIONS.DEPARTMENTS_CREATE}>
                    <DepartmentCreatePage />
                  </RequirePermission>
                }
              />
              <Route path=":id" element={<DepartmentDetailPage />} />
              <Route
                path=":id/editar"
                element={
                  <RequirePermission permission={PERMISSIONS.DEPARTMENTS_UPDATE}>
                    <DepartmentEditPage />
                  </RequirePermission>
                }
              />
            </Route>

            <Route
              path="/configuracion/empresa"
              element={
                <RequirePermission permission={PERMISSIONS.COMPANY_VIEW}>
                  <CompanySettingsPage />
                </RequirePermission>
              }
            />

            {/* Etapa 3: catálogo de solicitudes y formularios */}
            <Route
              path="/configuracion/categorias"
              element={
                <RequirePermission permission={PERMISSIONS.CATEGORIES_VIEW}>
                  <CategoriesPage />
                </RequirePermission>
              }
            />
            <Route path="/configuracion/tipos-solicitud" element={<RequirePermission permission={PERMISSIONS.TICKET_TYPES_VIEW} />}>
              <Route index element={<TicketTypesListPage />} />
              <Route
                path="nuevo"
                element={
                  <RequirePermission permission={PERMISSIONS.TICKET_TYPES_CREATE}>
                    <TicketTypeCreatePage />
                  </RequirePermission>
                }
              />
              <Route path=":id" element={<TicketTypeDetailPage />} />
              <Route
                path=":id/editar"
                element={
                  <RequirePermission permission={PERMISSIONS.TICKET_TYPES_UPDATE}>
                    <TicketTypeEditPage />
                  </RequirePermission>
                }
              />
            </Route>
            <Route path="/configuracion/formularios" element={<RequirePermission permission={PERMISSIONS.FORMS_VIEW} />}>
              <Route index element={<FormsListPage />} />
              <Route path=":id" element={<FormBuilderPage />} />
            </Route>

            {/* Próximas etapas: /tickets, /reportes, /auditoria */}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
