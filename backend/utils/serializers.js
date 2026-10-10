/** Convierte una fila de usuario a la forma pública (sin datos sensibles). */
export function toPublicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    companyId: row.company_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    status: row.status,
    mustChangePassword: Boolean(row.must_change_password),
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    role: {
      id: row.role_id,
      code: row.role_code,
      name: row.role_name,
      level: row.role_level,
    },
    department: row.department_id
      ? { id: row.department_id, name: row.department_name, code: row.department_code, status: row.department_status }
      : null,
    createdBy: row.created_by_name ? { id: row.created_by, name: row.created_by_name } : null,
  };
}

export function toPublicRole(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    level: row.level,
  };
}

/** URL del logo con marca de versión para invalidar la caché al cambiarlo. */
export function companyLogoUrl(logoPath, updatedAt) {
  if (!logoPath) return null;
  const v = updatedAt ? new Date(updatedAt).getTime() : Date.now();
  return `/api/company/logo?v=${v}`;
}

export function toPublicCompany(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    tradeName: row.trade_name,
    rfc: row.rfc,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: row.city,
    state: row.state,
    postalCode: row.postal_code,
    country: row.country,
    website: row.website,
    logoUrl: companyLogoUrl(row.logo_path, row.updated_at),
    timezone: row.timezone,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Datos mínimos de la empresa que necesita cualquier usuario autenticado. */
export function toCompanySummary(session) {
  return {
    id: session.company_id,
    name: session.company_name,
    tradeName: session.company_trade_name,
    status: session.company_status,
    logoUrl: companyLogoUrl(session.company_logo_path, session.company_updated_at),
  };
}

export function toPublicDepartment(row) {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    description: row.description,
    status: row.status,
    manager: row.manager_id
      ? {
          id: row.manager_id,
          firstName: row.manager_first_name,
          lastName: row.manager_last_name,
          fullName: `${row.manager_first_name ?? ''} ${row.manager_last_name ?? ''}`.trim(),
          email: row.manager_email,
          status: row.manager_status,
        }
      : null,
    membersCount: Number(row.members_count ?? 0),
    activeMembersCount: Number(row.active_members_count ?? 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toDepartmentMember(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.first_name} ${row.last_name}`.trim(),
    email: row.email,
    status: row.status,
    role: { id: row.role_id, code: row.role_code, name: row.role_name, level: row.role_level },
    isPrimary: Boolean(row.is_primary),
    isAgent: Boolean(row.is_agent),
    joinedAt: row.joined_at,
  };
}
