import fs from 'node:fs/promises';
import path from 'node:path';
import { CompanyModel } from '../models/company.model.js';
import { AppError } from '../utils/AppError.js';
import { deleteUpload, detectImageType, MIME_BY_EXT, resolveUploadPath, saveCompanyLogo } from '../utils/files.js';
import { toPublicCompany } from '../utils/serializers.js';
import { AUDIT_ACTIONS, AuditService, diff } from './audit.service.js';

const FIELD_COLUMNS = {
  name: 'name',
  tradeName: 'trade_name',
  rfc: 'rfc',
  email: 'email',
  phone: 'phone',
  address: 'address',
  city: 'city',
  state: 'state',
  postalCode: 'postal_code',
  country: 'country',
  website: 'website',
  timezone: 'timezone',
  status: 'status',
};

async function getOrFail(companyId) {
  const company = await CompanyModel.findById(companyId);
  if (!company) throw AppError.notFound('Empresa no encontrada');
  return company;
}

export const CompanyService = {
  /** Siempre la empresa del usuario autenticado: no se acepta un id del cliente. */
  async get(auth) {
    return toPublicCompany(await getOrFail(auth.companyId));
  },

  async update(auth, data) {
    const company = await getOrFail(auth.companyId);
    if (data.rfc && data.rfc !== company.rfc && (await CompanyModel.rfcExists(data.rfc, company.id))) {
      throw AppError.conflict('Ya existe una empresa registrada con ese RFC', 'RFC_TAKEN');
    }
    await CompanyModel.update(company.id, data);

    const before = Object.fromEntries(Object.entries(FIELD_COLUMNS).map(([k, col]) => [k, company[col]]));
    const changes = diff(before, data);
    if (Object.keys(changes).length) {
      await AuditService.log(auth.audit, AUDIT_ACTIONS.COMPANY_UPDATED, 'company', company.id, changes);
    }
    return toPublicCompany(await CompanyModel.findById(company.id));
  },

  async setLogo(auth, file) {
    if (!file?.buffer?.length) {
      throw AppError.badRequest('Selecciona una imagen', { logo: 'Selecciona una imagen' });
    }
    const type = detectImageType(file.buffer);
    if (!type) {
      throw AppError.badRequest('Formato no permitido. Usa una imagen PNG, JPG o WEBP.', {
        logo: 'Formato no permitido. Usa PNG, JPG o WEBP.',
      });
    }
    const company = await getOrFail(auth.companyId);
    const newPath = await saveCompanyLogo(company.id, file.buffer, type.ext);
    try {
      await CompanyModel.update(company.id, { logoPath: newPath });
    } catch (err) {
      await deleteUpload(newPath);
      throw err;
    }
    // El archivo anterior se borra después de confirmar el cambio en BD.
    if (company.logo_path) await deleteUpload(company.logo_path).catch(() => {});
    await AuditService.log(auth.audit, AUDIT_ACTIONS.COMPANY_LOGO_UPDATED, 'company', company.id, {
      mime: type.mime,
      size: file.buffer.length,
    });
    return toPublicCompany(await CompanyModel.findById(company.id));
  },

  async removeLogo(auth) {
    const company = await getOrFail(auth.companyId);
    if (company.logo_path) {
      await CompanyModel.update(company.id, { logoPath: null });
      await deleteUpload(company.logo_path).catch(() => {});
      await AuditService.log(auth.audit, AUDIT_ACTIONS.COMPANY_LOGO_REMOVED, 'company', company.id);
    }
    return toPublicCompany(await CompanyModel.findById(company.id));
  },

  /** Devuelve { path, mime } del logo de la empresa del usuario, o lanza 404. */
  async logoFile(auth) {
    const company = await getOrFail(auth.companyId);
    const full = resolveUploadPath(company.logo_path);
    if (!full) throw AppError.notFound('La empresa no tiene logo');
    try {
      await fs.access(full);
    } catch {
      throw AppError.notFound('La empresa no tiene logo');
    }
    const ext = path.extname(full).slice(1).toLowerCase();
    return { path: full, mime: MIME_BY_EXT[ext] ?? 'application/octet-stream' };
  },
};
