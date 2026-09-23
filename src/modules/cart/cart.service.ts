import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CartRepository } from './repositories/cart.repository.js';
import type { AddToCartDto } from './dto/add-to-cart.dto.js';
import type { CartResponseDto } from './dto/cart-response.dto.js';
import type { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import type { Cart } from './entities/cart.js';
import type { CartVariant } from './entities/cart-item.js';
import { MAX_CART_ITEMS, MAX_CART_ITEM_QUANTITY } from './cart.constants.js';

@Injectable()
export class CartService {
  constructor(private readonly cart: CartRepository) {}

  async getCart(userId: string): Promise<CartResponseDto> {
    return this.toResponse(await this.cart.findCart(userId));
  }

  async addToCart(
    userId: string,
    request: AddToCartDto,
  ): Promise<CartResponseDto> {
    this.validateQuantity(request.quantity);
    const result = await this.cart.withUserLock(userId, async (store) => {
      let cart = await store.findCart();
      const variant = await store.findVariant(request.variantId);
      if (!variant) throw new NotFoundException('Variant not found');
      const item = cart?.items.find(
        (item) => item.variantId === request.variantId,
      );
      const quantity = (item?.quantity ?? 0) + request.quantity;
      this.validateQuantity(quantity);
      this.requirePurchasable(variant, quantity);
      if (!item && (cart?.items.length ?? 0) >= MAX_CART_ITEMS) {
        throw new ConflictException(
          `Cart can contain at most ${MAX_CART_ITEMS} different variants`,
        );
      }
      cart ??= await store.createCart();
      if (item) await store.setQuantity(cart.id, item.id, quantity);
      else await store.createItem(cart.id, variant.id, quantity);
      return store.finish(cart);
    });
    return this.toResponse(result);
  }

  async updateItem(
    userId: string,
    itemId: string,
    request: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    this.validateQuantity(request.quantity);
    const result = await this.cart.withUserLock(userId, async (store) => {
      const cart = await store.findCart();
      const item = cart?.items.find((item) => item.id === itemId);
      if (!cart || !item) throw new NotFoundException('Cart item not found');
      this.requirePurchasable(item.variant, request.quantity);
      if (item.quantity === request.quantity) return cart;
      await store.setQuantity(cart.id, item.id, request.quantity);
      return store.finish(cart);
    });
    return this.toResponse(result);
  }

  async removeItem(userId: string, itemId: string): Promise<CartResponseDto> {
    const result = await this.cart.withUserLock(userId, async (store) => {
      const cart = await store.findCart();
      if (!cart || !cart.items.some((item) => item.id === itemId)) {
        throw new NotFoundException('Cart item not found');
      }
      await store.removeItem(cart.id, itemId);
      return store.finish(cart);
    });
    return this.toResponse(result);
  }

  async clearCart(userId: string): Promise<CartResponseDto> {
    const result = await this.cart.withUserLock(userId, async (store) => {
      const cart = await store.findCart();
      if (!cart || cart.items.length === 0) return cart;
      await store.clearItems(cart.id);
      return store.finish(cart);
    });
    return this.toResponse(result);
  }

  private validateQuantity(quantity: number): void {
    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > MAX_CART_ITEM_QUANTITY
    ) {
      throw new BadRequestException(
        `Quantity must be an integer between 1 and ${MAX_CART_ITEM_QUANTITY}`,
      );
    }
  }

  private availableQuantity(variant: CartVariant): number {
    return Math.max(
      0,
      (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0),
    );
  }

  private isSaleable(variant: CartVariant): boolean {
    return (
      variant.isActive &&
      variant.archivedAt === null &&
      variant.product.status === 'ACTIVE' &&
      variant.product.archivedAt === null
    );
  }

  private requirePurchasable(variant: CartVariant, quantity: number): void {
    if (!this.isSaleable(variant))
      throw new ConflictException('Product is no longer available');
    if (quantity > this.availableQuantity(variant))
      throw new ConflictException('Not enough stock');
  }

  private toResponse(cart: Cart | null): CartResponseDto {
    if (!cart) return { id: null, version: 0, totalQuantity: 0, items: [] };
    return {
      id: cart.id,
      version: cart.version,
      totalQuantity: cart.items.reduce((sum, item) => sum + item.quantity, 0),
      items: cart.items.map((item) => ({
        id: item.id,
        variantId: item.variantId,
        productName: item.variant.product.name,
        variantName: item.variant.name,
        imageUrl: item.variant.product.images[0]?.url ?? null,
        quantity: item.quantity,
        unitPriceAmount: item.variant.priceAmount.toString(),
        lineTotalAmount: (
          item.variant.priceAmount * BigInt(item.quantity)
        ).toString(),
        currency: item.variant.currency,
        availableQuantity: this.availableQuantity(item.variant),
        purchasable:
          this.isSaleable(item.variant) &&
          item.quantity <= this.availableQuantity(item.variant),
      })),
    };
  }
}
