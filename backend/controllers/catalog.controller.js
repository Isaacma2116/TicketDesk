import { FIELD_TYPES, CURRENCIES, FILE_EXTENSIONS, IMAGE_EXTENSIONS, LIMITS, PRIORITIES } from '../config/fieldTypes.js';
import { CategoryService } from '../services/category.service.js';
import { FormService } from '../services/form.service.js';
import { RequestCatalogService } from '../services/requestCatalog.service.js';
import { TicketTypeService } from '../services/ticketType.service.js';

/** Solo las claves que el cliente envió de verdad (evita que los defaults de zod pisen datos). */
function sentKeys(parsed, raw) {
  return Object.fromEntries(Object.entries(parsed).filter(([k]) => raw && Object.prototype.hasOwnProperty.call(raw, k)));
}

export const CategoriesController = {
  async list(req, res) {
    res.json(await CategoryService.list(req.auth, req.validated.query));
  },
  async get(req, res) {
    res.json({ category: await CategoryService.getById(req.auth, req.validated.params.id) });
  },
  async create(req, res) {
    const category = await CategoryService.create(req.auth, req.validated.body);
    res.status(201).location(`/api/categories/${category.id}`).json({ category });
  },
  async update(req, res) {
    res.json({ category: await CategoryService.update(req.auth, req.validated.params.id, req.validated.body) });
  },
  async changeStatus(req, res) {
    res.json({ category: await CategoryService.changeStatus(req.auth, req.validated.params.id, req.validated.body.status) });
  },
  async reorder(req, res) {
    res.json(await CategoryService.reorder(req.auth, req.validated.body));
  },
  async scopeDepartments(req, res) {
    res.json({ departments: await CategoryService.scopeDepartments(req.auth) });
  },
};

export const TicketTypesController = {
  async list(req, res) {
    res.json(await TicketTypeService.list(req.auth, req.validated.query));
  },
  async get(req, res) {
    res.json({ ticketType: await TicketTypeService.getById(req.auth, req.validated.params.id) });
  },
  async create(req, res) {
    const ticketType = await TicketTypeService.create(req.auth, req.validated.body);
    res.status(201).location(`/api/ticket-types/${ticketType.id}`).json({ ticketType });
  },
  async update(req, res) {
    res.json({ ticketType: await TicketTypeService.update(req.auth, req.validated.params.id, req.validated.body) });
  },
  async changeStatus(req, res) {
    res.json({ ticketType: await TicketTypeService.changeStatus(req.auth, req.validated.params.id, req.validated.body.status) });
  },
  async reorder(req, res) {
    await TicketTypeService.reorder(req.auth, req.validated.body);
    res.status(204).end();
  },
  async assigneeOptions(req, res) {
    res.json({ users: await TicketTypeService.assigneeOptions(req.auth, req.validated.query.departmentId) });
  },
  /** Metadatos para construir formularios en el frontend. */
  meta(_req, res) {
    res.json({ fieldTypes: FIELD_TYPES, currencies: CURRENCIES, fileExtensions: FILE_EXTENSIONS, imageExtensions: IMAGE_EXTENSIONS, limits: LIMITS, priorities: PRIORITIES });
  },
};

export const FormsController = {
  async get(req, res) {
    res.json(await FormService.get(req.auth, req.validated.params.id));
  },
  async save(req, res) {
    res.json(await FormService.save(req.auth, req.validated.params.id, req.validated.body.fields));
  },
  async validate(req, res) {
    res.json(await FormService.validateValues(req.auth, req.validated.params.id, req.validated.body));
  },
  async listFields(req, res) {
    const { fields } = await FormService.get(req.auth, req.validated.params.id);
    res.json({ fields });
  },
  async addField(req, res) {
    const { field } = await FormService.addField(req.auth, req.validated.params.id, req.validated.body);
    res.status(201).json({ field });
  },
  async reorderFields(req, res) {
    const { fields } = await FormService.reorderFields(req.auth, req.validated.params.id, req.validated.body.ids);
    res.json({ fields });
  },
  async updateField(req, res) {
    const { field } = await FormService.updateField(req.auth, req.validated.params.fieldId, sentKeys(req.validated.body, req.body));
    res.json({ field });
  },
  async changeFieldStatus(req, res) {
    const { field } = await FormService.updateField(req.auth, req.validated.params.fieldId, { status: req.validated.body.status });
    res.json({ field });
  },
  async deleteField(req, res) {
    await FormService.deleteField(req.auth, req.validated.params.fieldId);
    res.status(204).end();
  },
  async listOptions(req, res) {
    res.json({ options: await FormService.listOptions(req.auth, req.validated.params.fieldId) });
  },
  async addOption(req, res) {
    res.status(201).json({ option: await FormService.addOption(req.auth, req.validated.params.fieldId, req.validated.body) });
  },
  async updateOption(req, res) {
    res.json({ option: await FormService.updateOption(req.auth, req.validated.params.optionId, sentKeys(req.validated.body, req.body)) });
  },
  async deleteOption(req, res) {
    await FormService.deleteOption(req.auth, req.validated.params.optionId);
    res.status(204).end();
  },
};

export const RequestCatalogController = {
  async catalog(req, res) {
    res.json({ departments: await RequestCatalogService.catalog(req.auth) });
  },
  async form(req, res) {
    res.json(await RequestCatalogService.form(req.auth, req.validated.params.id));
  },
  async validate(req, res) {
    res.json(await RequestCatalogService.validate(req.auth, req.validated.params.id, req.validated.body.values));
  },
  async users(req, res) {
    res.json({ users: await RequestCatalogService.userOptions(req.auth) });
  },
  async departments(req, res) {
    res.json({ departments: await RequestCatalogService.departmentOptions(req.auth) });
  },
};
