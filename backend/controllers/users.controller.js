import { UserService } from '../services/user.service.js';

export const UsersController = {
  async list(req, res) {
    res.json(await UserService.list(req.auth, req.validated.query));
  },

  async get(req, res) {
    res.json({ user: await UserService.getById(req.auth, req.validated.params.id) });
  },

  async create(req, res) {
    const result = await UserService.create(req.auth, req.validated.body);
    res.status(201).location(`/api/users/${result.user.id}`).json(result);
  },

  async update(req, res) {
    res.json(await UserService.update(req.auth, req.validated.params.id, req.validated.body));
  },

  async changeStatus(req, res) {
    const user = await UserService.changeStatus(req.auth, req.validated.params.id, req.validated.body.status);
    res.json({ user });
  },

  async remove(req, res) {
    await UserService.remove(req.auth, req.validated.params.id);
    res.status(204).end();
  },
};
