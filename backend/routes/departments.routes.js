import { Router } from 'express';
import { PERMISSIONS as P } from '../config/rbac.js';
import { DepartmentsController } from '../controllers/departments.controller.js';
import { authorize, authorizeAny } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  createDepartmentSchema,
  departmentOptionsQuery,
  departmentStatusSchema,
  listDepartmentsQuery,
  managerOptionsQuery,
  updateDepartmentSchema,
} from '../validators/department.validators.js';

// Se monta detrás de authenticate + requirePasswordChanged (ver routes/index.js).
// Además de estos permisos, el servicio comprueba empresa y visibilidad.
const router = Router();
const canView = authorizeAny(P.DEPARTMENTS_VIEW, P.DEPARTMENTS_VIEW_OWN);

router.get('/', canView, validate(listDepartmentsQuery, 'query'), DepartmentsController.list);
// Lista ligera para selectores (formulario y filtros de usuarios).
router.get(
  '/options',
  authorizeAny(P.DEPARTMENTS_VIEW, P.USERS_VIEW),
  validate(departmentOptionsQuery, 'query'),
  DepartmentsController.options,
);
router.get(
  '/manager-options',
  authorizeAny(P.DEPARTMENTS_CREATE, P.DEPARTMENTS_UPDATE),
  validate(managerOptionsQuery, 'query'),
  DepartmentsController.managerOptions,
);
router.get('/:id', canView, validate(idParam, 'params'), DepartmentsController.get);
router.get(
  '/:id/users',
  authorize(P.DEPARTMENTS_MEMBERS_VIEW),
  canView,
  validate(idParam, 'params'),
  DepartmentsController.members,
);
router.post('/', authorize(P.DEPARTMENTS_CREATE), validate(createDepartmentSchema), DepartmentsController.create);
router.put(
  '/:id',
  authorize(P.DEPARTMENTS_UPDATE),
  validate(idParam, 'params'),
  validate(updateDepartmentSchema),
  DepartmentsController.update,
);
router.patch(
  '/:id/status',
  authorize(P.DEPARTMENTS_CHANGE_STATUS),
  validate(idParam, 'params'),
  validate(departmentStatusSchema),
  DepartmentsController.changeStatus,
);
router.delete('/:id', authorize(P.DEPARTMENTS_DELETE), validate(idParam, 'params'), DepartmentsController.remove);

export default router;
