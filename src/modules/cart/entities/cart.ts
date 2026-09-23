import type { CartItem } from './cart-item.js';

export interface Cart {
  id: string;
  userId: string;
  version: number;
  items: CartItem[];
}
