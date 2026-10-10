import { DashboardService } from '../services/dashboard.service.js';
import { UserService } from '../services/user.service.js';

export const DashboardController = {
  async summary(req, res) {
    res.json(await DashboardService.summary(req.auth));
  },
};

export const RolesController = {
  async list(req, res) {
    res.json({ roles: await UserService.rolesFor(req.auth) });
  },
};
