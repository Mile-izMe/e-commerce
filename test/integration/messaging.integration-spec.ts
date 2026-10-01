import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { DATABASE } from '../../src/infrastructure/database/database.constants.js';
import { createDatabase } from '../../src/prisma/db.js';
import type { DatabaseClient } from '../../src/prisma/db.js';
import type { ChatMessage } from '../../src/modules/messaging/entities/chat.js';

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
type Ack = {
  success: boolean;
  data?: ChatMessage;
  error?: { code: string; message: unknown };
};

describe('Messaging HTTP + Socket.IO integration (real PostgreSQL)', () => {
  let app: INestApplication<App>;
  let db: DatabaseClient;
  let jwt: JwtService;
  let url: string;
  let owner: { id: string; token: string };
  let member: { id: string; token: string };
  let outsider: { id: string; token: string };
  let guildId: string;
  let channelId: string;
  let otherChannelId: string;
  const sockets: Socket[] = [];
  const userIds: string[] = [];
  const guildIds: string[] = [];

  const http = () => request(app.getHttpServer());
  const event = (socket: Socket, name: string, payload: unknown) =>
    socket.timeout(3000).emitWithAck(name, payload) as Promise<Ack>;
  const payload = (content = 'Hello from the lab') => ({
    channelId,
    content,
    clientMessageId: randomUUID(),
  });

  async function newUser() {
    const user = await db.orm.public.User.create({
      email: `${randomUUID()}@chat.test`,
      passwordHash: 'unused-test-only',
    });
    userIds.push(user.id);
    return { id: user.id, token: await jwt.signAsync({ sub: user.id }) };
  }

  function client(token?: string, options: Record<string, unknown> = {}) {
    const socket = io(`${url}/chat`, {
      auth: token ? { token } : {},
      transports: ['websocket'],
      reconnection: false,
      autoConnect: false,
      ...options,
    });
    sockets.push(socket);
    return socket;
  }

  async function connected(token: string) {
    const socket = client(token);
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    return socket;
  }

  async function rejected(token?: string) {
    const socket = client(token);
    return new Promise<Error & { data?: { code: string } }>(
      (resolve, reject) => {
        socket.once('connect', () =>
          reject(new Error('Connection should have been rejected')),
        );
        socket.once('connect_error', resolve);
        socket.connect();
      },
    );
  }

  beforeAll(async () => {
    process.env.JWT_SECRET ??=
      'local-integration-test-secret-with-at-least-32-bytes';
    const testUrl = process.env.TEST_DATABASE_URL;
    if (
      !testUrl ||
      !decodeURIComponent(new URL(testUrl).pathname).endsWith('_test')
    )
      throw new Error('Use a dedicated database ending in _test');
    if (process.env.DATABASE_URL) {
      const dev = new URL(process.env.DATABASE_URL);
      const test = new URL(testUrl);
      if (dev.host === test.host && dev.pathname === test.pathname)
        throw new Error('Do not run tests on the development database');
    }
    execFileSync(
      process.execPath,
      [
        path.join(
          path.dirname(require.resolve('prisma/package.json')),
          'dist/prisma.js',
        ),
        'db',
        'migrate',
        '--yes',
      ],
      {
        cwd: root,
        env: { ...process.env, DATABASE_URL: testUrl },
        stdio: 'pipe',
      },
    );
    db = createDatabase(testUrl);
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(db)
      .compile();
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    await app.listen(0, '127.0.0.1');
    url = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}`;
    owner = await newUser();
    member = await newUser();
    outsider = await newUser();
    const guild = await http()
      .post('/chat/guilds')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: ' Integration lab ' })
      .expect(201);
    guildId = guild.body.data.id as string;
    guildIds.push(guildId);
    expect(guild.body.data.name).toBe('Integration lab');
    await http()
      .post(`/chat/guilds/${guildId}/members`)
      .auth(owner.token, { type: 'bearer' })
      .send({ userId: member.id })
      .expect(201);
    for (const name of ['general', 'separate']) {
      const channel = await http()
        .post(`/chat/guilds/${guildId}/channels`)
        .auth(owner.token, { type: 'bearer' })
        .send({ name })
        .expect(201);
      if (name === 'general') channelId = channel.body.data.id as string;
      else otherChannelId = channel.body.data.id as string;
    }
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    if (db) {
      for (const id of guildIds)
        await db.orm.public.Guild.where({ id }).delete();
      for (const id of userIds) await db.orm.public.User.where({ id }).delete();
    }
    await app?.close();
    await db?.close();
  });

  it('rejects missing, invalid, expired and malformed-claim tokens at connection', async () => {
    expect((await rejected()).data?.code).toBe('AUTH_INVALID');
    expect((await rejected('invalid')).data?.code).toBe('AUTH_INVALID');
    expect(
      (
        await rejected(
          await jwt.signAsync({ sub: owner.id }, { expiresIn: -1 }),
        )
      ).data?.code,
    ).toBe('AUTH_INVALID');
    expect(
      (await rejected(await jwt.signAsync({ sub: 'not-a-user-id' }))).data
        ?.code,
    ).toBe('AUTH_INVALID');
  });

  it('allows polling transport with the configured frontend origin', async () => {
    const socket = client(owner.token, {
      transports: ['polling'],
      extraHeaders: { Origin: 'http://localhost:3000' },
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect', resolve);
      socket.once('connect_error', reject);
      socket.connect();
    });
    expect((await event(socket, 'channel.join', { channelId })).success).toBe(
      true,
    );
  });

  it('rejects WebSocket upgrades from an untrusted browser origin', async () => {
    const socket = client(owner.token, {
      extraHeaders: { Origin: 'https://untrusted.example' },
    });
    await new Promise<void>((resolve, reject) => {
      socket.once('connect_error', () => resolve());
      socket.once('connect', () =>
        reject(new Error('Untrusted Origin was accepted')),
      );
      socket.connect();
    });
  });

  it('emits chat.error when an invalid event has no acknowledgement callback', async () => {
    const socket = await connected(owner.token);
    const response = new Promise<Ack>((resolve) =>
      socket.once('chat.error', resolve),
    );
    socket.emit('message.send', payload('   '));
    expect((await response).error?.code).toBe('VALIDATION_ERROR');
  });

  it('creates owner membership atomically and lists only the user guilds', async () => {
    expect(
      await db.orm.public.GuildMember.where({
        guildId,
        userId: owner.id,
      }).first(),
    ).not.toBeNull();
    const own = await http()
      .get('/chat/guilds')
      .auth(owner.token, { type: 'bearer' })
      .expect(200);
    expect(own.body.data.map((guild: { id: string }) => guild.id)).toContain(
      guildId,
    );
    const other = await http()
      .get('/chat/guilds')
      .auth(outsider.token, { type: 'bearer' })
      .expect(200);
    expect(other.body.data).toEqual([]);
  });

  it('enforces owner-only channel/member creation and denies private history', async () => {
    await http()
      .post(`/chat/guilds/${guildId}/channels`)
      .auth(member.token, { type: 'bearer' })
      .send({ name: 'forbidden' })
      .expect(403);
    await http()
      .post(`/chat/guilds/${guildId}/members`)
      .auth(member.token, { type: 'bearer' })
      .send({ userId: outsider.id })
      .expect(403);
    await http()
      .get(`/chat/guilds/${guildId}/channels`)
      .auth(outsider.token, { type: 'bearer' })
      .expect(403);
    await http()
      .get(`/chat/channels/${channelId}/messages`)
      .auth(outsider.token, { type: 'bearer' })
      .expect(403);
    await http().get('/chat/guilds').expect(401);
  });

  it('rejects duplicate channel names, invalid HTTP input and unknown member IDs', async () => {
    await http()
      .post(`/chat/guilds/${guildId}/channels`)
      .auth(owner.token, { type: 'bearer' })
      .send({ name: 'general' })
      .expect(409);
    await http()
      .post('/chat/guilds')
      .auth(owner.token, { type: 'bearer' })
      .send({ name: ' ', ownerId: outsider.id })
      .expect(400);
    await http()
      .post(`/chat/guilds/${guildId}/members`)
      .auth(owner.token, { type: 'bearer' })
      .send({ userId: randomUUID() })
      .expect(404);
  });

  it('rejects unauthorized join/send and forged authorId with structured acknowledgements', async () => {
    const socket = await connected(outsider.token);
    expect(
      (await event(socket, 'channel.join', { channelId })).error?.code,
    ).toBe('FORBIDDEN');
    expect((await event(socket, 'message.send', payload())).error?.code).toBe(
      'FORBIDDEN',
    );
    const valid = await connected(owner.token);
    expect(
      (
        await event(valid, 'message.send', {
          ...payload(),
          authorId: outsider.id,
        })
      ).error?.code,
    ).toBe('VALIDATION_ERROR');
    expect(
      (await event(valid, 'message.send', payload('   '))).error?.code,
    ).toBe('VALIDATION_ERROR');
    expect(
      (await event(valid, 'channel.join', { channelId: 'invalid' })).error
        ?.code,
    ).toBe('VALIDATION_ERROR');
  });

  it('persists before broadcast, isolates rooms and stops delivery after leaving', async () => {
    const sender = await connected(owner.token);
    const receiver = await connected(member.token);
    const separate = await connected(member.token);
    await event(sender, 'channel.join', { channelId });
    await event(receiver, 'channel.join', { channelId });
    await event(separate, 'channel.join', { channelId: otherChannelId });
    const received: ChatMessage[] = [];
    const wrongRoom: ChatMessage[] = [];
    receiver.on('message.created', (message: ChatMessage) =>
      received.push(message),
    );
    separate.on('message.created', (message: ChatMessage) =>
      wrongRoom.push(message),
    );
    const first = await event(
      sender,
      'message.send',
      payload(' Room message '),
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(first.success).toBe(true);
    expect(first.data?.authorId).toBe(owner.id);
    expect(first.data?.content).toBe('Room message');
    expect(received.map((message) => message.id)).toContain(first.data?.id);
    expect(wrongRoom).toHaveLength(0);
    expect(
      await db.orm.public.Message.where({ id: first.data!.id }).first(),
    ).not.toBeNull();
    await event(receiver, 'channel.leave', { channelId });
    await event(sender, 'message.send', payload('After leaving'));
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(received).toHaveLength(1);
  });

  it('deduplicates concurrent retries across sockets and rejects key payload changes', async () => {
    const a = await connected(owner.token);
    const b = await connected(owner.token);
    const observer = await connected(member.token);
    await event(observer, 'channel.join', { channelId });
    const broadcasts: ChatMessage[] = [];
    observer.on('message.created', (message: ChatMessage) =>
      broadcasts.push(message),
    );
    const data = payload('Concurrent retry');
    const results = await Promise.all([
      event(a, 'message.send', data),
      event(b, 'message.send', data),
    ]);
    expect(results.every((result) => result.success)).toBe(true);
    expect(results[0].data?.id).toBe(results[1].data?.id);
    await new Promise((resolve) => setTimeout(resolve, 80));
    expect(broadcasts).toHaveLength(1);
    expect(
      (await event(a, 'message.send', { ...data, content: 'Changed' })).error
        ?.code,
    ).toBe('CONFLICT');
    expect(
      (await event(a, 'message.send', { ...data, channelId: otherChannelId }))
        .error?.code,
    ).toBe('CONFLICT');
  });

  it('returns cursor history without duplicates and rejects cursors from another channel', async () => {
    const socket = await connected(owner.token);
    for (let index = 0; index < 3; index++)
      await event(socket, 'message.send', payload(`History ${index}`));
    const first = await http()
      .get(`/chat/channels/${channelId}/messages?limit=2`)
      .auth(member.token, { type: 'bearer' })
      .expect(200);
    expect(first.body.data).toHaveLength(2);
    expect(first.body.meta.hasMore).toBe(true);
    const cursor = first.body.meta.nextCursor as string;
    const second = await http()
      .get(`/chat/channels/${channelId}/messages`)
      .query({ limit: 2, cursor })
      .auth(member.token, { type: 'bearer' })
      .expect(200);
    const ids = [...first.body.data, ...second.body.data].map(
      (message: ChatMessage) => message.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    await http()
      .get(`/chat/channels/${otherChannelId}/messages`)
      .query({ cursor })
      .auth(member.token, { type: 'bearer' })
      .expect(400);
    await http()
      .get(`/chat/channels/${channelId}/messages?limit=101`)
      .auth(member.token, { type: 'bearer' })
      .expect(400);
  });

  it('rechecks active account status on events', async () => {
    const user = await newUser();
    const socket = await connected(user.token);
    await db.orm.public.User.where({ id: user.id }).update({
      status: 'SUSPENDED',
    });
    expect(
      (await event(socket, 'channel.join', { channelId })).error?.code,
    ).toBe('FORBIDDEN');
    expect((await rejected(user.token)).data?.code).toBe('FORBIDDEN');
  });

  it('disconnects expired connections and rejects expired events', async () => {
    const token = await jwt.signAsync({ sub: owner.id }, { expiresIn: 2 });
    const socket = await connected(token);
    const error = new Promise<Ack>((resolve) =>
      socket.once('chat.error', resolve),
    );
    const disconnected = new Promise<string>((resolve) =>
      socket.once('disconnect', resolve),
    );
    expect((await error).error?.code).toBe('AUTH_EXPIRED');
    expect(await disconnected).toBe('io server disconnect');
  });

  it('limits per-connection message sends', async () => {
    const socket = await connected(owner.token);
    const data = payload('Rate limit retry');
    for (let index = 0; index < 30; index++)
      expect((await event(socket, 'message.send', data)).success).toBe(true);
    expect((await event(socket, 'message.send', data)).error?.code).toBe(
      'RATE_LIMITED',
    );
  });
});
