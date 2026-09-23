import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { DATABASE } from '../../../infrastructure/database/database.constants.js';
import type { DatabaseClient } from '../../../prisma/db.js';
import type { Cart } from '../entities/cart.js';
import type { CartVariant } from '../entities/cart-item.js';

type ReadContext = Pick<DatabaseClient, 'orm'>;
type Transaction = Parameters<Parameters<DatabaseClient['transaction']>[0]>[0];

function variantDetails(query: ReadContext['orm']['public']['ProductVariant']) {
  return query
    .select('id', 'name', 'priceAmount', 'currency', 'isActive', 'archivedAt')
    .include('product', (product) =>
      product
        .select('name', 'status', 'archivedAt')
        .include('images', (images) =>
          images
            .select('url', 'position')
            .orderBy((image) => image.position.asc())
            .limit(1),
        ),
    )
    .include('inventory', (inventory) =>
      inventory.select('onHand', 'reserved'),
    );
}

async function readCart(
  database: ReadContext,
  userId: string,
): Promise<Cart | null> {
  const cart = await database.orm.public.Cart.where({ userId })
    .select('id', 'userId', 'version')
    .include('items', (items) =>
      items
        .select('id', 'cartId', 'variantId', 'quantity')
        .orderBy([(item) => item.createdAt.asc(), (item) => item.id.asc()])
        .include('variant', (variant) =>
          variant
            .select(
              'id',
              'name',
              'priceAmount',
              'currency',
              'isActive',
              'archivedAt',
            )
            .include('product', (product) =>
              product
                .select('name', 'status', 'archivedAt')
                .include('images', (images) =>
                  images
                    .select('url', 'position')
                    .orderBy((image) => image.position.asc())
                    .limit(1),
                ),
            )
            .include('inventory', (inventory) =>
              inventory.select('onHand', 'reserved'),
            ),
        ),
    )
    .first();
  if (!cart) return null;
  return {
    ...cart,
    items: cart.items.map((item) => {
      // Prisma's include types allow null even for the required foreign keys.
      if (!item.variant?.product)
        throw new Error('Cart item relation is missing');
      return {
        ...item,
        variant: { ...item.variant, product: item.variant.product },
      };
    }),
  };
}

async function requireActiveUser(
  database: ReadContext,
  userId: string,
): Promise<void> {
  const user = await database.orm.public.User.where({ id: userId })
    .select('status', 'deletedAt')
    .first();
  if (!user || user.deletedAt !== null) throw new UnauthorizedException();
  if (user.status !== 'ACTIVE')
    throw new ForbiddenException('Account is not active');
}

// Only constructed by withUserLock: all methods share its transaction and owner.
export class CartTransaction {
  constructor(
    private readonly tx: Transaction,
    private readonly userId: string,
  ) {}

  findCart(): Promise<Cart | null> {
    return readCart(this.tx, this.userId);
  }

  async findVariant(variantId: string): Promise<CartVariant | null> {
    const variant = await variantDetails(
      this.tx.orm.public.ProductVariant.where({ id: variantId }),
    ).first();
    return variant?.product ? { ...variant, product: variant.product } : null;
  }

  async createCart(): Promise<Cart> {
    const cart = await this.tx.orm.public.Cart.create({ userId: this.userId });
    return {
      id: cart.id,
      userId: cart.userId,
      version: cart.version,
      items: [],
    };
  }

  async createItem(
    cartId: string,
    variantId: string,
    quantity: number,
  ): Promise<void> {
    await this.tx.orm.public.CartItem.create({ cartId, variantId, quantity });
  }

  async setQuantity(
    cartId: string,
    itemId: string,
    quantity: number,
  ): Promise<void> {
    await this.tx.orm.public.CartItem.where({ id: itemId, cartId }).update({
      quantity,
    });
  }

  async removeItem(cartId: string, itemId: string): Promise<void> {
    await this.tx.orm.public.CartItem.where({ id: itemId, cartId }).delete();
  }

  async clearItems(cartId: string): Promise<void> {
    // SQL delete is set-based; the ORM delete terminal targets one record.
    const plan = this.tx.sql.public.cart_items
      .delete()
      .where((fields, fns) => fns.eq(fields.cartId, cartId))
      .build();
    await this.tx.execute(plan);
  }

  async finish(cart: Cart): Promise<Cart> {
    await this.tx.orm.public.Cart.where({
      id: cart.id,
      userId: this.userId,
    }).update({
      version: cart.version + 1,
      updatedAt: new Date().toISOString(),
    });
    const result = await this.findCart();
    if (!result)
      throw new Error('Cart disappeared during a locked transaction');
    return result;
  }
}

@Injectable()
export class CartRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async findCart(userId: string): Promise<Cart | null> {
    await requireActiveUser(this.database, userId);
    return readCart(this.database, userId);
  }

  async withUserLock<T>(
    userId: string,
    work: (cart: CartTransaction) => Promise<T>,
  ): Promise<T> {
    return this.database.transaction(async (tx) => {
      // Lock the stable parent: a Cart row does not exist on the first add.
      // All Cart writers (including future checkout) must follow this protocol.
      // The template binds userId as a parameter, never interpolated SQL text.
      const lock = this.database.raw.sql`
        SELECT id FROM public.users WHERE id = ${userId}::uuid FOR UPDATE
      `
        .returnsRow({ id: 'pg/uuid@1' })
        .build();
      await tx.query(lock);
      await requireActiveUser(tx, userId);
      return work(new CartTransaction(tx, userId));
    });
  }
}
