export interface ProductResponseDto {
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
    priceAmount: string;
    compareAtAmount: string | null;
    currency: string;
    availableQuantity: number;
  }[];
}

export interface ProductListResponseDto {
  data: ProductResponseDto[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}
