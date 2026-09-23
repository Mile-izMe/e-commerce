export interface CartVariant {
  id: string;
  name: string;
  priceAmount: bigint;
  currency: string;
  isActive: boolean;
  archivedAt: string | null;
  product: {
    name: string;
    status: string;
    archivedAt: string | null;
    images: { url: string; position: number }[];
  };
  inventory: { onHand: number; reserved: number } | null;
}

export interface CartItem {
  id: string;
  cartId: string;
  variantId: string;
  quantity: number;
  variant: CartVariant;
}
