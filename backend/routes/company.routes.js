import { Router } from 'express';
import multer from 'multer';
import { env } from '../config/env.js';
import { PERMISSIONS as P } from '../config/rbac.js';
import { CompanyController } from '../controllers/company.controller.js';
import { authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../utils/AppError.js';
import { updateCompanySchema } from '../validators/company.validators.js';

const router = Router();

// El archivo se recibe en memoria (máx. LOGO_MAX_BYTES) y se valida por su
// firma binaria antes de escribirlo en disco con un nombre aleatorio.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.uploads.logoMaxBytes, files: 1, fields: 0, parts: 2 },
});

function singleLogo(req, res, next) {
  upload.single('logo')(req, res, (err) => {
    if (!err) return next();
    if (err.code === 'LIMIT_FILE_SIZE') {
      const mb = (env.uploads.logoMaxBytes / 1024 / 1024).toFixed(0);
      return next(AppError.badRequest(`La imagen supera el tamaño máximo de ${mb} MB`, { logo: `Máximo ${mb} MB` }));
    }
    next(AppError.badRequest('No se pudo procesar el archivo enviado', { logo: 'Archivo no válido' }));
  });
}

// La empresa siempre es la del usuario autenticado: no hay :id en la ruta.
router.get('/', authorize(P.COMPANY_VIEW), CompanyController.get);
router.put('/', authorize(P.COMPANY_UPDATE), validate(updateCompanySchema), CompanyController.update);
// Cualquier usuario autenticado puede ver el logo de SU empresa (cabecera, login…).
router.get('/logo', CompanyController.logo);
router.post('/logo', authorize(P.COMPANY_UPDATE), singleLogo, CompanyController.uploadLogo);
router.delete('/logo', authorize(P.COMPANY_UPDATE), CompanyController.removeLogo);

export default router;
