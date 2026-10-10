import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool } from '../config/database.js';
import { ORIGIN, SUPERADMIN, app, browser, loginAs, resetDatabase } from './helpers.js';
import request from 'supertest';

let root; // agente autenticado como superadmin
let roles; // code -> id

before(async () => {
  await resetDatabase();
  ({ agent: root } = await loginAs(SUPERADMIN.email, SUPERADMIN.password));
  const res = await root.get('/api/roles');
  roles = Object.fromEntries(res.body.roles.map((r) => [r.code, r.id]));
});

after(() => pool.end());

async function createUser(agent, overrides = {}) {
  const body = {
    firstName: 'Ana',
    lastName: 'Pérez López',
    email: `user${Math.random().toString(36).slice(2, 8)}@test.local`,
    roleId: roles.user,
    status: 'active',
    ...overrides,
  };
  return agent.post('/api/users').set('Origin', ORIGIN).send(body);
}

/** Crea un usuario, inicia sesión y cambia la contraseña temporal. */
async function readyUser(roleCode) {
  const created = await createUser(root, { roleId: roles[roleCode] });
  const { email } = created.body.user;
  const { agent } = await loginAs(email, created.body.temporaryPassword);
  await agent
    .post('/api/auth/change-password')
    .set('Origin', ORIGIN)
    .send({ currentPassword: created.body.temporaryPassword, newPassword: 'Final-Pass-1', confirmPassword: 'Final-Pass-1' })
    .expect(200);
  return { agent, user: created.body.user };
}

describe('Autenticación', () => {
  it('bloquea endpoints protegidos sin sesión', async () => {
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/users').expect(401);
    await request(app).get('/api/dashboard/summary').expect(401);
  });

  it('valida los datos de login', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'no-es-correo', password: '' }).expect(400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    assert.ok(res.body.error.details.email);
    assert.ok(res.body.error.details.password);
  });

  it('responde igual ante correo inexistente y contraseña incorrecta', async () => {
    const a = await request(app).post('/api/auth/login').send({ email: 'nadie@test.local', password: 'x' }).expect(401);
    const b = await request(app).post('/api/auth/login').send({ email: SUPERADMIN.email, password: 'x' }).expect(401);
    assert.equal(a.body.error.message, b.body.error.message);
  });

  it('emite una cookie HttpOnly SameSite=Strict y nunca devuelve el hash', async () => {
    const { res } = await loginAs(SUPERADMIN.email, SUPERADMIN.password);
    assert.equal(res.status, 200);
    const cookie = res.headers['set-cookie'][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.doesNotMatch(cookie, /Expires/); // sin "Recordarme" = cookie de sesión
    assert.equal(JSON.stringify(res.body).includes('password'), false);
    assert.ok(res.body.permissions.includes('users.create'));
  });

  it('"Recordarme" emite una cookie persistente', async () => {
    const { res } = await loginAs(SUPERADMIN.email, SUPERADMIN.password, true);
    assert.match(res.headers['set-cookie'][0], /Expires=/);
  });

  it('acepta el correo sin distinguir mayúsculas', async () => {
    const { res } = await loginAs(SUPERADMIN.email.toUpperCase(), SUPERADMIN.password);
    assert.equal(res.status, 200);
  });

  it('logout invalida la sesión en el servidor', async () => {
    const { agent, res } = await loginAs(SUPERADMIN.email, SUPERADMIN.password);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    await agent.get('/api/auth/me').expect(200);
    await agent.post('/api/auth/logout').set('Origin', ORIGIN).expect(204);
    // Aunque alguien conservara la cookie, ya no es válida.
    await request(app).get('/api/auth/me').set('Cookie', cookie).expect(401);
  });

  it('rechaza peticiones de escritura desde orígenes no permitidos', async () => {
    await root.post('/api/users').set('Origin', 'https://evil.example').send({}).expect(403);
  });

  it('bloquea la cuenta tras varios intentos fallidos', async () => {
    const created = await createUser(root);
    const { email } = created.body.user;
    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/auth/login').send({ email, password: 'Incorrecta-1' }).expect(401);
    }
    const res = await request(app).post('/api/auth/login').send({ email, password: created.body.temporaryPassword }).expect(429);
    assert.equal(res.body.error.code, 'ACCOUNT_LOCKED');
  });
});

