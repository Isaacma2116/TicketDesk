import { Router } from 'express';
import { z } from 'zod';
import { PERMISSIONS as P } from '../config/rbac.js';
import {
  CategoriesController,
  FormsController,
  RequestCatalogController,
  TicketTypesController,
} from '../controllers/catalog.controller.js';
import { authorize, authorizeAny } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  createCategorySchema,
  createTicketTypeSchema,
  fieldIdParam,
  fieldOrderSchema,
  fieldSchema,
  listCategoriesQuery,
  listTicketTypesQuery,
  optionIdParam,
  optionSchema,
  optionUpdateSchema,
  previewSubmissionSchema,
  reorderSchema,
  saveFormSchema,
  statusSchema,
  updateCategorySchema,
  updateFieldSchema,
  updateTicketTypeSchema,
} from '../validators/catalog.validators.js';

/*
 * Rutas de la Etapa 3. Se montan detrás de authenticate + requirePasswordChanged.
 * Además del permiso, cada servicio verifica la empresa (companyId de la sesión)
 * y el alcance por departamento (todos, o solo los que el usuario dirige).
 */
const params = validate(idParam, 'params');
const byDepartment = validate(z.object({ departmentId: z.coerce.number().int().positive('Departamento no válido') }), 'query');

/* ---------------------------- Categorías ---------------------------- */
export const categoriesRouter = Router();
categoriesRouter.get('/', authorize(P.CATEGORIES_VIEW), validate(listCategoriesQuery, 'query'), CategoriesController.list);
// Departamentos que el usuario puede configurar (todos o solo los que dirige).
categoriesRouter.get('/departments', authorizeAny(P.CATEGORIES_VIEW, P.TICKET_TYPES_VIEW, P.FORMS_VIEW), CategoriesController.scopeDepartments);
categoriesRouter.put('/order', authorize(P.CATEGORIES_UPDATE), validate(reorderSchema), CategoriesController.reorder);
categoriesRouter.get('/:id', authorize(P.CATEGORIES_VIEW), params, CategoriesController.get);
categoriesRouter.post('/', authorize(P.CATEGORIES_CREATE), validate(createCategorySchema), CategoriesController.create);
categoriesRouter.put('/:id', authorize(P.CATEGORIES_UPDATE), params, validate(updateCategorySchema), CategoriesController.update);
categoriesRouter.patch('/:id/status', authorize(P.CATEGORIES_CHANGE_STATUS), params, validate(statusSchema), CategoriesController.changeStatus);

/* ------------------------ Tipos de solicitud ------------------------ */
export const ticketTypesRouter = Router();
ticketTypesRouter.get('/meta', authorizeAny(P.TICKET_TYPES_VIEW, P.FORMS_VIEW), TicketTypesController.meta);
ticketTypesRouter.get('/', authorize(P.TICKET_TYPES_VIEW), validate(listTicketTypesQuery, 'query'), TicketTypesController.list);
ticketTypesRouter.put('/order', authorize(P.TICKET_TYPES_UPDATE), validate(reorderSchema), TicketTypesController.reorder);
ticketTypesRouter.get(
  '/assignee-options',
  authorizeAny(P.TICKET_TYPES_CREATE, P.TICKET_TYPES_UPDATE),
  byDepartment,
  TicketTypesController.assigneeOptions,
);
ticketTypesRouter.get('/:id', authorize(P.TICKET_TYPES_VIEW), params, TicketTypesController.get);
ticketTypesRouter.post('/', authorize(P.TICKET_TYPES_CREATE), validate(createTicketTypeSchema), TicketTypesController.create);
ticketTypesRouter.put('/:id', authorize(P.TICKET_TYPES_UPDATE), params, validate(updateTicketTypeSchema), TicketTypesController.update);
ticketTypesRouter.patch('/:id/status', authorize(P.TICKET_TYPES_CHANGE_STATUS), params, validate(statusSchema), TicketTypesController.changeStatus);

/* Formulario de un tipo (completo y por campos) */
ticketTypesRouter.get('/:id/form', authorize(P.FORMS_VIEW), params, FormsController.get);
ticketTypesRouter.put('/:id/form', authorize(P.FORMS_UPDATE), params, validate(saveFormSchema), FormsController.save);
ticketTypesRouter.post('/:id/form/validate', authorize(P.FORMS_VIEW), params, validate(previewSubmissionSchema), FormsController.validate);
ticketTypesRouter.get('/:id/fields', authorize(P.FORMS_VIEW), params, FormsController.listFields);
ticketTypesRouter.post('/:id/fields', authorize(P.FORMS_UPDATE), params, validate(fieldSchema), FormsController.addField);
ticketTypesRouter.put('/:id/fields/order', authorize(P.FORMS_UPDATE), params, validate(fieldOrderSchema), FormsController.reorderFields);

/* --------------------- Campos y opciones (granular) --------------------- */
export const formFieldsRouter = Router();
const fieldParams = validate(fieldIdParam, 'params');
formFieldsRouter.put('/:fieldId', authorize(P.FORMS_UPDATE), fieldParams, validate(updateFieldSchema), FormsController.updateField);
formFieldsRouter.patch('/:fieldId/status', authorize(P.FORMS_UPDATE), fieldParams, validate(statusSchema), FormsController.changeFieldStatus);
formFieldsRouter.delete('/:fieldId', authorize(P.FORMS_UPDATE), fieldParams, FormsController.deleteField);
formFieldsRouter.get('/:fieldId/options', authorize(P.FORMS_VIEW), fieldParams, FormsController.listOptions);
formFieldsRouter.post('/:fieldId/options', authorize(P.FORMS_UPDATE), fieldParams, validate(optionSchema), FormsController.addOption);

export const fieldOptionsRouter = Router();
const optionParams = validate(optionIdParam, 'params');
fieldOptionsRouter.put('/:optionId', authorize(P.FORMS_UPDATE), optionParams, validate(optionUpdateSchema), FormsController.updateOption);
fieldOptionsRouter.delete('/:optionId', authorize(P.FORMS_UPDATE), optionParams, FormsController.deleteOption);

/* ---------------- Catálogo de solicitudes (preparado para la Etapa 4) ---------------- */
export const requestCatalogRouter = Router();
const catalogAccess = authorize(P.REQUEST_CATALOG_VIEW);
requestCatalogRouter.get('/', catalogAccess, RequestCatalogController.catalog);
requestCatalogRouter.get('/lookups/users', catalogAccess, RequestCatalogController.users);
requestCatalogRouter.get('/lookups/departments', catalogAccess, RequestCatalogController.departments);
requestCatalogRouter.get('/types/:id/form', catalogAccess, params, RequestCatalogController.form);
requestCatalogRouter.post(
  '/types/:id/validate',
  catalogAccess,
  params,
  validate(z.object({ values: z.record(z.string(), z.unknown()).default({}) }).strict()),
  RequestCatalogController.validate,
);
