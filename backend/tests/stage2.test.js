import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { pool, query } from '../config/database.js';
import { RoleModel } from '../models/role.model.js';
import { UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';
import { ORIGIN, SUPERADMIN, app, loginAs, resetDatabase } from './helpers.js';

let root;
let roles;
const PASSWORD = 'Final-Pass-1';

before(async () => {
  await resetDatabase();
  ({ agent: root } = await loginAs(SUPERADMIN.email, SUPERADMIN.password));
  const res = await root.get('/api/roles');
  roles = Object.fromEntries(res.body.roles.map((r) => [r.code, r.id]));
});

after(() => pool.end());

const send = (agent, method, url, body) => agent[method](url).set('Origin', ORIGIN).send(body);

function createDepartment(agent, overrides = {}) {
  return send(agent, 'post', '/api/departments', {
    name: `Depto ${Math.random().toString(36).slice(2, 7)}`,
    code: `D${Math.random().toString(36).slice(2, 7)}`,
    ...overrides,
  });
}

/** Crea un usuario (vía API como root), cambia su contraseña y devuelve su sesión. */
async function readyUser(roleCode, departmentId = null) {
  const created = await send(root, 'post', '/api/users', {
    firstName: 'Test',
    lastName: roleCode,
    email: `${roleCode}.${Math.random().toString(36).slice(2, 8)}@test.local`,
    roleId: roles[roleCode],
    departmentId,
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  const { agent } = await loginAs(created.body.user.email, created.body.temporaryPassword);
  await send(agent, 'post', '/api/auth/change-password', {
    currentPassword: created.body.temporaryPassword,
    newPassword: PASSWORD,
    confirmPassword: PASSWORD,
  }).expect(200);
  return { agent, user: created.body.user };
}

// PNG 1×1 válido.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

describe('Empresa', () => {
  it('el superadmin consulta y edita su empresa', async () => {
    const res = await root.get('/api/company').expect(200);
    assert.equal(res.body.company.name, 'Mi Empresa');

    const updated = await send(root, 'put', '/api/company', {
      name: 'Grupo Industrial Norte S.A. de C.V.',
      tradeName: 'Grupo Norte',
      rfc: 'gin010101ab1',
      email: 'CONTACTO@NORTE.MX',
      phone: '+52 81 1234 5678',
      postalCode: '64000',
      website: 'https://norte.mx',
      timezone: 'America/Monterrey',
    }).expect(200);
    assert.equal(updated.body.company.rfc, 'GIN010101AB1');
    assert.equal(updated.body.company.email, 'contacto@norte.mx');
    assert.equal(updated.body.company.timezone, 'America/Monterrey');

    // Vaciar un campo opcional lo deja en null.
    const cleared = await send(root, 'put', '/api/company', { phone: '' }).expect(200);
    assert.equal(cleared.body.company.phone, null);
  });

  it('valida los datos de la empresa', async () => {
    const res = await send(root, 'put', '/api/company', {
      name: '',
      rfc: 'XYZ',
      email: 'no-es-correo',
      website: 'javascript:alert(1)',
      timezone: 'Marte/Olympus',
      logoPath: '../../etc/passwd',
    }).expect(400);
    assert.match(res.body.error.details._ ?? '', /no permitidos/);
    const res2 = await send(root, 'put', '/api/company', {
      name: '',
      rfc: 'XYZ',
      email: 'no-es-correo',
      website: 'javascript:alert(1)',
      timezone: 'Marte/Olympus',
    }).expect(400);
    for (const field of ['name', 'rfc', 'email', 'website', 'timezone']) assert.ok(res2.body.error.details[field], field);
  });

  it('logo: acepta PNG/JPG/WEBP reales, rechaza archivos disfrazados y demasiado grandes', async () => {
    const up = await root.post('/api/company/logo').set('Origin', ORIGIN).attach('logo', PNG, 'logo.png').expect(200);
    assert.match(up.body.company.logoUrl, /^\/api\/company\/logo\?v=\d+$/);
    const img = await root.get('/api/company/logo').expect(200);
    assert.equal(img.headers['content-type'], 'image/png');
    assert.equal(img.headers['x-content-type-options'], 'nosniff');

    // Un HTML/SVG renombrado a .png se detecta por su contenido.
    const fake = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
    await root.post('/api/company/logo').set('Origin', ORIGIN).attach('logo', fake, { filename: 'x.png', contentType: 'image/png' }).expect(400);

    const big = Buffer.concat([PNG, Buffer.alloc(3 * 1024 * 1024)]);
    const tooBig = await root.post('/api/company/logo').set('Origin', ORIGIN).attach('logo', big, 'big.png').expect(400);
    assert.match(tooBig.body.error.message, /tamaño máximo/);

    // Reemplazar borra el archivo anterior; eliminar deja la empresa sin logo.
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(64)]);
    await root.post('/api/company/logo').set('Origin', ORIGIN).attach('logo', jpg, 'logo.jpg').expect(200);
    assert.equal((await root.get('/api/company/logo')).headers['content-type'], 'image/jpeg');
    const removed = await root.delete('/api/company/logo').set('Origin', ORIGIN).expect(200);
    assert.equal(removed.body.company.logoUrl, null);
    await root.get('/api/company/logo').expect(404);
  });

  it('el administrador solo puede ver la empresa; el resto, ni eso', async () => {
    const { agent: admin } = await readyUser('admin');
    await admin.get('/api/company').expect(200);
    await send(admin, 'put', '/api/company', { name: 'Hack' }).expect(403);
    await admin.post('/api/company/logo').set('Origin', ORIGIN).attach('logo', PNG, 'logo.png').expect(403);

    const { agent: user } = await readyUser('user');
    await user.get('/api/company').expect(403);
    await send(user, 'put', '/api/company', { name: 'Hack' }).expect(403);
  });
});

describe('Departamentos', () => {
  it('crea un departamento normalizando el código y asigna al responsable como integrante', async () => {
    const { user: manager } = await readyUser('supervisor');
    const res = await createDepartment(root, {
      name: 'Tecnologías de la Información',
      code: ' ti ',
      description: 'Soporte e infraestructura',
      managerId: manager.id,
    }).expect(201);
    const d = res.body.department;
    assert.equal(d.code, 'TI');
    assert.equal(d.manager.id, manager.id);
    assert.equal(d.membersCount, 1);
    assert.deepEqual(d.summary, { total: 1, active: 1, agents: 0, supervisors: 1 });

    // El responsable sin departamento previo queda con TI como principal.
    const detail = await root.get(`/api/users/${manager.id}`).expect(200);
    assert.equal(detail.body.user.department.code, 'TI');
  });

  it('impide códigos duplicados en la misma empresa', async () => {
    const res = await createDepartment(root, { name: 'Otro TI', code: 'TI' }).expect(409);
    assert.equal(res.body.error.message, 'Ya existe un departamento con ese código.');
    assert.ok(res.body.error.details.code);
  });

  it('valida los datos del departamento', async () => {
    const res = await createDepartment(root, { name: '', code: 'con espacios', managerId: 'abc' }).expect(400);
    for (const field of ['name', 'code', 'managerId']) assert.ok(res.body.error.details[field], field);
    await createDepartment(root, { managerId: 999999 }).expect(400);
  });

  it('el responsable debe ser un usuario activo', async () => {
    const { user } = await readyUser('agent');
    await send(root, 'patch', `/api/users/${user.id}/status`, { status: 'inactive' }).expect(200);
    const res = await createDepartment(root, { managerId: user.id }).expect(400);
    assert.ok(res.body.error.details.managerId);
  });

  it('lista, busca y filtra departamentos', async () => {
    await createDepartment(root, { name: 'Recursos Humanos', code: 'RH' }).expect(201);
    const compras = await createDepartment(root, { name: 'Compras', code: 'COMPRAS' }).expect(201);
    await send(root, 'patch', `/api/departments/${compras.body.department.id}/status`, { status: 'inactive' }).expect(200);

    const byName = await root.get('/api/departments').query({ search: 'humanos' }).expect(200);
    assert.deepEqual(byName.body.items.map((d) => d.code), ['RH']);
    const byCode = await root.get('/api/departments').query({ search: 'COMPRAS' }).expect(200);
    assert.equal(byCode.body.items[0].name, 'Compras');
    const inactive = await root.get('/api/departments').query({ status: 'inactive' }).expect(200);
    assert.ok(inactive.body.items.every((d) => d.status === 'inactive'));
    assert.equal(byName.body.scope, 'all');
  });

  it('un departamento inactivo conserva a sus usuarios pero no admite nuevas asignaciones', async () => {
    const dep = (await createDepartment(root, { name: 'Mantenimiento', code: 'MANT' })).body.department;
    const { user } = await readyUser('agent', dep.id);

    const off = await send(root, 'patch', `/api/departments/${dep.id}/status`, { status: 'inactive' }).expect(200);
    assert.equal(off.body.department.status, 'inactive');
    assert.equal(off.body.department.membersCount, 1);

    // El usuario sigue en el departamento.
    assert.equal((await root.get(`/api/users/${user.id}`)).body.user.department.code, 'MANT');
    // Pero ya no aparece como opción ni acepta nuevos usuarios.
    const options = await root.get('/api/departments/options').expect(200);
    assert.ok(!options.body.departments.some((d) => d.id === dep.id));
    const res = await send(root, 'post', '/api/users', {
      firstName: 'Nuevo',
      lastName: 'Usuario',
      email: 'nuevo.mant@test.local',
      roleId: roles.user,
      departmentId: dep.id,
    }).expect(400);
    assert.ok(res.body.error.details.departmentId);
    // Editar a un usuario que ya está en él no lo expulsa.
    await send(root, 'put', `/api/users/${user.id}`, { firstName: 'Editado', departmentId: dep.id }).expect(200);
  });

  it('edita datos y responsable, y protege al responsable de salir del departamento', async () => {
    const dep = (await createDepartment(root, { name: 'Finanzas', code: 'FIN' })).body.department;
    const { user: lead } = await readyUser('supervisor', dep.id);
    const updated = await send(root, 'put', `/api/departments/${dep.id}`, {
      name: 'Finanzas y Contabilidad',
      code: 'fin-01',
      managerId: lead.id,
    }).expect(200);
    assert.equal(updated.body.department.code, 'FIN-01');
    assert.equal(updated.body.department.manager.id, lead.id);

    const other = (await createDepartment(root, { name: 'Ventas', code: 'VENTAS' })).body.department;
    const blocked = await send(root, 'put', `/api/users/${lead.id}`, { departmentId: other.id }).expect(409);
    assert.equal(blocked.body.error.code, 'USER_IS_DEPARTMENT_MANAGER');

    // Tras quitarle la responsabilidad, sí puede cambiar.
    await send(root, 'put', `/api/departments/${dep.id}`, { managerId: null }).expect(200);
    const moved = await send(root, 'put', `/api/users/${lead.id}`, { departmentId: other.id }).expect(200);
    assert.equal(moved.body.user.department.code, 'VENTAS');
  });

  it('el responsable de otra área se añade como integrante secundario', async () => {
    const a = (await createDepartment(root, { name: 'Calidad', code: 'CAL' })).body.department;
    const b = (await createDepartment(root, { name: 'Logística', code: 'LOG' })).body.department;
    const { user } = await readyUser('supervisor', a.id);
    await send(root, 'put', `/api/departments/${b.id}`, { managerId: user.id }).expect(200);
    const detail = (await root.get(`/api/users/${user.id}`)).body.user;
    assert.equal(detail.department.code, 'CAL');
    assert.deepEqual(
      detail.departments.map((d) => [d.code, d.isPrimary, d.isManager]),
      [
        ['CAL', true, false],
        ['LOG', false, true],
      ],
    );
  });

  it('muestra los usuarios del departamento y prepara la relación de agentes', async () => {
    const dep = (await createDepartment(root, { name: 'Soporte', code: 'SOP' })).body.department;
    await readyUser('agent', dep.id);
    await readyUser('agent', dep.id);
    await readyUser('user', dep.id);
    const members = await root.get(`/api/departments/${dep.id}/users`).expect(200);
    assert.equal(members.body.users.length, 3);
    assert.equal(members.body.users.filter((u) => u.isAgent).length, 2);
    const detail = await root.get(`/api/departments/${dep.id}`).expect(200);
    assert.equal(detail.body.department.summary.agents, 2);

    const filtered = await root.get('/api/users').query({ departmentId: dep.id }).expect(200);
    assert.equal(filtered.body.pagination.total, 3);
    assert.ok(filtered.body.items.every((u) => u.department.code === 'SOP'));
  });

  it('cambiar el rol de un usuario actualiza su marca de agente', async () => {
    const dep = (await createDepartment(root, { name: 'Taller', code: 'TALLER' })).body.department;
    const { user } = await readyUser('user', dep.id);
    await send(root, 'put', `/api/users/${user.id}`, { roleId: roles.agent }).expect(200);
    const members = (await root.get(`/api/departments/${dep.id}/users`)).body.users;
    assert.equal(members.find((m) => m.id === user.id).isAgent, true);
  });

  it('solo elimina físicamente departamentos vacíos y solo el superadmin', async () => {
    const empty = (await createDepartment(root, { name: 'Temporal', code: 'TMP' })).body.department;
    const full = (await createDepartment(root, { name: 'Lleno', code: 'LLENO' })).body.department;
    await readyUser('user', full.id);

    const { agent: admin } = await readyUser('admin');
    await admin.delete(`/api/departments/${empty.id}`).set('Origin', ORIGIN).expect(403);

    const res = await root.delete(`/api/departments/${full.id}`).set('Origin', ORIGIN).expect(409);
    assert.equal(res.body.error.code, 'DEPARTMENT_NOT_EMPTY');
    await root.delete(`/api/departments/${empty.id}`).set('Origin', ORIGIN).expect(204);
    await root.get(`/api/departments/${empty.id}`).expect(404);
  });
});

describe('Permisos por rol', () => {
  let ti;
  let rh;
  before(async () => {
    ti = (await root.get('/api/departments').query({ search: 'TI' })).body.items.find((d) => d.code === 'TI');
    rh = (await root.get('/api/departments').query({ search: 'RH' })).body.items.find((d) => d.code === 'RH');
  });

  it('el administrador gestiona departamentos', async () => {
    const { agent: admin } = await readyUser('admin');
    const dep = (await createDepartment(admin, { name: 'Jurídico', code: 'JUR' }).expect(201)).body.department;
    await send(admin, 'put', `/api/departments/${dep.id}`, { description: 'Asuntos legales' }).expect(200);
    await send(admin, 'patch', `/api/departments/${dep.id}/status`, { status: 'inactive' }).expect(200);
    await admin.get(`/api/departments/${dep.id}/users`).expect(200);
    await admin.get('/api/users').query({ departmentId: ti.id }).expect(200);
  });

  for (const role of ['supervisor', 'agent', 'user']) {
    it(`${role}: no puede crear, editar ni cambiar estado de departamentos ni la empresa`, async () => {
      const { agent } = await readyUser(role, ti.id);
      await createDepartment(agent).expect(403);
      await send(agent, 'put', `/api/departments/${ti.id}`, { name: 'Hack' }).expect(403);
      await send(agent, 'patch', `/api/departments/${ti.id}/status`, { status: 'inactive' }).expect(403);
      await agent.delete(`/api/departments/${ti.id}`).set('Origin', ORIGIN).expect(403);
      await send(agent, 'put', '/api/company', { name: 'Hack' }).expect(403);
      await agent.get('/api/departments/manager-options').expect(403);

      // Ve su departamento, pero no los ajenos (ni cambiando el id en la URL).
      const list = await agent.get('/api/departments').expect(200);
      assert.equal(list.body.scope, 'own');
      assert.deepEqual(list.body.items.map((d) => d.code), ['TI']);
      await agent.get(`/api/departments/${ti.id}`).expect(200);
      await agent.get(`/api/departments/${rh.id}`).expect(403);

      // Solo el supervisor ve a los integrantes (y solo de su departamento).
      const expected = role === 'supervisor' ? 200 : 403;
      await agent.get(`/api/departments/${ti.id}/users`).expect(expected);
      await agent.get(`/api/departments/${rh.id}/users`).expect(403);
      await agent.get('/api/users').expect(403);
    });
  }

  it('el perfil (/auth/me) incluye empresa y departamento', async () => {
    const { agent } = await readyUser('agent', ti.id);
    const me = await agent.get('/api/auth/me').expect(200);
    assert.equal(me.body.user.department.code, 'TI');
    assert.equal(me.body.user.departments[0].isPrimary, true);
    assert.ok(me.body.company.name);
    const dash = await agent.get('/api/dashboard/summary').expect(200);
    assert.equal(dash.body.myDepartments[0].code, 'TI');
    assert.equal(dash.body.departments, null);
  });
});

describe('Aislamiento multiempresa', () => {
  let outsider; // sesión de un superadmin de OTRA empresa
  let otherDeptId;

  before(async () => {
    const [res] = await pool.query("INSERT INTO companies (name) VALUES ('Otra Empresa')");
    const companyId = res.insertId;
    const role = await RoleModel.findByCode('superadmin');
    await UserModel.create({
      companyId,
      firstName: 'Ajeno',
      lastName: 'Admin',
      email: 'ajeno@otra.local',
      passwordHash: await hashPassword(PASSWORD),
      roleId: role.id,
      status: 'active',
      mustChangePassword: false,
    });
    ({ agent: outsider } = await loginAs('ajeno@otra.local', PASSWORD));
    // El mismo código TI está permitido en otra empresa.
    const dep = await createDepartment(outsider, { name: 'TI Otra', code: 'TI' }).expect(201);
    otherDeptId = dep.body.department.id;
  });

  it('no ve departamentos, usuarios ni datos de otra empresa', async () => {
    const mine = (await root.get('/api/departments').query({ pageSize: 100 })).body.items;
    assert.ok(!mine.some((d) => d.id === otherDeptId));
    const theirs = (await outsider.get('/api/departments')).body.items;
    assert.deepEqual(theirs.map((d) => d.id), [otherDeptId]);

    const rootDept = mine[0].id;
    await outsider.get(`/api/departments/${rootDept}`).expect(404);
    await outsider.get(`/api/departments/${rootDept}/users`).expect(404);
    await send(outsider, 'put', `/api/departments/${rootDept}`, { name: 'Hack' }).expect(404);
    await send(outsider, 'patch', `/api/departments/${rootDept}/status`, { status: 'inactive' }).expect(404);
    await root.get(`/api/departments/${otherDeptId}`).expect(404);

    const users = (await outsider.get('/api/users').query({ pageSize: 100 })).body.items;
    assert.deepEqual(users.map((u) => u.email), ['ajeno@otra.local']);
    await outsider.get('/api/users/1').expect(404);
    await send(outsider, 'patch', '/api/users/1/status', { status: 'inactive' }).expect(404);

    const company = (await outsider.get('/api/company')).body.company;
    assert.equal(company.name, 'Otra Empresa');
    const dash = (await outsider.get('/api/dashboard/summary')).body;
    assert.equal(dash.users.total, 1);
    assert.equal(dash.departments.total, 1);
  });

  it('no puede usar usuarios ni departamentos de otra empresa en sus formularios', async () => {
    await createDepartment(outsider, { managerId: 1 }).expect(400);
    const mine = (await root.get('/api/departments')).body.items[0].id;
    await send(outsider, 'post', '/api/users', {
      firstName: 'X',
      lastName: 'Y',
      email: 'xy@otra.local',
      roleId: roles.user,
      departmentId: mine,
    }).expect(400);
    const options = (await outsider.get('/api/departments/manager-options')).body.users;
    assert.deepEqual(options.map((u) => u.email), ['ajeno@otra.local']);
  });

  it('la base de datos impide cruzar empresas aunque fallara la aplicación', async () => {
    await assert.rejects(
      query('UPDATE departments SET manager_id = 1 WHERE id = ?', [otherDeptId]),
      /foreign key constraint/i,
    );
  });
});

describe('Auditoría', () => {
  it('registra las acciones de empresa, departamentos y asignaciones', async () => {
    const rows = await query('SELECT DISTINCT action FROM audit_logs');
    const actions = rows.map((r) => r.action);
    for (const a of [
      'company.updated',
      'company.logo_updated',
      'company.logo_removed',
      'department.created',
      'department.updated',
      'department.status_changed',
      'department.manager_changed',
      'department.deleted',
      'user.created',
      'user.department_assigned',
    ]) {
      assert.ok(actions.includes(a), a);
    }
    const [row] = await query("SELECT * FROM audit_logs WHERE action = 'department.status_changed' LIMIT 1");
    assert.ok(row.actor_id && row.company_id && row.ip_address);
  });
});

describe('Login con empresa inactiva', () => {
  it('solo el superadmin puede entrar si la empresa está desactivada', async () => {
    const { user } = await readyUser('admin');
    await send(root, 'put', '/api/company', { status: 'inactive' }).expect(200);
    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: PASSWORD }).expect(403);
    assert.equal(res.body.error.code, 'COMPANY_INACTIVE');
    await request(app).post('/api/auth/login').send({ email: SUPERADMIN.email, password: SUPERADMIN.password }).expect(200);
    await send(root, 'put', '/api/company', { status: 'active' }).expect(200);
  });
});
