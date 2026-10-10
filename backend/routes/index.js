import { Router } from 'express';
import { PERMISSIONS } from '../config/rbac.js';
import { pool } from '../config/database.js';
import { DashboardController, RolesController } from '../controllers/misc.controller.js';
import { authenticate, authorize, requirePasswordChanged } from '../middleware/auth.js';
import authRoutes from './auth.routes.js';
import usersRoutes from './users.routes.js';
import departmentsRoutes from './departments.routes.js';
import companyRoutes from './company.routes.js';
import {
  categoriesRouter,
  fieldOptionsRouter,
  formFieldsRouter,
  requestCatalogRouter,
  ticketTypesRouter,
} from './catalog.routes.js';

const router = Router();

router.get('/health', async (_req, res) => {
  await pool.query('SELECT 1');
  res.json({ status: 'ok' });
});

router.use('/auth', authRoutes);

// A partir de aquí todo requiere sesión válida y contraseña definitiva.
const secured = Router();
secured.use(authenticate, requirePasswordChanged);

secured.get('/dashboard/summary', authorize(PERMISSIONS.DASHBOARD_VIEW), DashboardController.summary);
secured.get('/roles', authorize(PERMISSIONS.ROLES_VIEW), RolesController.list);
secured.use('/users', usersRoutes);
secured.use('/departments', departmentsRoutes);
secured.use('/company', companyRoutes);
// Etapa 3: catálogo de solicitudes y formularios dinámicos
secured.use('/categories', categoriesRouter);
secured.use('/ticket-types', ticketTypesRouter);
secured.use('/form-fields', formFieldsRouter);
secured.use('/field-options', fieldOptionsRouter);
secured.use('/request-catalog', requestCatalogRouter);
// Etapa 4: secured.use('/tickets', ticketsRoutes);

router.use(secured);

export default router;
