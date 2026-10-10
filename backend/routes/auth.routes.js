import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { loginAccountLimiter, loginIpLimiter } from '../middleware/security.js';
import { validate } from '../middleware/validate.js';
import { changePasswordSchema, loginSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/login', loginIpLimiter, loginAccountLimiter, validate(loginSchema), AuthController.login);
router.post('/logout', AuthController.logout);
router.get('/me', authenticate, AuthController.me);
router.post('/change-password', authenticate, validate(changePasswordSchema), AuthController.changePassword);

export default router;
