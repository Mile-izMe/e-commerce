import type { DatabaseClient } from '../../../prisma/db.js';

import {
  demoCategories as categories,
  demoProducts as products,
  demoPhotoUrl,
} from './catalog.seed-data.js';

export const DEMO_PRODUCT_COUNT = products.length;

// Preserve existing prices, stock and custom edits; upgrade legacy demo media only.
export async function seedCatalog(database: DatabaseClient) {
  return database.transaction(async (tx) => {
    const created = {
      categories: 0,
      products: 0,
      variants: 0,
      inventory: 0,
      images: 0,
    };
    const categoryIds: string[] = [];

    for (const data of categories) {
      let category = await tx.orm.public.Category.where({
        slug: data.slug,
      }).first();
      if (!category) {
        category = await tx.orm.public.Category.create({
          ...data,
          isActive: true,
        });
        created.categories++;
      }
      categoryIds.push(category.id);
    }

    for (const data of products) {
      let product = await tx.orm.public.Product.where({
        slug: data.slug,
      }).first();
      if (!product) {
        product = await tx.orm.public.Product.create({
          name: data.name,
          slug: data.slug,
          description: data.description,
          categoryId: categoryIds[data.category],
          status: 'ACTIVE',
          publishedAt: new Date().toISOString(),
        });
        created.products++;
      } else if (
        product.description === `Sample catalog product: ${data.name}.`
      ) {
        await tx.orm.public.Product.where({ id: product.id }).update({
          description: data.description,
        });
      }

      for (const size of data.sizes ?? [null]) {
        const sku = `${data.slug}${size ? `-${size}` : ''}`.toUpperCase();
        let variant = await tx.orm.public.ProductVariant.where({ sku }).first();
        if (!variant) {
          variant = await tx.orm.public.ProductVariant.create({
            productId: product.id,
            sku,
            name: size ?? 'Default',
            options: size ? { size } : null,
            priceAmount: data.price,
            currency: 'VND',
            isActive: true,
          });
          created.variants++;
        } else if (variant.productId !== product.id) {
          throw new Error(`Demo SKU belongs to a different product: ${sku}`);
        }

        if (
          !(await tx.orm.public.Inventory.where({
            variantId: variant.id,
          }).first())
        ) {
          const inventory = await tx.orm.public.Inventory.create({
            variantId: variant.id,
            onHand: 50,
            reserved: 0,
          });
          await tx.orm.public.InventoryMovement.create({
            inventoryId: inventory.id,
            type: 'RECEIPT',
            onHandDelta: 50,
            reservedDelta: 0,
            operationKey: `seed:${sku}`,
            reason: 'Initial demo stock',
          });
          created.inventory++;
        }
      }

      const cover = await tx.orm.public.ProductImage.where({
        productId: product.id,
        position: 0,
      }).first();
      if (!cover) {
        await tx.orm.public.ProductImage.create({
          productId: product.id,
          url: demoPhotoUrl(data.photoId),
          altText: data.name,
          position: 0,
        });
        created.images++;
      } else if (/^https?:\/\/placehold\.co\//i.test(cover.url)) {
        await tx.orm.public.ProductImage.where({ id: cover.id }).update({
          url: demoPhotoUrl(data.photoId),
          altText: data.name,
        });
      }
    }

    return created;
  });
}
