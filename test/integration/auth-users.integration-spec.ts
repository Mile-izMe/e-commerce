import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { DATABASE } from '../../src/infrastructure/database/database.constants.js';
import { createDatabase } from '../../src/prisma/db.js';
import type { DatabaseClient } from '../../src/prisma/db.js';
import type { AuthResponseDto } from '../../src/modules/auth/dto/auth-response.dto.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

describe('Auth and Users HTTP integration (real PostgreSQL)', () => {
  let app: INestApplication<App> | undefined;
  let database: DatabaseClient;
  let jwt: JwtService;
  const userIds: string[] = [];
  const prefix = `authit-${randomUUID().slice(0, 8)}`;
  const password = 'Correct horse battery staple 2026!';
  const http = () => request(app!.getHttpServer());

  async function register(suffix = randomUUID().slice(0, 8)) {
    const email = `${prefix}-${suffix}@example.com`;
    const username = `u_${randomUUID().replace(/-/g, '').slice(0, 25)}`;
    const response = await http().post('/auth/register').send({
      email: email.toUpperCase(),
      username: username.toUpperCase(),
      password,
      name: 'Alice',
    });
    if (response.status !== 201)
      throw new Error(`Registration failed: ${JSON.stringify(response.body)}`);
    const auth = response.body as AuthResponseDto;
    userIds.push(auth.user.id);
    return { auth, email, username };
  }

  beforeAll(async () => {
    process.env.JWT_SECRET ??=
      'local-integration-test-secret-with-at-least-32-bytes';
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl)
      throw new Error(
        'Set TEST_DATABASE_URL to a dedicated PostgreSQL test database',
      );
    const parsed = new URL(testUrl);
    if (!decodeURIComponent(parsed.pathname).endsWith('_test'))
      throw new Error('Test database name must end with _test');
    if (process.env.DATABASE_URL) {
      const development = new URL(process.env.DATABASE_URL);
      if (
        parsed.host === development.host &&
        parsed.pathname === development.pathname
      )
        throw new Error(
          'Never use the development database for integration tests',
        );
    }
    const cli = path.join(
      path.dirname(require.resolve('prisma/package.json')),
      'dist/prisma.js',
    );
    execFileSync(process.execPath, [cli, 'db', 'migrate', '--yes'], {
      cwd: root,
      env: { ...process.env, DATABASE_URL: testUrl },
      stdio: 'pipe',
    });
    database = createDatabase(testUrl);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(database)
      .compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    try {
      if (database)
        for (const id of userIds)
          await database.orm.public.User.where({ id }).delete();
    } finally {
      if (app) await app.close();
      else if (database) await database.close();
    }
  });

  it('registers a customer with Argon2id and never returns the password hash', async () => {
    const { auth, email, username } = await register();
    expect(auth).toMatchObject({
      tokenType: 'Bearer',
      expiresIn: 900,
      user: {
        email,
        username,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        name: 'Alice',
      },
    });
    expect(auth.accessToken).toEqual(expect.any(String));
    expect(JSON.stringify(auth)).not.toContain('passwordHash');
    expect(JSON.stringify(auth)).not.toContain(password);
    const stored = await database.orm.public.User.where({
      id: auth.user.id,
    }).first();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
    expect(stored?.passwordHash).not.toBe(password);
    const profile = await http()
      .get('/users/me')
      .auth(auth.accessToken, { type: 'bearer' })
      .expect(200);
    expect(profile.body).toEqual(auth.user);
    expect(JSON.stringify(profile.body)).not.toContain('passwordHash');
  });

  it('logs in by username or email, rejects invalid credentials and records last login', async () => {
    const { auth, email, username } = await register();
    await http()
      .post('/auth/login')
      .send({ identifier: username, password: 'wrong-password' })
      .expect(401);
    await http()
      .post('/auth/login')
      .send({ identifier: 'nonexistent', password })
      .expect(401);
    const byName = await http()
      .post('/auth/login')
      .send({ identifier: username.toUpperCase(), password })
      .expect(200);
    const byEmail = await http()
      .post('/auth/login')
      .send({ identifier: email.toUpperCase(), password })
      .expect(200);
    expect((byName.body as AuthResponseDto).user.id).toBe(auth.user.id);
    expect((byEmail.body as AuthResponseDto).user.id).toBe(auth.user.id);
    const stored = await database.orm.public.User.where({
      id: auth.user.id,
    }).first();
    expect(stored?.lastLoginAt).not.toBeNull();
  });

  it('rejects duplicate email and username without leaking account fields', async () => {
    const { email, username } = await register();
    const duplicate = { email, username: 'another_user', password };
    await http().post('/auth/register').send(duplicate).expect(409);
    await http()
      .post('/auth/register')
      .send({ ...duplicate, email: `${randomUUID()}@example.test`, username })
      .expect(409);
  });

  it('validates registration and login bodies', async () => {
    await http()
      .post('/auth/register')
      .send({ email: 'bad', username: 'a', password: 'short', role: 'ADMIN' })
      .expect(400);
    await http()
      .post('/auth/login')
      .send({ identifier: 'alice', password, role: 'ADMIN' })
      .expect(400);
    await http()
      .post('/auth/login')
      .send({ username: 'alice', password })
      .expect(400);
  });

  it('updates only allowed profile fields and accepts explicit clearing', async () => {
    const { auth } = await register();
    const bearer = (path: string) =>
      http().patch(path).auth(auth.accessToken, { type: 'bearer' });
    const changed = await bearer('/users/me')
      .send({ name: 'New name', phone: '+84901234567' })
      .expect(200);
    expect(changed.body).toMatchObject({
      name: 'New name',
      phone: '+84901234567',
      role: 'CUSTOMER',
    });
    await bearer('/users/me').send({ role: 'ADMIN' }).expect(400);
    await bearer('/users/me').send({ passwordHash: 'attacker' }).expect(400);
    await bearer('/users/me').send({}).expect(400);
    await bearer('/users/me').send({ name: '   ' }).expect(400);
    const cleared = await bearer('/users/me')
      .send({ name: null, phone: null })
      .expect(200);
    expect(cleared.body).toMatchObject({
      name: null,
      phone: null,
      role: 'CUSTOMER',
    });
  });

  it('creates, lists, updates and deletes a user-owned shipping address', async () => {
    const { auth } = await register();
    const bearer = (
      method: 'get' | 'post' | 'patch' | 'delete',
      path: string,
    ) => http()[method](path).auth(auth.accessToken, { type: 'bearer' });
    const empty = await bearer('get', '/users/me/addresses').expect(200);
    expect(empty.body).toEqual([]);
    const created = await bearer('post', '/users/me/addresses')
      .send({
        recipientName: 'Alice',
        phone: '+84901234567',
        addressLine1: '12 Test Street',
        city: 'Da Nang',
        countryCode: 'vn',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      userId: auth.user.id,
      city: 'Da Nang',
      countryCode: 'VN',
    });
    const addressId = (created.body as { id: string }).id;
    const listed = await bearer('get', '/users/me/addresses').expect(200);
    expect(listed.body).toHaveLength(1);
    const updated = await bearer('patch', `/users/me/addresses/${addressId}`)
      .send({ city: 'Ha Noi', label: 'Home' })
      .expect(200);
    expect(updated.body).toMatchObject({ city: 'Ha Noi', label: 'Home' });
    await bearer('delete', `/users/me/addresses/${addressId}`).expect(204);
    expect(
      (await bearer('get', '/users/me/addresses').expect(200)).body,
    ).toEqual([]);
    await bearer('delete', `/users/me/addresses/${addressId}`).expect(404);
  });

  it('does not expose or modify another user address', async () => {
    const owner = await register();
    const outsider = await register();
    const created = await http()
      .post('/users/me/addresses')
      .auth(owner.auth.accessToken, { type: 'bearer' })
      .send({
        recipientName: 'Owner',
        phone: '+84901234567',
        addressLine1: '12 Test Street',
        city: 'Da Nang',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    expect(
      (
        await http()
          .get('/users/me/addresses')
          .auth(outsider.auth.accessToken, { type: 'bearer' })
          .expect(200)
      ).body,
    ).toEqual([]);
    await http()
      .patch(`/users/me/addresses/${id}`)
      .auth(outsider.auth.accessToken, { type: 'bearer' })
      .send({ city: 'Wrong' })
      .expect(404);
    await http()
      .delete(`/users/me/addresses/${id}`)
      .auth(outsider.auth.accessToken, { type: 'bearer' })
      .expect(404);
    expect(
      (
        await http()
          .get('/users/me/addresses')
          .auth(owner.auth.accessToken, { type: 'bearer' })
          .expect(200)
      ).body,
    ).toHaveLength(1);
  });

  it('validates address fields and ignores client-selected ownership', async () => {
    const { auth } = await register();
    const bearer = http()
      .post('/users/me/addresses')
      .auth(auth.accessToken, { type: 'bearer' });
    await bearer
      .send({
        recipientName: '',
        phone: 'bad',
        addressLine1: ' ',
        city: '',
        userId: randomUUID(),
      })
      .expect(400);
    await http()
      .post('/users/me/addresses')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({
        recipientName: 'Alice',
        phone: '+84901234567',
        addressLine1: '12 Test Street',
        city: 'Da Nang',
        userId: randomUUID(),
      })
      .expect(400);
    const created = await http()
      .post('/users/me/addresses')
      .auth(auth.accessToken, { type: 'bearer' })
      .send({
        recipientName: 'Alice',
        phone: '+84901234567',
        addressLine1: '12 Test Street',
        city: 'Da Nang',
      })
      .expect(201);
    const id = (created.body as { id: string }).id;
    await http()
      .patch(`/users/me/addresses/${id}`)
      .auth(auth.accessToken, { type: 'bearer' })
      .send({})
      .expect(400);
    await http()
      .patch(`/users/me/addresses/${id}`)
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ userId: randomUUID() })
      .expect(400);
    await http()
      .patch(`/users/me/addresses/${id}`)
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ city: '  ' })
      .expect(400);
    await http()
      .patch(`/users/me/addresses/${id}`)
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ city: null })
      .expect(400);
    await http()
      .patch(`/users/me/addresses/${id}`)
      .auth(auth.accessToken, { type: 'bearer' })
      .send({ phone: null })
      .expect(400);
  });

  it('rejects missing, forged, expired and malformed-subject JWTs', async () => {
    const { auth } = await register();
    await http().get('/users/me').expect(401);
    await http()
      .get('/users/me')
      .auth(`${auth.accessToken}x`, { type: 'bearer' })
      .expect(401);
    await http()
      .get('/users/me')
      .auth(await jwt.signAsync({ sub: auth.user.id }, { expiresIn: -1 }), {
        type: 'bearer',
      })
      .expect(401);
    await http()
      .get('/users/me')
      .auth(await jwt.signAsync({ sub: 'not-a-uuid' }), { type: 'bearer' })
      .expect(401);
    await http()
      .get('/cart')
      .auth(auth.accessToken, { type: 'bearer' })
      .expect(200);
  });

  it('applies suspension and deletion to an already issued token', async () => {
    const { auth, username } = await register();
    await database.orm.public.User.where({ id: auth.user.id }).update({
      status: 'SUSPENDED',
    });
    await http()
      .get('/users/me')
      .auth(auth.accessToken, { type: 'bearer' })
      .expect(403);
    await http()
      .get('/cart')
      .auth(auth.accessToken, { type: 'bearer' })
      .expect(403);
    await http()
      .post('/auth/login')
      .send({ identifier: username, password })
      .expect(403);
    await database.orm.public.User.where({ id: auth.user.id }).update({
      status: 'DELETED',
      deletedAt: new Date().toISOString(),
    });
    await http()
      .get('/users/me')
      .auth(auth.accessToken, { type: 'bearer' })
      .expect(401);
    await http()
      .get('/cart')
      .auth(auth.accessToken, { type: 'bearer' })
      .expect(401);
  });

  it('creates only one customer if two registrations race for the same email', async () => {
    const email = `${prefix}-race@example.com`;
    const requests = await Promise.all([
      http()
        .post('/auth/register')
        .send({ email, username: 'race_one', password }),
      http()
        .post('/auth/register')
        .send({ email, username: 'race_two', password }),
    ]);
    expect(requests.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const winner = requests.find((response) => response.status === 201);
    userIds.push((winner!.body as AuthResponseDto).user.id);
    expect(await database.orm.public.User.where({ email }).all()).toHaveLength(
      1,
    );
  });
});
