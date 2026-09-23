import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { DATABASE } from '../../src/infrastructure/database/database.constants.js';
import { createDatabase } from '../../src/prisma/db.js';
import type { DatabaseClient } from '../../src/prisma/db.js';
import type { CartResponseDto } from '../../src/modules/cart/dto/cart-response.dto.js';
import { CartRepository } from '../../src/modules/cart/repositories/cart.repository.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

describe('Cart HTTP integration (real PostgreSQL)', () => {
  let app: INestApplication<App> | undefined;
  let database: DatabaseClient;
  let repository: CartRepository;
  let jwt: JwtService;
  let userId: string;
  let token: string;
  let productId: string;
  let variantId: string;
  let secondVariantId: string;
  const userIds: string[] = [];
  const variantIds: string[] = [];
  const prefix = `cart-it-${randomUUID()}`;
  const price = 9007199254740993n;

  const http = () => request(app!.getHttpServer());
  const add = (quantity = 1, id = variantId) =>
    http()
      .post('/cart/items')
      .auth(token, { type: 'bearer' })
      .send({ variantId: id, quantity });
  const get = () => http().get('/cart').auth(token, { type: 'bearer' });
  const body = (response: { body: unknown }) =>
    response.body as CartResponseDto;

  async function createUser() {
    const user = await database.orm.public.User.create({
      email: `${randomUUID()}@cart.test`,
      passwordHash: 'test-only-unused',
    });
    userIds.push(user.id);
    const authToken = await jwt.signAsync({ sub: user.id });
    return { id: user.id, token: authToken };
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
    const product = await database.orm.public.Product.create({
      name: 'Cart test product',
      slug: prefix,
      status: 'ACTIVE',
    });
    productId = product.id;
    for (const position of [2, 0, 1]) {
      await database.orm.public.ProductImage.create({
        productId,
        position,
        url: `https://example.test/${position}.png`,
      });
    }
    for (const suffix of ['first', 'second']) {
      const variant = await database.orm.public.ProductVariant.create({
        productId,
        name: suffix,
        sku: `${prefix}-${suffix}`,
        priceAmount: price,
        currency: 'VND',
      });
      variantIds.push(variant.id);
      await database.orm.public.Inventory.create({
        variantId: variant.id,
        onHand: 200,
        reserved: 5,
      });
    }
    [variantId, secondVariantId] = variantIds;
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(database)
      .compile();
    repository = module.get(CartRepository);
    jwt = module.get(JwtService);
    app = module.createNestApplication();
    await app.init();
  });

  beforeEach(async () => {
    const user = await createUser();
    userId = user.id;
    token = user.token;
    await database.orm.public.Product.where({ id: productId }).update({
      status: 'ACTIVE',
      archivedAt: null,
    });
    await database.orm.public.ProductVariant.where({ id: variantId }).update({
      isActive: true,
      archivedAt: null,
      priceAmount: price,
    });
    await database.orm.public.Inventory.where({ variantId }).update({
      onHand: 200,
      reserved: 5,
    });
  });

  afterAll(async () => {
    try {
      if (database)
        await database.transaction(async (tx) => {
          for (const id of userIds)
            await tx.orm.public.User.where({ id }).delete();
          for (const id of variantIds) {
            await tx.orm.public.Inventory.where({ variantId: id }).delete();
            await tx.orm.public.ProductVariant.where({ id }).delete();
          }
          if (productId)
            await tx.orm.public.Product.where({ id: productId }).delete();
        });
    } finally {
      if (app) await app.close();
      else if (database) await database.close();
    }
  });

  it('requires trusted identity on every route and ignores user-id headers', async () => {
    await http()
      .get('/cart')
      .set('x-user-id', userId)
      .query({ userId })
      .expect(401);
    await http()
      .post('/cart/items')
      .send({ variantId, quantity: 1, userId })
      .expect(401);
    await http()
      .patch(`/cart/items/${randomUUID()}`)
      .send({ quantity: 1 })
      .expect(401);
    await http().delete(`/cart/items/${randomUUID()}`).expect(401);
    await http().delete('/cart/items').expect(401);
    await http()
      .get('/cart')
      .auth('unverified-token', { type: 'bearer' })
      .expect(401);
  });

  it('returns an empty cart without creating records, including clear on an absent cart', async () => {
    const empty = { id: null, version: 0, totalQuantity: 0, items: [] };
    expect(body(await get().expect(200))).toEqual(empty);
    expect(
      body(
        await http()
          .delete('/cart/items')
          .auth(token, { type: 'bearer' })
          .expect(200),
      ),
    ).toEqual(empty);
    expect(await database.orm.public.Cart.where({ userId }).first()).toBeNull();
  });

  it('creates one cart/item, accumulates quantity, returns exact money and does not reserve stock', async () => {
    const first = body(await add(2).expect(200));
    const second = body(await add(3).expect(200));
    expect(second.id).toBe(first.id);
    expect(second.version).toBe(2);
    expect(second.totalQuantity).toBe(5);
    expect(second.items).toHaveLength(1);
    expect(second.items[0]).toMatchObject({
      id: first.items[0].id,
      quantity: 5,
      unitPriceAmount: price.toString(),
      lineTotalAmount: (price * 5n).toString(),
      availableQuantity: 195,
      purchasable: true,
      imageUrl: 'https://example.test/0.png',
    });
    expect(await database.orm.public.Cart.where({ userId }).all()).toHaveLength(
      1,
    );
    expect(
      await database.orm.public.CartItem.where({ cartId: second.id! }).all(),
    ).toHaveLength(1);
    expect(
      await database.orm.public.Inventory.where({ variantId }).first(),
    ).toMatchObject({ onHand: 200, reserved: 5 });
    expect(body(await get().expect(200))).toEqual(second);
  });

  it.each([0, -1, 1.5, 100, '2', null])(
    'rejects invalid quantity %p without creating a cart',
    async (quantity) => {
      await http()
        .post('/cart/items')
        .auth(token, { type: 'bearer' })
        .send({ variantId, quantity })
        .expect(400);
      expect(
        await database.orm.public.Cart.where({ userId }).first(),
      ).toBeNull();
    },
  );

  it('rejects malformed input, unknown fields and missing variants', async () => {
    await http()
      .post('/cart/items')
      .auth(token, { type: 'bearer' })
      .send({ variantId: 'bad', quantity: 1 })
      .expect(400);
    await http()
      .post('/cart/items')
      .auth(token, { type: 'bearer' })
      .send({ variantId, quantity: 1, userId })
      .expect(400);
    await http()
      .post('/cart/items')
      .auth(token, { type: 'bearer' })
      .send({ variantId, quantity: 1, unitPriceAmount: '1' })
      .expect(400);
    await add(1, randomUUID()).expect(404);
    await http()
      .patch('/cart/items/not-a-uuid')
      .auth(token, { type: 'bearer' })
      .send({ quantity: 1 })
      .expect(400);
    expect(await database.orm.public.Cart.where({ userId }).first()).toBeNull();
  });

  it('enforces the quantity limit after accumulation and rolls back rejected changes', async () => {
    const before = body(await add(99).expect(200));
    await add(1).expect(400);
    expect(body(await get().expect(200))).toEqual(before);
  });

  it('sets absolute quantity and leaves version unchanged for a no-op', async () => {
    const added = body(await add(2).expect(200));
    const itemUrl = `/cart/items/${added.items[0].id}`;
    const updated = body(
      await http()
        .patch(itemUrl)
        .auth(token, { type: 'bearer' })
        .send({ quantity: 4 })
        .expect(200),
    );
    expect(updated).toMatchObject({ version: 2, totalQuantity: 4 });
    expect(
      body(
        await http()
          .patch(itemUrl)
          .auth(token, { type: 'bearer' })
          .send({ quantity: 4 })
          .expect(200),
      ),
    ).toEqual(updated);
    await http()
      .patch(itemUrl)
      .auth(token, { type: 'bearer' })
      .send({ quantity: 0 })
      .expect(400);
    expect(body(await get().expect(200))).toEqual(updated);
  });

  it('does not expose or change another user cart', async () => {
    const ownerCart = body(await add(2).expect(200));
    const other = await createUser();
    const url = `/cart/items/${ownerCart.items[0].id}`;
    const empty = await http()
      .get('/cart')
      .auth(other.token, { type: 'bearer' })
      .query({ userId })
      .expect(200);
    expect(body(empty).items).toEqual([]);
    await http()
      .patch(url)
      .auth(other.token, { type: 'bearer' })
      .send({ quantity: 9 })
      .expect(404);
    await http().delete(url).auth(other.token, { type: 'bearer' }).expect(404);
    expect(body(await get().expect(200))).toEqual(ownerCart);
  });

  it('deletes one item and clears all remaining items while retaining the cart', async () => {
    const first = body(await add(1).expect(200));
    await add(2, secondVariantId).expect(200);
    const removed = body(
      await http()
        .delete(`/cart/items/${first.items[0].id}`)
        .auth(token, { type: 'bearer' })
        .expect(200),
    );
    expect(removed).toMatchObject({
      id: first.id,
      version: 3,
      totalQuantity: 2,
    });
    expect(removed.items).toHaveLength(1);
    await add(3).expect(200);
    const cleared = body(
      await http()
        .delete('/cart/items')
        .auth(token, { type: 'bearer' })
        .expect(200),
    );
    expect(cleared).toEqual({
      id: first.id,
      version: 5,
      totalQuantity: 0,
      items: [],
    });
    expect(
      await database.orm.public.CartItem.where({ cartId: first.id! }).all(),
    ).toEqual([]);
    expect(
      body(
        await http()
          .delete('/cart/items')
          .auth(token, { type: 'bearer' })
          .expect(200),
      ),
    ).toEqual(cleared);
    await http()
      .delete(`/cart/items/${first.items[0].id}`)
      .auth(token, { type: 'bearer' })
      .expect(404);
  });

  it.each([
    'draft-product',
    'archived-product',
    'inactive-variant',
    'archived-variant',
    'out-of-stock',
  ] as const)(
    'keeps %s visible but rejects purchase mutations',
    async (state) => {
      const original = body(await add(2).expect(200));
      if (state === 'draft-product')
        await database.orm.public.Product.where({ id: productId }).update({
          status: 'DRAFT',
        });
      if (state === 'archived-product')
        await database.orm.public.Product.where({ id: productId }).update({
          archivedAt: new Date().toISOString(),
        });
      if (state === 'inactive-variant')
        await database.orm.public.ProductVariant.where({
          id: variantId,
        }).update({ isActive: false });
      if (state === 'archived-variant')
        await database.orm.public.ProductVariant.where({
          id: variantId,
        }).update({ archivedAt: new Date().toISOString() });
      if (state === 'out-of-stock')
        await database.orm.public.Inventory.where({ variantId }).update({
          onHand: 5,
          reserved: 5,
        });
      const cart = body(await get().expect(200));
      expect(cart.items).toHaveLength(1);
      expect(cart.items[0].purchasable).toBe(false);
      await add().expect(409);
      await http()
        .patch(`/cart/items/${original.items[0].id}`)
        .auth(token, { type: 'bearer' })
        .send({ quantity: 1 })
        .expect(409);
      expect(body(await get().expect(200)).version).toBe(1);
      await http()
        .delete(`/cart/items/${original.items[0].id}`)
        .auth(token, { type: 'bearer' })
        .expect(200);
    },
  );

  it('uses current price when reading the cart', async () => {
    await add(2).expect(200);
    await database.orm.public.ProductVariant.where({ id: variantId }).update({
      priceAmount: price + 2n,
    });
    const cart = body(await get().expect(200));
    expect(cart.items[0].unitPriceAmount).toBe((price + 2n).toString());
    expect(cart.items[0].lineTotalAmount).toBe(((price + 2n) * 2n).toString());
  });

  it('serializes concurrent first adds without duplicate carts, items or lost updates', async () => {
    const results = await Promise.all(
      Array.from({ length: 12 }, () => add(1).expect(200)),
    );
    const cart = body(await get().expect(200));
    expect(cart).toMatchObject({ version: 12, totalQuantity: 12 });
    expect(cart.items).toHaveLength(1);
    expect(
      results.map((result) => body(result).version).sort((a, b) => a - b),
    ).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(await database.orm.public.Cart.where({ userId }).all()).toHaveLength(
      1,
    );
    expect(
      await database.orm.public.CartItem.where({ cartId: cart.id! }).all(),
    ).toHaveLength(1);
  });

  it('checks resulting quantity under the lock when concurrent requests exceed stock', async () => {
    await database.orm.public.Inventory.where({ variantId }).update({
      onHand: 7,
      reserved: 3,
    });
    const results = await Promise.all([add(3), add(3)]);
    expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
    expect(body(await get().expect(200))).toMatchObject({
      totalQuantity: 3,
      version: 1,
    });
    expect(
      await database.orm.public.Inventory.where({ variantId }).first(),
    ).toMatchObject({ onHand: 7, reserved: 3 });
  });

  it('rolls back the cart, item and version together if a transaction fails', async () => {
    await expect(
      repository.withUserLock(userId, async (store) => {
        const cart = await store.createCart();
        await store.createItem(cart.id, variantId, 1);
        await store.finish(cart);
        throw new Error('Simulated failure after writes');
      }),
    ).rejects.toThrow('Simulated failure after writes');
    expect(await database.orm.public.Cart.where({ userId }).first()).toBeNull();
    expect(body(await add(1).expect(200)).version).toBe(1);
  });

  it('treats a variant without inventory as unavailable without creating a cart', async () => {
    const variant = await database.orm.public.ProductVariant.create({
      productId,
      sku: `${prefix}-no-inventory`,
      priceAmount: price,
    });
    variantIds.push(variant.id);
    await add(1, variant.id).expect(409);
    expect(await database.orm.public.Cart.where({ userId }).first()).toBeNull();
  });

  it('allows the 100th distinct variant and rejects the 101st without changing the cart', async () => {
    await repository.withUserLock(userId, async (store) => {
      const cart = await store.createCart();
      // Fixture creation uses a separate connection; no other request uses these SKUs.
      for (let i = 0; i < 99; i += 1) {
        const variant = await database.orm.public.ProductVariant.create({
          productId,
          sku: `${prefix}-limit-${i}`,
          priceAmount: 1n,
        });
        variantIds.push(variant.id);
        await database.orm.public.Inventory.create({
          variantId: variant.id,
          onHand: 5,
        });
        await store.createItem(cart.id, variant.id, 1);
      }
      await store.finish(cart);
    });
    const full = body(await add().expect(200));
    expect(full.items).toHaveLength(100);
    await add(1, secondVariantId).expect(409);
    expect(body(await get().expect(200))).toEqual(full);
  });

  it('documents all cart routes and money fields in Swagger', () => {
    const document = SwaggerModule.createDocument(
      app!,
      new DocumentBuilder().build(),
    );
    expect(document.paths['/cart']?.get?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: { $ref: '#/components/schemas/CartResponseDto' },
        },
      },
    });
    expect(document.paths['/cart/items']?.post).toBeDefined();
    expect(document.paths['/cart/items']?.delete).toBeDefined();
    expect(document.paths['/cart/items/{itemId}']?.patch).toBeDefined();
    expect(document.paths['/cart/items/{itemId}']?.delete).toBeDefined();
    expect(document.components?.schemas?.CartItemResponseDto).toMatchObject({
      properties: {
        unitPriceAmount: { type: 'string' },
        lineTotalAmount: { type: 'string' },
      },
    });
  });

  it('rejects suspended, deleted and nonexistent authenticated users', async () => {
    await database.orm.public.User.where({ id: userId }).update({
      status: 'SUSPENDED',
    });
    await get().expect(403);
    await add().expect(403);
    await database.orm.public.User.where({ id: userId }).update({
      status: 'ACTIVE',
      deletedAt: new Date().toISOString(),
    });
    await get().expect(401);
    await add().expect(401);
    token = await jwt.signAsync({ sub: randomUUID() });
    await get().expect(401);
    await add().expect(401);
  });
});
