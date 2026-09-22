import { Inject, Injectable } from '@nestjs/common';
import { and } from '@prisma/orm-postgres/orm-client';
import { DATABASE } from '../../../infrastructure/database/database.constants.js';
import type { DatabaseClient } from '../../../prisma/db.js';
import type { CatalogProduct } from '../entities/catalog-product.js';

@Injectable()
export class ProductRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  private visibleProducts() {
    return this.database.orm.public.Product.where({ status: 'ACTIVE' })
      .where((product) => product.archivedAt.isNull())
      .where((product) =>
        product.variants.some((variant) =>
          and(variant.isActive.eq(true), variant.archivedAt.isNull()),
        ),
      );
  }

  private withDetails(query: ReturnType<ProductRepository['visibleProducts']>) {
    return query
      .select('id', 'name', 'slug', 'description')
      .include('category', (category) => category.select('id', 'name', 'slug'))
      .include('images', (images) =>
        images
          .select('id', 'url', 'altText', 'position')
          .orderBy((image) => image.position.asc()),
      )
      .include('variants', (variants) =>
        variants
          .where({ isActive: true })
          .where((variant) => variant.archivedAt.isNull())
          .select(
            'id',
            'sku',
            'name',
            'options',
            'priceAmount',
            'compareAtAmount',
            'currency',
          )
          .orderBy((variant) => variant.sku.asc())
          .include('inventory', (inventory) =>
            inventory.select('onHand', 'reserved'),
          ),
      );
  }

  async findPage(options: {
    page: number;
    limit: number;
    category?: string;
  }): Promise<{
    products: CatalogProduct[];
    total: number;
  }> {
    let query = this.visibleProducts();

    if (options.category) {
      const category = await this.database.orm.public.Category.where({
        slug: options.category,
      })
        .select('id')
        .first();
      if (!category) return { products: [], total: 0 };
      query = query.where({ categoryId: category.id });
    }

    const [products, totals] = await Promise.all([
      this.withDetails(query)
        .orderBy([
          (product) => product.createdAt.desc(),
          (product) => product.id.asc(),
        ])
        .offset((options.page - 1) * options.limit)
        .limit(options.limit)
        .all(),
      query.aggregate((aggregate) => ({ total: aggregate.count() })),
    ]);

    return { products, total: totals.total };
  }

  async findBySlug(slug: string): Promise<CatalogProduct | null> {
    return this.withDetails(this.visibleProducts().where({ slug })).first();
  }
}
