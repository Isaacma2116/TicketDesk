import { Router } from 'express';
import { PERMISSIONS } from '../config/rbac.js';
import { UsersController } from '../controllers/users.controller.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  changeStatusSchema,
  createUserSchema,
  listUsersQuery,
  updateUserSchema,
} from '../validators/user.validators.js';

// Se monta detrás de authenticate + requirePasswordChanged (ver routes/index.js).
const router = Router();

router.get('/', authorize(PERMISSIONS.USERS_VIEW), validate(listUsersQuery, 'query'), UsersController.list);
router.get('/:id', authorize(PERMISSIONS.USERS_VIEW), validate(idParam, 'params'), UsersController.get);
router.post('/', authorize(PERMISSIONS.USERS_CREATE), validate(createUserSchema), UsersController.create);
router.put(
  '/:id',
  authorize(PERMISSIONS.USERS_UPDATE),
  validate(idParam, 'params'),
  validate(updateUserSchema),
  UsersController.update,
);
router.patch(
  '/:id/status',
  authorize(PERMISSIONS.USERS_CHANGE_STATUS),
  validate(idParam, 'params'),
  validate(changeStatusSchema),
  UsersController.changeStatus,
);
router.delete('/:id', authorize(PERMISSIONS.USERS_DELETE), validate(idParam, 'params'), UsersController.remove);

export default router;
