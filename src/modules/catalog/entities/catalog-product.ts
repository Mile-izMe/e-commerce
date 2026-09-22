// Read model used inside Catalog; no dependency on the ORM or HTTP framework.
export interface CatalogProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: { id: string; name: string; slug: string } | null;
  images: {
    id: string;
    url: string;
    altText: string | null;
    position: number;
  }[];
  variants: {
    id: string;
    sku: string;
    name: string;
    options: unknown;
    priceAmount: bigint;
    compareAtAmount: bigint | null;
    currency: string;
    inventory: { onHand: number; reserved: number } | null;
  }[];
}
