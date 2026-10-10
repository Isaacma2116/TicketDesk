import { CompanyService } from '../services/company.service.js';

export const CompanyController = {
  async get(req, res) {
    res.json({ company: await CompanyService.get(req.auth) });
  },

  async update(req, res) {
    res.json({ company: await CompanyService.update(req.auth, req.validated.body) });
  },

  async uploadLogo(req, res) {
    res.json({ company: await CompanyService.setLogo(req.auth, req.file) });
  },

  async removeLogo(req, res) {
    res.json({ company: await CompanyService.removeLogo(req.auth) });
  },

  async logo(req, res) {
    const file = await CompanyService.logoFile(req.auth);
    res.set({
      'Content-Type': file.mime,
      // El navegador nunca debe interpretarlo como otro tipo ni ejecutar nada.
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'Content-Disposition': 'inline',
      // La URL lleva ?v=<versión>, así que puede cachearse de forma privada.
      'Cache-Control': 'private, max-age=86400',
    });
    res.sendFile(file.path);
  },
};
