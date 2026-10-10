import { DepartmentService } from '../services/department.service.js';

export const DepartmentsController = {
  async list(req, res) {
    res.json(await DepartmentService.list(req.auth, req.validated.query));
  },

  async options(req, res) {
    res.json({ departments: await DepartmentService.options(req.auth, req.validated.query) });
  },

  async managerOptions(req, res) {
    res.json({ users: await DepartmentService.managerOptions(req.auth, req.validated.query.departmentId) });
  },

  async get(req, res) {
    res.json({ department: await DepartmentService.getById(req.auth, req.validated.params.id) });
  },

  async members(req, res) {
    res.json({ users: await DepartmentService.members(req.auth, req.validated.params.id) });
  },

  async create(req, res) {
    const department = await DepartmentService.create(req.auth, req.validated.body);
    res.status(201).location(`/api/departments/${department.id}`).json({ department });
  },

  async update(req, res) {
    res.json({ department: await DepartmentService.update(req.auth, req.validated.params.id, req.validated.body) });
  },

  async changeStatus(req, res) {
    const department = await DepartmentService.changeStatus(req.auth, req.validated.params.id, req.validated.body.status);
    res.json({ department });
  },

  async remove(req, res) {
    await DepartmentService.remove(req.auth, req.validated.params.id);
    res.status(204).end();
  },
};
