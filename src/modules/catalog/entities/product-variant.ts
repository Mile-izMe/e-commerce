export interface ProductVariant {
  id: string;
  sku: string;
  name: string;
  options: unknown;
  priceAmount: bigint;
  compareAtAmount: bigint | null;
  currency: string;
  inventory: { onHand: number; reserved: number } | null;
}
