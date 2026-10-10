import mysql from 'mysql2/promise';
import request from 'supertest';
import { env } from '../config/env.js';
import { migrate } from '../database/migrate.js';
import { seed } from '../database/seed.js';
import { createApp } from '../app.js';
import { RoleModel } from '../models/role.model.js';
import { UserModel } from '../models/user.model.js';
import { hashPassword } from '../utils/password.js';

if (!env.isTest || !env.db.name.endsWith('_test')) {
  throw new Error('Las pruebas solo pueden ejecutarse contra una base de datos *_test');
}

export const app = createApp();
export const ORIGIN = env.corsOrigins[0];
export const SUPERADMIN = { email: 'root@test.local', password: 'Root-Pass-123' };

/** Recrea la base de datos de pruebas desde cero y crea un superadmin. */
export async function resetDatabase() {
  const conn = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
  });
  await conn.query(`DROP DATABASE IF EXISTS \`${env.db.name}\``);
  await conn.end();
  await migrate({ log: () => {} });
  await seed({ log: () => {} });

  const role = await RoleModel.findByCode('superadmin');
  await UserModel.create({
    companyId: 1,
    firstName: 'Root',
    lastName: 'Admin',
    email: SUPERADMIN.email,
    passwordHash: await hashPassword(SUPERADMIN.password),
    roleId: role.id,
    status: 'active',
    mustChangePassword: false,
  });
}

/** Agente HTTP que conserva cookies entre peticiones (como un navegador). */
export function browser() {
  return request.agent(app);
}

export async function loginAs(email, password, rememberMe = false) {
  const agent = browser();
  const res = await agent.post('/api/auth/login').set('Origin', ORIGIN).send({ email, password, rememberMe });
  return { agent, res };
}
