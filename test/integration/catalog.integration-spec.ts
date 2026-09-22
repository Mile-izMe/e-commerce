import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { DATABASE } from '../../src/infrastructure/database/database.constants.js';
import {
  seedCatalog,
  DEMO_PRODUCT_COUNT,
} from '../../src/infrastructure/database/seeds/catalog.seed.js';
import { createDatabase } from '../../src/prisma/db.js';
import type { DatabaseClient } from '../../src/prisma/db.js';
import type {
  ProductListResponseDto,
  ProductResponseDto,
} from '../../src/modules/catalog/dto/product-response.dto.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const require = createRequire(import.meta.url);

describe('Catalog HTTP integration (real PostgreSQL)', () => {
  let app: INestApplication<App> | undefined;
  let database: DatabaseClient;
  const prefix = `it-${randomUUID()}`;
  const categorySlug = `${prefix}-category`;
  const otherCategorySlug = `${prefix}-other`;
  const ids: string[] = [];
  const variantIds: string[] = [];
  const categoryIds: string[] = [];
  const slugs: Record<string, string> = {};
  const preciseAmount = 9007199254740993n;

  beforeAll(async () => {
    const testUrl = process.env.TEST_DATABASE_URL;
    if (!testUrl)
      throw new Error(
        'Set TEST_DATABASE_URL to a dedicated PostgreSQL test database',
      );
    const parsed = new URL(testUrl);
    if (!decodeURIComponent(parsed.pathname).endsWith('_test')) {
      throw new Error('TEST_DATABASE_URL database name must end with _test');
    }
    if (process.env.DATABASE_URL) {
      const development = new URL(process.env.DATABASE_URL);
      if (
        parsed.host === development.host &&
        parsed.pathname === development.pathname
      ) {
        throw new Error(
          'Integration tests must not use the development database',
        );
      }
    }

    // Apply the checked-in migrations to the isolated test database only.
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
    const category = await database.orm.public.Category.create({
      name: 'Test Category',
      slug: categorySlug,
    });
    const other = await database.orm.public.Category.create({
      name: 'Other Category',
      slug: otherCategorySlug,
    });
    categoryIds.push(category.id, other.id);

    const cases = [
      {
        key: 'visible-a',
        status: 'ACTIVE',
        categoryId: category.id,
        active: true,
      },
      {
        key: 'visible-b',
        status: 'ACTIVE',
        categoryId: category.id,
        active: true,
      },
      {
        key: 'visible-c',
        status: 'ACTIVE',
        categoryId: category.id,
        active: true,
      },
      { key: 'other', status: 'ACTIVE', categoryId: other.id, active: true },
      { key: 'draft', status: 'DRAFT', categoryId: category.id, active: true },
      {
        key: 'archived',
        status: 'ARCHIVED',
        categoryId: category.id,
        active: true,
      },
      {
        key: 'archived-at',
        status: 'ACTIVE',
        categoryId: category.id,
        active: true,
        archivedAt: true,
      },
      {
        key: 'inactive-variant',
        status: 'ACTIVE',
        categoryId: category.id,
        active: false,
      },
      {
        key: 'archived-variant',
        status: 'ACTIVE',
        categoryId: category.id,
        active: true,
        archivedVariant: true,
      },
    ] as const;

    for (const data of cases) {
      const slug = `${prefix}-${data.key}`;
      slugs[data.key] = slug;
      const product = await database.orm.public.Product.create({
        name: data.key,
        slug,
        categoryId: data.categoryId,
        status: data.status,
        archivedAt: 'archivedAt' in data ? new Date().toISOString() : null,
        createdAt: '2026-01-01T00:00:00.000Z',
      });
      ids.push(product.id);
      const variant = await database.orm.public.ProductVariant.create({
        productId: product.id,
        sku: `${prefix}-${data.key}`.toUpperCase(),
        priceAmount: preciseAmount,
        compareAtAmount: preciseAmount + 1000n,
        currency: 'VND',
        isActive: data.active,
        archivedAt: 'archivedVariant' in data ? new Date().toISOString() : null,
      });
      variantIds.push(variant.id);
      await database.orm.public.Inventory.create({
        variantId: variant.id,
        onHand: 10,
        reserved: 3,
      });
    }

    // Hidden variants on a visible product must also be excluded from detail.
    for (const suffix of ['inactive', 'archived']) {
      const variant = await database.orm.public.ProductVariant.create({
        productId: ids[0],
        sku: `${prefix}-hidden-${suffix}`.toUpperCase(),
        priceAmount: 1n,
        isActive: suffix !== 'inactive',
        archivedAt: suffix === 'archived' ? new Date().toISOString() : null,
      });
      variantIds.push(variant.id);
    }
    for (const position of [1, 0]) {
      await database.orm.public.ProductImage.create({
        productId: ids[0],
        position,
        url: `https://example.test/${position}.png`,
      });
    }

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DATABASE)
      .useValue(database)
      .compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    try {
      if (database) {
        await database.transaction(async (tx) => {
          for (const id of variantIds) {
            await tx.orm.public.Inventory.where({ variantId: id }).delete();
            await tx.orm.public.ProductVariant.where({ id }).delete();
          }
          for (const id of ids) {
            // ProductImage is owned by Product and cascades on deletion.
            await tx.orm.public.Product.where({ id }).delete();
          }
          for (const id of categoryIds) {
            await tx.orm.public.Category.where({ id }).delete();
          }
        });
      }
    } finally {
      if (app) await app.close();
      else if (database) await database.close();
    }
  });

  it('paginates active products with stable ordering and accurate filtered totals', async () => {
    const first = await request(app!.getHttpServer())
      .get('/products')
      .query({ category: categorySlug, page: 1, limit: 2 })
      .expect(200);
    const second = await request(app!.getHttpServer())
      .get('/products')
      .query({ category: categorySlug, page: 2, limit: 2 })
      .expect(200);
    const a = first.body as ProductListResponseDto;
    const b = second.body as ProductListResponseDto;
    expect(a.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    expect(a.data).toHaveLength(2);
    expect(b.data).toHaveLength(1);
    const received = [...a.data, ...b.data].map((product) => product.id);
    expect(received).toEqual(ids.slice(0, 3).sort());
  });

  it('filters by category slug', async () => {
    const response = await request(app!.getHttpServer())
      .get('/products')
      .query({ category: otherCategorySlug })
      .expect(200);
    const body = response.body as ProductListResponseDto;
    expect(body.meta.total).toBe(1);
    expect(body.data[0].slug).toBe(slugs.other);
  });

  it('returns an empty page for an unknown category', async () => {
    const response = await request(app!.getHttpServer())
      .get('/products')
      .query({ category: `${prefix}-missing` })
      .expect(200);
    expect(response.body).toEqual({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it('returns an empty page beyond the last page', async () => {
    const response = await request(app!.getHttpServer())
      .get('/products')
      .query({ category: categorySlug, page: 10 })
      .expect(200);
    const body = response.body as ProductListResponseDto;
    expect(body.data).toEqual([]);
    expect(body.meta.total).toBe(3);
  });

  it('serializes exact BigInt prices, available stock and ordered images', async () => {
    const response = await request(app!.getHttpServer())
      .get(`/products/${slugs['visible-a']}`)
      .expect(200);
    const body = response.body as ProductResponseDto;
    expect(body.variants).toHaveLength(1);
    expect(body.variants[0]).toMatchObject({
      priceAmount: preciseAmount.toString(),
      compareAtAmount: (preciseAmount + 1000n).toString(),
      currency: 'VND',
      availableQuantity: 7,
    });
    expect(body.variants[0]).not.toHaveProperty('inventory');
    expect(body.images.map((image) => image.position)).toEqual([0, 1]);
  });

  it.each([
    'draft',
    'archived',
    'archived-at',
    'inactive-variant',
    'archived-variant',
    'missing',
  ])('returns 404 for %s products', async (key) => {
    await request(app!.getHttpServer())
      .get(`/products/${slugs[key] ?? `${prefix}-missing`}`)
      .expect(404);
  });

  it.each([
    'page=0',
    'page=-1',
    'page=1.5',
    'page=10001',
    'limit=101',
    'limit=abc',
    'limit=1e2',
    'limit=',
    'limit=1&limit=2',
    'category=',
    'status=DRAFT',
  ])('rejects invalid query: %s', async (query) => {
    await request(app!.getHttpServer()).get(`/products?${query}`).expect(400);
  });

  it('seeds repeatedly without duplicating rows or resetting stock', async () => {
    await seedCatalog(database);
    const variant = await database.orm.public.ProductVariant.where({
      sku: 'DEMO-COTTON-T-SHIRT',
    }).first();
    expect(variant).not.toBeNull();
    await database.orm.public.Inventory.where({
      variantId: variant!.id,
    }).update({ onHand: 17, reserved: 3 });
    const created = await seedCatalog(database);
    expect(created).toEqual({
      categories: 0,
      products: 0,
      variants: 0,
      inventory: 0,
      images: 0,
    });
    const inventory = await database.orm.public.Inventory.where({
      variantId: variant!.id,
    }).first();
    expect(inventory).toMatchObject({ onHand: 17, reserved: 3 });
    const total = await database.orm.public.Product.where((row) =>
      row.slug.like('demo-%'),
    ).aggregate((a) => ({ count: a.count() }));
    expect(total.count).toBe(DEMO_PRODUCT_COUNT);
  });
});
