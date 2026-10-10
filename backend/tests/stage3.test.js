import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pool, query } from '../config/database.js';
import { RoleModel } from '../models/role.model.js';
import { UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';
import { ORIGIN, SUPERADMIN, loginAs, resetDatabase } from './helpers.js';

const PASSWORD = 'Final-Pass-1';
let root;
let roles;
let ti; // departamento TI
let rh; // departamento RH

const send = (agent, method, url, body) => agent[method](url).set('Origin', ORIGIN).send(body);

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

const createCategory = (agent, body) => send(agent, 'post', '/api/categories', body);
const createType = (agent, body) => send(agent, 'post', '/api/ticket-types', { name: 'Tipo', code: `T${Math.random().toString(36).slice(2, 7)}`, ...body });

before(async () => {
  await resetDatabase();
  ({ agent: root } = await loginAs(SUPERADMIN.email, SUPERADMIN.password));
  roles = Object.fromEntries((await root.get('/api/roles')).body.roles.map((r) => [r.code, r.id]));
  ti = (await send(root, 'post', '/api/departments', { name: 'Tecnologías de la Información', code: 'TI' })).body.department;
  rh = (await send(root, 'post', '/api/departments', { name: 'Recursos Humanos', code: 'RH' })).body.department;
});

after(() => pool.end());

describe('Categorías', () => {
  it('crea, lista y ordena categorías por departamento', async () => {
    const hw = (await createCategory(root, { departmentId: ti.id, name: 'Hardware' }).expect(201)).body.category;
    const sw = (await createCategory(root, { departmentId: ti.id, name: 'Software', description: 'Programas y licencias' }).expect(201)).body.category;
    await createCategory(root, { departmentId: rh.id, name: 'Vacaciones' }).expect(201);
    assert.equal(hw.sortOrder, 1);
    assert.equal(sw.sortOrder, 2);

    const reordered = await send(root, 'put', '/api/categories/order', { departmentId: ti.id, ids: [sw.id, hw.id] }).expect(200);
    assert.deepEqual(reordered.body.items.map((c) => c.name), ['Software', 'Hardware']);

    // La lista debe ser exactamente la del departamento.
    await send(root, 'put', '/api/categories/order', { departmentId: ti.id, ids: [sw.id] }).expect(400);

    const list = await root.get('/api/categories').query({ departmentId: ti.id }).expect(200);
    assert.equal(list.body.items.length, 2);
    const search = await root.get('/api/categories').query({ search: 'vacac' }).expect(200);
    assert.deepEqual(search.body.items.map((c) => c.department.code), ['RH']);
  });

  it('valida nombre duplicado y datos', async () => {
    const dup = await createCategory(root, { departmentId: ti.id, name: 'Hardware' }).expect(409);
    assert.equal(dup.body.error.message, 'Ya existe una categoría con ese nombre en el departamento.');
    // El mismo nombre en otro departamento sí está permitido.
    await createCategory(root, { departmentId: rh.id, name: 'Hardware' }).expect(201);
    const bad = await createCategory(root, { departmentId: 'x', name: '' }).expect(400);
    assert.ok(bad.body.error.details.departmentId && bad.body.error.details.name);
  });

  it('edita y activa/desactiva', async () => {
    const cat = (await createCategory(root, { departmentId: rh.id, name: 'Permisos' })).body.category;
    const upd = await send(root, 'put', `/api/categories/${cat.id}`, { description: 'Permisos con goce' }).expect(200);
    assert.equal(upd.body.category.description, 'Permisos con goce');
    const off = await send(root, 'patch', `/api/categories/${cat.id}/status`, { status: 'inactive' }).expect(200);
    assert.equal(off.body.category.status, 'inactive');
    const inactive = await root.get('/api/categories').query({ status: 'inactive' }).expect(200);
    assert.ok(inactive.body.items.some((c) => c.id === cat.id));
  });
});

describe('Tipos de solicitud', () => {
  let hardware;
  before(async () => {
    hardware = (await root.get('/api/categories').query({ departmentId: ti.id, search: 'Hardware' })).body.items[0];
  });

  it('crea un tipo con categoría, prioridad y responsable del departamento', async () => {
    const { user: agentTi } = await readyUser('agent', ti.id);
    const res = await createType(root, {
      departmentId: ti.id,
      categoryId: hardware.id,
      name: 'Problema con computadora',
      code: 'ti-pc',
      description: 'Fallas de equipo',
      defaultPriority: 'high',
      assignmentMode: 'user',
      assigneeUserId: agentTi.id,
    }).expect(201);
    const t = res.body.ticketType;
    assert.equal(t.code, 'TI-PC');
    assert.equal(t.category.name, 'Hardware');
    assert.equal(t.defaultPriorityLabel, 'Alta');
    assert.equal(t.assignee.id, agentTi.id);
    assert.equal(t.formVersion, 1);

    const opts = await root.get('/api/ticket-types/assignee-options').query({ departmentId: ti.id }).expect(200);
    assert.ok(opts.body.users.some((u) => u.id === agentTi.id && u.isAgent));
  });

  it('valida código, categoría de otro departamento y responsable ajeno', async () => {
    const dup = await createType(root, { departmentId: ti.id, code: 'TI-PC' }).expect(409);
    assert.equal(dup.body.error.code, 'TICKET_TYPE_CODE_TAKEN');
    // El mismo código en otro departamento sí se permite.
    await createType(root, { departmentId: rh.id, code: 'TI-PC' }).expect(201);

    const vacaciones = (await root.get('/api/categories').query({ search: 'Vacaciones' })).body.items[0];
    const wrongCat = await createType(root, { departmentId: ti.id, categoryId: vacaciones.id }).expect(400);
    assert.ok(wrongCat.body.error.details.categoryId);

    const { user: rhUser } = await readyUser('agent', rh.id);
    const wrongUser = await createType(root, { departmentId: ti.id, assignmentMode: 'user', assigneeUserId: rhUser.id }).expect(400);
    assert.ok(wrongUser.body.error.details.assigneeUserId);
    await createType(root, { departmentId: ti.id, assignmentMode: 'user' }).expect(400);
    await createType(root, { departmentId: ti.id, defaultPriority: 'altisima' }).expect(400);
  });

  it('el departamento no se puede cambiar al editar; lista, filtra y ordena', async () => {
    const a = (await createType(root, { departmentId: ti.id, name: 'Solicitud de software', code: 'SW' })).body.ticketType;
    await send(root, 'put', `/api/ticket-types/${a.id}`, { departmentId: rh.id }).expect(400);
    const upd = await send(root, 'put', `/api/ticket-types/${a.id}`, { name: 'Instalación de software', defaultPriority: 'low' }).expect(200);
    assert.equal(upd.body.ticketType.name, 'Instalación de software');

    const list = await root.get('/api/ticket-types').query({ departmentId: ti.id }).expect(200);
    const ids = list.body.items.map((t) => t.id);
    await send(root, 'put', '/api/ticket-types/order', { departmentId: ti.id, ids: [...ids].reverse() }).expect(204);
    const after = await root.get('/api/ticket-types').query({ departmentId: ti.id }).expect(200);
    assert.deepEqual(after.body.items.map((t) => t.id), [...ids].reverse());

    const filtered = await root.get('/api/ticket-types').query({ search: 'software' }).expect(200);
    assert.equal(filtered.body.items.length, 1);
    await send(root, 'patch', `/api/ticket-types/${a.id}/status`, { status: 'inactive' }).expect(200);
    const inactive = await root.get('/api/ticket-types').query({ status: 'inactive' }).expect(200);
    assert.ok(inactive.body.items.some((t) => t.id === a.id));
  });
});

describe('Constructor de formularios', () => {
  let type;
  const FIELDS = [
    { label: 'Empleado', type: 'user', required: true },
    { label: 'Número de empleado', type: 'short_text', rules: { minLength: 3, maxLength: 10 } },
    { label: 'Equipo', type: 'asset', required: true, options: [{ label: 'LAP-023' }, { label: 'PC-104' }] },
    {
      label: 'Tipo de problema',
      type: 'select',
      required: true,
      options: [{ label: 'No enciende' }, { label: 'Pantalla rota' }, { label: 'Otro' }],
    },
    { label: 'Describe el problema', key: 'otro_detalle', type: 'long_text', required: true, rules: { showIf: { field: 'tipo_de_problema', op: 'equals', value: 'otro' } } },
    { label: 'Costo estimado', type: 'currency', rules: { min: 0, max: 50000 } },
    { label: 'Evidencia', type: 'image', rules: { maxFiles: 2, maxSizeMb: 5 } },
    { label: 'Nota interna', type: 'long_text', visibleToRequester: false },
    { label: '¿Urgente?', type: 'boolean', defaultValue: false },
  ];

  before(async () => {
    type = (await createType(root, { departmentId: ti.id, name: 'Solicitud de computadora', code: 'PC-REQ' })).body.ticketType;
  });

  it('guarda un formulario completo generando nombres internos y valores de opciones', async () => {
    const res = await send(root, 'put', `/api/ticket-types/${type.id}/form`, { fields: FIELDS }).expect(200);
    const { fields, ticketType } = res.body;
    assert.equal(fields.length, FIELDS.length);
    assert.deepEqual(fields.slice(0, 4).map((f) => f.key), ['empleado', 'numero_de_empleado', 'equipo', 'tipo_de_problema']);
    assert.deepEqual(fields[3].options.map((o) => o.value), ['no_enciende', 'pantalla_rota', 'otro']);
    assert.equal(fields[5].rules.currency, 'MXN');
    assert.equal(ticketType.formVersion, 2);
    assert.equal(ticketType.fieldsCount, FIELDS.length);
  });

  it('rechaza definiciones incoherentes con errores por campo', async () => {
    const cases = [
      [{ label: 'Lista', type: 'select', options: [] }, 'fields.0.options'],
      [{ label: 'Texto', type: 'short_text', rules: { minLength: 10, maxLength: 5 } }, 'fields.0.rules.minLength'],
      [{ label: 'Num', type: 'number', rules: { min: 10, max: 1 } }, 'fields.0.rules.min'],
      [{ label: 'Correo', type: 'email', defaultValue: 'no-es-correo' }, 'fields.0.defaultValue'],
      [{ label: 'Archivo', type: 'file', defaultValue: 'x' }, 'fields.0.defaultValue'],
      [{ label: 'Invisible', type: 'short_text', visibleToRequester: false, visibleToAgent: false }, 'fields.0.visibleToRequester'],
    ];
    for (const [field, key] of cases) {
      const res = await send(root, 'put', `/api/ticket-types/${type.id}/form`, { fields: [field] }).expect(400);
      assert.ok(res.body.error.details[key], `${key}: ${JSON.stringify(res.body.error.details)}`);
    }
    // Condición que depende de un campo posterior (o inexistente).
    const cond = await send(root, 'put', `/api/ticket-types/${type.id}/form`, {
      fields: [
        { label: 'A', type: 'short_text', rules: { showIf: { field: 'b', op: 'is_filled' } } },
        { label: 'B', key: 'b', type: 'short_text' },
      ],
    }).expect(400);
    assert.ok(cond.body.error.details['fields.0.rules.showIf']);
    // Tipo no válido y claves desconocidas.
    await send(root, 'put', `/api/ticket-types/${type.id}/form`, { fields: [{ label: 'X', type: 'script' }] }).expect(400);
    await send(root, 'put', `/api/ticket-types/${type.id}/form`, { fields: [{ label: 'X', type: 'short_text', onclick: 'x' }] }).expect(400);
    // El formulario guardado no cambió.
    const current = await root.get(`/api/ticket-types/${type.id}/form`).expect(200);
    assert.equal(current.body.fields.length, FIELDS.length);
  });

  it('operaciones granulares sobre campos y opciones', async () => {
    const { fields } = (await root.get(`/api/ticket-types/${type.id}/fields`)).body;
    const select = fields.find((f) => f.key === 'tipo_de_problema');

    // Agregar campo
    const added = await send(root, 'post', `/api/ticket-types/${type.id}/fields`, { label: 'Ubicación', type: 'location', options: [{ label: 'Piso 1' }] }).expect(201);
    assert.equal(added.body.field.key, 'ubicacion');

    // Editar solo la etiqueta (no debe resetear "required" ni otras propiedades)
    const upd = await send(root, 'put', `/api/form-fields/${select.id}`, { label: 'Problema' }).expect(200);
    assert.equal(upd.body.field.label, 'Problema');
    assert.equal(upd.body.field.required, true);
    assert.equal(upd.body.field.options.length, 3);

    // Opciones: agregar, editar, desactivar, eliminar
    const opt = await send(root, 'post', `/api/form-fields/${select.id}/options`, { label: 'Teclado' }).expect(201);
    assert.equal(opt.body.option.value, 'teclado');
    await send(root, 'put', `/api/field-options/${opt.body.option.id}`, { label: 'Teclado o mouse', isActive: false }).expect(200);
    const options = (await root.get(`/api/form-fields/${select.id}/options`)).body.options;
    assert.equal(options.find((o) => o.id === opt.body.option.id).label, 'Teclado o mouse');
    await root.delete(`/api/field-options/${opt.body.option.id}`).set('Origin', ORIGIN).expect(204);

    // No se puede borrar un campo del que depende otro
    const del = await root.delete(`/api/form-fields/${select.id}`).set('Origin', ORIGIN).expect(409);
    assert.equal(del.body.error.code, 'FIELD_HAS_DEPENDENTS');
    // Desactivar y eliminar el campo agregado
    await send(root, 'patch', `/api/form-fields/${added.body.field.id}/status`, { status: 'inactive' }).expect(200);
    await root.delete(`/api/form-fields/${added.body.field.id}`).set('Origin', ORIGIN).expect(204);

    // Reordenar
    const ids = (await root.get(`/api/ticket-types/${type.id}/fields`)).body.fields.map((f) => f.id);
    const swapped = [ids[1], ids[0], ...ids.slice(2)];
    const re = await send(root, 'put', `/api/ticket-types/${type.id}/fields/order`, { ids: swapped }).expect(200);
    assert.deepEqual(re.body.fields.map((f) => f.id), swapped);
    // Restaurar orden original (la condición depende de un campo anterior)
    await send(root, 'put', `/api/ticket-types/${type.id}/fields/order`, { ids }).expect(200);
    // Mover el campo condicionado antes de su origen debe fallar
    const bad = [...ids];
    const iDep = bad.findIndex((id) => id === fields.find((f) => f.key === 'otro_detalle').id);
    [bad[0], bad[iDep]] = [bad[iDep], bad[0]];
    await send(root, 'put', `/api/ticket-types/${type.id}/fields/order`, { ids: bad }).expect(400);
  });

  it('valida valores enviados: obligatorios, formatos, reglas y condiciones', async () => {
    const empty = await send(root, 'post', `/api/ticket-types/${type.id}/form/validate`, { values: {} }).expect(200);
    assert.equal(empty.body.valid, false);
    assert.ok(empty.body.errors.empleado && empty.body.errors.equipo && empty.body.errors.tipo_de_problema);
    assert.equal(empty.body.errors.otro_detalle, undefined); // oculto por la condición

    const me = (await root.get('/api/auth/me')).body.user;
    const bad = await send(root, 'post', `/api/ticket-types/${type.id}/form/validate`, {
      values: {
        empleado: me.id,
        numero_de_empleado: 'ab',
        equipo: 'inventado',
        tipo_de_problema: 'otro',
        costo_estimado: 12.345,
        evidencia: [{ name: 'virus.exe', size: 10 }],
        nota_interna: 'no debería enviarse',
      },
    }).expect(200);
    for (const key of ['numero_de_empleado', 'equipo', 'otro_detalle', 'costo_estimado', 'evidencia']) assert.ok(bad.body.errors[key], key);
    assert.match(bad.body.errors._, /nota_interna/);

    const ok = await send(root, 'post', `/api/ticket-types/${type.id}/form/validate`, {
      values: {
        empleado: me.id,
        numero_de_empleado: 'E-1024',
        equipo: 'lap_023',
        tipo_de_problema: 'no_enciende',
        otro_detalle: 'se ignora porque está oculto',
        costo_estimado: '1500.50',
        evidencia: [{ name: 'foto.jpg', size: 1000 }],
        urgente: true,
      },
    }).expect(200);
    assert.equal(ok.body.valid, true, JSON.stringify(ok.body.errors));
    assert.equal(ok.body.values.costo_estimado, 1500.5);
    assert.equal(ok.body.values.otro_detalle, undefined);
  });

  it('valida un borrador sin guardarlo (vista previa del constructor)', async () => {
    const res = await send(root, 'post', `/api/ticket-types/${type.id}/form/validate`, {
      fields: [{ label: 'Correo de contacto', type: 'email', required: true }],
      values: { correo_de_contacto: 'mal' },
    }).expect(200);
    assert.ok(res.body.errors.correo_de_contacto);
    const saved = (await root.get(`/api/ticket-types/${type.id}/form`)).body.fields;
    assert.ok(!saved.some((f) => f.key === 'correo_de_contacto'));
  });
});

describe('Catálogo de solicitudes (preparado para tickets)', () => {
  it('muestra solo tipos activos con su formulario para el solicitante', async () => {
    const { agent: user } = await readyUser('user');
    const catalog = (await user.get('/api/request-catalog').expect(200)).body.departments;
    const tiCat = catalog.find((d) => d.code === 'TI');
    const allTypes = [...tiCat.types, ...tiCat.categories.flatMap((c) => c.types)];
    assert.ok(allTypes.some((t) => t.code === 'PC-REQ'));
    assert.ok(!allTypes.some((t) => t.code === 'SW')); // inactivo

    const pcReq = allTypes.find((t) => t.code === 'PC-REQ');
    const form = (await user.get(`/api/request-catalog/types/${pcReq.id}/form`).expect(200)).body;
    assert.ok(!form.fields.some((f) => f.key === 'nota_interna')); // solo para agentes
    assert.ok(!('id' in form.fields[0])); // sin datos internos
    const users = (await user.get('/api/request-catalog/lookups/users').expect(200)).body.users;
    assert.ok(users.length > 0 && !('email' in users[0]));
    const res = await send(user, 'post', `/api/request-catalog/types/${pcReq.id}/validate`, { values: {} }).expect(200);
    assert.equal(res.body.valid, false);
  });

  it('una categoría inactiva oculta sus tipos del catálogo', async () => {
    const cat = (await createCategory(root, { departmentId: ti.id, name: 'Redes' })).body.category;
    const t = (await createType(root, { departmentId: ti.id, categoryId: cat.id, code: 'RED' })).body.ticketType;
    const visible = async () => {
      const deps = (await root.get('/api/request-catalog')).body.departments;
      return deps.flatMap((d) => [...d.types, ...d.categories.flatMap((c) => c.types)]).some((x) => x.id === t.id);
    };
    assert.equal(await visible(), true);
    await send(root, 'patch', `/api/categories/${cat.id}/status`, { status: 'inactive' }).expect(200);
    assert.equal(await visible(), false);
    await root.get(`/api/request-catalog/types/${t.id}/form`).expect(404);
  });
});

describe('Permisos y alcance por departamento', () => {
  it('agente y usuario no pueden ver ni modificar la configuración', async () => {
    for (const role of ['agent', 'user']) {
      const { agent } = await readyUser(role, ti.id);
      await agent.get('/api/categories').expect(403);
      await agent.get('/api/ticket-types').expect(403);
      await createCategory(agent, { departmentId: ti.id, name: 'Hack' }).expect(403);
      await createType(agent, { departmentId: ti.id }).expect(403);
      const anyType = (await root.get('/api/ticket-types')).body.items[0];
      await agent.get(`/api/ticket-types/${anyType.id}/form`).expect(403);
      await send(agent, 'put', `/api/ticket-types/${anyType.id}/form`, { fields: [] }).expect(403);
      await agent.get('/api/request-catalog').expect(200);
    }
  });

  it('el supervisor solo configura los departamentos de los que es responsable', async () => {
    const { agent: sup, user } = await readyUser('supervisor', ti.id);
    // Aún no es responsable: no ve nada y no puede crear.
    assert.equal((await sup.get('/api/categories').expect(200)).body.items.length, 0);
    await createCategory(sup, { departmentId: ti.id, name: 'Impresoras' }).expect(403);

    await send(root, 'put', `/api/departments/${ti.id}`, { managerId: user.id }).expect(200);
    const list = (await sup.get('/api/categories').expect(200)).body;
    assert.equal(list.scope, 'managed');
    assert.ok(list.items.every((c) => c.department.code === 'TI'));
    await createCategory(sup, { departmentId: ti.id, name: 'Impresoras' }).expect(201);
    await createCategory(sup, { departmentId: rh.id, name: 'Hack' }).expect(403);

    const rhType = (await root.get('/api/ticket-types').query({ departmentId: rh.id })).body.items[0];
    await sup.get(`/api/ticket-types/${rhType.id}`).expect(403);
    await send(sup, 'put', `/api/ticket-types/${rhType.id}/form`, { fields: [] }).expect(403);
    const own = (await sup.get('/api/ticket-types')).body.items;
    assert.ok(own.length > 0 && own.every((t) => t.department.code === 'TI'));
  });
});

describe('Aislamiento multiempresa', () => {
  let outsider;
  let rootType;
  let rootField;

  before(async () => {
    const [res] = await pool.query("INSERT INTO companies (name) VALUES ('Empresa B')");
    const role = await RoleModel.findByCode('superadmin');
    await UserModel.create({
      companyId: res.insertId,
      firstName: 'Admin',
      lastName: 'B',
      email: 'admin@empresa-b.local',
      passwordHash: await hashPassword(PASSWORD),
      roleId: role.id,
      status: 'active',
      mustChangePassword: false,
    });
    ({ agent: outsider } = await loginAs('admin@empresa-b.local', PASSWORD));
    rootType = (await root.get('/api/ticket-types').query({ search: 'PC-REQ' })).body.items[0];
    rootField = (await root.get(`/api/ticket-types/${rootType.id}/fields`)).body.fields[0];
  });

  it('la empresa B tiene su propio TI con su propio tipo, sin ver los de A', async () => {
    const tiB = (await send(outsider, 'post', '/api/departments', { name: 'TI B', code: 'TI' }).expect(201)).body.department;
    const tB = (await createType(outsider, { departmentId: tiB.id, name: 'Solicitud de equipo', code: 'PC-REQ' }).expect(201)).body.ticketType;
    const mine = (await outsider.get('/api/ticket-types')).body.items;
    assert.deepEqual(mine.map((t) => t.id), [tB.id]);
    assert.equal((await outsider.get('/api/categories')).body.items.length, 0);
    const catalog = (await outsider.get('/api/request-catalog')).body.departments;
    assert.deepEqual(catalog.map((d) => d.name), ['TI B']);
  });

  it('no puede leer ni modificar configuraciones de la empresa A cambiando ids', async () => {
    const cat = (await root.get('/api/categories')).body.items[0];
    await outsider.get(`/api/categories/${cat.id}`).expect(404);
    await send(outsider, 'put', `/api/categories/${cat.id}`, { name: 'Hack' }).expect(404);
    await outsider.get(`/api/ticket-types/${rootType.id}`).expect(404);
    await outsider.get(`/api/ticket-types/${rootType.id}/form`).expect(404);
    await send(outsider, 'put', `/api/ticket-types/${rootType.id}/form`, { fields: [] }).expect(404);
    await send(outsider, 'put', `/api/form-fields/${rootField.id}`, { label: 'Hack' }).expect(404);
    await outsider.delete(`/api/form-fields/${rootField.id}`).set('Origin', ORIGIN).expect(404);
    const optField = (await root.get(`/api/ticket-types/${rootType.id}/fields`)).body.fields.find((f) => f.options.length);
    await send(outsider, 'put', `/api/field-options/${optField.options[0].id}`, { label: 'Hack' }).expect(404);
    await outsider.get(`/api/request-catalog/types/${rootType.id}/form`).expect(404);
    await createCategory(outsider, { departmentId: ti.id, name: 'Hack' }).expect(400);
    await createType(outsider, { departmentId: ti.id }).expect(400);
    // El campo de la empresa A sigue intacto.
    const fields = (await root.get(`/api/ticket-types/${rootType.id}/fields`)).body.fields;
    assert.equal(fields[0].label, rootField.label);
  });

  it('los usuarios de A no son válidos en formularios de B', async () => {
    const tB = (await outsider.get('/api/ticket-types')).body.items[0];
    await send(outsider, 'put', `/api/ticket-types/${tB.id}/form`, { fields: [{ label: 'Empleado', type: 'user', required: true }] }).expect(200);
    const res = await send(outsider, 'post', `/api/ticket-types/${tB.id}/form/validate`, { values: { empleado: 1 } }).expect(200);
    assert.ok(res.body.errors.empleado);
  });

  it('la base de datos impide relaciones cruzadas aunque fallara la aplicación', async () => {
    const vacaciones = (await root.get('/api/categories').query({ search: 'Vacaciones' })).body.items[0];
    await assert.rejects(query('UPDATE ticket_types SET category_id = ? WHERE id = ?', [vacaciones.id, rootType.id]), /foreign key/i);
  });
});

describe('Auditoría', () => {
  it('registra la configuración del catálogo', async () => {
    const actions = (await query('SELECT DISTINCT action FROM audit_logs')).map((r) => r.action);
    for (const a of ['category.created', 'category.updated', 'category.status_changed', 'category.reordered', 'ticket_type.created', 'ticket_type.updated', 'ticket_type.status_changed', 'ticket_type.reordered', 'form.updated']) {
      assert.ok(actions.includes(a), a);
    }
  });
});