describe('Contraseña temporal', () => {
  it('obliga a cambiarla antes de usar la aplicación', async () => {
    const created = await createUser(root);
    assert.ok(created.body.temporaryPassword);
    const { agent, res } = await loginAs(created.body.user.email, created.body.temporaryPassword);
    assert.equal(res.body.user.mustChangePassword, true);
    await agent.get('/api/auth/me').expect(200);
    const blocked = await agent.get('/api/dashboard/summary').expect(403);
    assert.equal(blocked.body.error.code, 'PASSWORD_CHANGE_REQUIRED');

    const weak = await agent
      .post('/api/auth/change-password')
      .set('Origin', ORIGIN)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: 'debil', confirmPassword: 'debil' })
      .expect(400);
    assert.ok(weak.body.error.details.newPassword);

    await agent
      .post('/api/auth/change-password')
      .set('Origin', ORIGIN)
      .send({ currentPassword: created.body.temporaryPassword, newPassword: 'Segura-123', confirmPassword: 'Segura-123' })
      .expect(200);
    await agent.get('/api/dashboard/summary').expect(200);
  });
});

describe('Gestión de usuarios (superadmin)', () => {
  it('crea, consulta, edita y lista usuarios', async () => {
    const created = await createUser(root, { firstName: 'María José', email: 'mj@test.local', password: 'Propia-Pass-9' });
    assert.equal(created.status, 201);
    assert.equal(created.body.temporaryPassword, null);
    const { id } = created.body.user;

    const detail = await root.get(`/api/users/${id}`).expect(200);
    assert.equal(detail.body.user.email, 'mj@test.local');
    assert.equal(detail.body.user.role.code, 'user');

    const updated = await root
      .put(`/api/users/${id}`)
      .set('Origin', ORIGIN)
      .send({ lastName: 'García', roleId: roles.agent })
      .expect(200);
    assert.equal(updated.body.user.lastName, 'García');
    assert.equal(updated.body.user.role.code, 'agent');

    const list = await root.get('/api/users').query({ search: 'mj@test', pageSize: 5 }).expect(200);
    assert.equal(list.body.items.length, 1);
    assert.equal(list.body.pagination.total, 1);

    const filtered = await root.get('/api/users').query({ roleId: roles.superadmin, status: 'active' }).expect(200);
    assert.ok(filtered.body.items.every((u) => u.role.code === 'superadmin'));
  });

  it('rechaza correos duplicados y datos inválidos', async () => {
    const dup = await createUser(root, { email: SUPERADMIN.email });
    assert.equal(dup.status, 409);
    const bad = await createUser(root, { firstName: '', email: 'x', roleId: 999 });
    assert.equal(bad.status, 400);
    const extra = await createUser(root, { isAdmin: true });
    assert.equal(extra.status, 400);
  });

  it('activa/desactiva usuarios y la desactivación cierra sus sesiones', async () => {
    const { agent, user } = await readyUser('agent');
    await agent.get('/api/auth/me').expect(200);

    const off = await root.patch(`/api/users/${user.id}/status`).set('Origin', ORIGIN).send({ status: 'inactive' }).expect(200);
    assert.equal(off.body.user.status, 'inactive');
    await agent.get('/api/auth/me').expect(401);

    const login = await request(app).post('/api/auth/login').send({ email: user.email, password: 'Final-Pass-1' }).expect(403);
    assert.equal(login.body.error.code, 'ACCOUNT_INACTIVE');

    await root.patch(`/api/users/${user.id}/status`).set('Origin', ORIGIN).send({ status: 'active' }).expect(200);
    await request(app).post('/api/auth/login').send({ email: user.email, password: 'Final-Pass-1' }).expect(200);
  });

  it('no permite desactivarse ni eliminarse a uno mismo', async () => {
    const me = await root.get('/api/auth/me');
    await root.patch(`/api/users/${me.body.user.id}/status`).set('Origin', ORIGIN).send({ status: 'inactive' }).expect(403);
    await root.delete(`/api/users/${me.body.user.id}`).set('Origin', ORIGIN).expect(403);
  });

  it('elimina de forma lógica y libera el correo', async () => {
    const created = await createUser(root, { email: 'borrar@test.local' });
    const { id } = created.body.user;
    await root.delete(`/api/users/${id}`).set('Origin', ORIGIN).expect(204);
    await root.get(`/api/users/${id}`).expect(404);
    const again = await createUser(root, { email: 'borrar@test.local' });
    assert.equal(again.status, 201);
  });

  it('nadie puede cambiar su propio rol; un superadmin sí puede degradar a otro', async () => {
    const { agent: other, user } = await readyUser('superadmin');
    await other.put(`/api/users/${user.id}`).set('Origin', ORIGIN).send({ roleId: roles.admin }).expect(403);
    const res = await root.put(`/api/users/${user.id}`).set('Origin', ORIGIN).send({ roleId: roles.admin }).expect(200);
    assert.equal(res.body.user.role.code, 'admin');
  });

  it('restablece la contraseña de otro usuario generando una temporal', async () => {
    const { user } = await readyUser('agent');
    const res = await root.put(`/api/users/${user.id}`).set('Origin', ORIGIN).send({ resetPassword: true }).expect(200);
    assert.ok(res.body.temporaryPassword);
    assert.equal(res.body.user.mustChangePassword, true);
    await request(app).post('/api/auth/login').send({ email: user.email, password: res.body.temporaryPassword }).expect(200);
  });
});

