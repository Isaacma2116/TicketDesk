import { query } from '../config/database.js';

/**
 * Registro de auditoría. En esta etapa solo se escribe; el módulo de
 * consulta llegará más adelante. Un fallo al auditar nunca debe romper la
 * operación de negocio, por eso los errores solo se registran en consola.
 */
export const AUDIT_ACTIONS = Object.freeze({
  COMPANY_UPDATED: 'company.updated',
  COMPANY_LOGO_UPDATED: 'company.logo_updated',
  COMPANY_LOGO_REMOVED: 'company.logo_removed',
  DEPARTMENT_CREATED: 'department.created',
  DEPARTMENT_UPDATED: 'department.updated',
  DEPARTMENT_STATUS_CHANGED: 'department.status_changed',
  DEPARTMENT_MANAGER_CHANGED: 'department.manager_changed',
  DEPARTMENT_DELETED: 'department.deleted',
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_STATUS_CHANGED: 'user.status_changed',
  USER_DELETED: 'user.deleted',
  USER_DEPARTMENT_ASSIGNED: 'user.department_assigned',
  CATEGORY_CREATED: 'category.created',
  CATEGORY_UPDATED: 'category.updated',
  CATEGORY_STATUS_CHANGED: 'category.status_changed',
  CATEGORY_REORDERED: 'category.reordered',
  TICKET_TYPE_CREATED: 'ticket_type.created',
  TICKET_TYPE_UPDATED: 'ticket_type.updated',
  TICKET_TYPE_STATUS_CHANGED: 'ticket_type.status_changed',
  TICKET_TYPE_REORDERED: 'ticket_type.reordered',
  FORM_UPDATED: 'form.updated',
});

/** Calcula { campo: { from, to } } solo para los campos que cambian. */
export function diff(before, after) {
  const changes = {};
  for (const [key, to] of Object.entries(after)) {
    if (to === undefined) continue;
    const from = before?.[key] ?? null;
    if (String(from ?? '') !== String(to ?? '')) changes[key] = { from, to };
  }
  return changes;
}

export const AuditService = {
  /**
   * @param {object} ctx  { companyId, actorId, ip, userAgent }
   */
  async log(ctx, action, entityType, entityId, changes = null) {
    try {
      await query(
        `INSERT INTO audit_logs (company_id, actor_id, action, entity_type, entity_id, changes, ip_address, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          ctx.companyId ?? null,
          ctx.actorId ?? null,
          action,
          entityType,
          entityId != null ? String(entityId) : null,
          changes ? JSON.stringify(changes) : null,
          ctx.ip ?? null,
          ctx.userAgent?.slice(0, 255) ?? null,
        ],
      );
    } catch (err) {
      console.error('[audit] No se pudo registrar', action, err.message);
    }
  },
};
