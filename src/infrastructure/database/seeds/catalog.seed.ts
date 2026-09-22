import type { DatabaseClient } from '../../../prisma/db.js';

const categories = [
  { slug: 'demo-clothing', name: 'Demo Clothing' },
  { slug: 'demo-electronics', name: 'Demo Electronics' },
  { slug: 'demo-accessories', name: 'Demo Accessories' },
] as const;

const products = [
  {
    slug: 'demo-cotton-t-shirt',
    name: 'Cotton T-Shirt',
    category: 0,
    price: 199000n,
  },
  { slug: 'demo-hoodie', name: 'Everyday Hoodie', category: 0, price: 499000n },
  {
    slug: 'demo-linen-shirt',
    name: 'Linen Shirt',
    category: 0,
    price: 359000n,
  },
  {
    slug: 'demo-joggers',
    name: 'Comfort Joggers',
    category: 0,
    price: 299000n,
  },
  {
    slug: 'demo-keyboard',
    name: 'Mechanical Keyboard',
    category: 1,
    price: 1299000n,
  },
  { slug: 'demo-mouse', name: 'Wireless Mouse', category: 1, price: 399000n },
  {
    slug: 'demo-headphones',
    name: 'Wireless Headphones',
    category: 1,
    price: 899000n,
  },
  {
    slug: 'demo-backpack',
    name: 'Everyday Backpack',
    category: 2,
    price: 459000n,
  },
  {
    slug: 'demo-tote-bag',
    name: 'Canvas Tote Bag',
    category: 2,
    price: 129000n,
  },
  { slug: 'demo-cap', name: 'Classic Cap', category: 2, price: 159000n },
] as const;

export const DEMO_PRODUCT_COUNT = products.length;

// Create missing demo records only. Re-running never resets stock, prices,
// product visibility or other edits made after the initial seed.
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
          description: `Sample catalog product: ${data.name}.`,
          categoryId: categoryIds[data.category],
          status: 'ACTIVE',
          publishedAt: new Date().toISOString(),
        });
        created.products++;
      }

      const sku = data.slug.toUpperCase();
      let variant = await tx.orm.public.ProductVariant.where({ sku }).first();
      if (!variant) {
        variant = await tx.orm.public.ProductVariant.create({
          productId: product.id,
          sku,
          name: 'Default',
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

      if (
        !(await tx.orm.public.ProductImage.where({
          productId: product.id,
          position: 0,
        }).first())
      ) {
        await tx.orm.public.ProductImage.create({
          productId: product.id,
          url: `https://placehold.co/800x800?text=${encodeURIComponent(data.name)}`,
          altText: data.name,
          position: 0,
        });
        created.images++;
      }
    }

    return created;
  });
}