describe('Permisos por rol', () => {
  it('el administrador gestiona usuarios de nivel inferior únicamente', async () => {
    const { agent: admin } = await readyUser('admin');
    await admin.get('/api/users').expect(200);

    const asAgent = await createUser(admin, { roleId: roles.agent });
    assert.equal(asAgent.status, 201);

    // No puede crear superadmins ni otros administradores.
    assert.equal((await createUser(admin, { roleId: roles.superadmin })).status, 403);
    assert.equal((await createUser(admin, { roleId: roles.admin })).status, 403);

    // No puede editar ni desactivar a un superadmin.
    const me = await root.get('/api/auth/me');
    await admin.put(`/api/users/${me.body.user.id}`).set('Origin', ORIGIN).send({ firstName: 'Hack' }).expect(403);
    await admin.patch(`/api/users/${me.body.user.id}/status`).set('Origin', ORIGIN).send({ status: 'inactive' }).expect(403);

    // Puede desactivar a un agente, pero no eliminar (permiso exclusivo de superadmin).
    await admin.patch(`/api/users/${asAgent.body.user.id}/status`).set('Origin', ORIGIN).send({ status: 'inactive' }).expect(200);
    await admin.delete(`/api/users/${asAgent.body.user.id}`).set('Origin', ORIGIN).expect(403);
  });

  for (const role of ['supervisor', 'agent', 'user']) {
    it(`${role}: accede al dashboard pero no a usuarios`, async () => {
      const { agent } = await readyUser(role);
      const dash = await agent.get('/api/dashboard/summary').expect(200);
      assert.equal(dash.body.users, null);
      await agent.get('/api/users').expect(403);
      await agent.get('/api/roles').expect(403);
      assert.equal((await createUser(agent)).status, 403);
    });
  }

  it('un cambio de rol se aplica de inmediato y cierra las sesiones del usuario', async () => {
    const { agent, user } = await readyUser('admin');
    await agent.get('/api/users').expect(200);
    await root.put(`/api/users/${user.id}`).set('Origin', ORIGIN).send({ roleId: roles.user }).expect(200);
    await agent.get('/api/users').expect(401);
    const { agent: again } = await loginAs(user.email, 'Final-Pass-1');
    await again.get('/api/users').expect(403);
  });
});

describe('Dashboard', () => {
  it('muestra indicadores de usuarios a quien puede verlos', async () => {
    const res = await root.get('/api/dashboard/summary').expect(200);
    assert.ok(res.body.users.total >= 1);
    assert.equal(res.body.users.total, res.body.users.active + res.body.users.inactive);
    assert.equal(res.body.users.byRole.length, 5);
  });

  it('rechaza IDs y rutas no válidas', async () => {
    await root.get('/api/users/abc').expect(400);
    await root.get('/api/users/999999').expect(404);
    await root.get('/api/no-existe').expect(404);
    // Sin sesión no se revela qué rutas existen.
    await browser().get('/api/no-existe').expect(401);
  });
});
