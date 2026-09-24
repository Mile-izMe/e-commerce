import { Category } from './category.js';
import { ProductImage } from './product-image.js';
import { ProductVariant } from './product-variant.js';

// Read model used inside Catalog; no dependency on the ORM or HTTP framework.
export interface CatalogProduct {
  id: string;
  createdAt: string;
  name: string;
  slug: string;
  description: string | null;
  category: Category | null;
  images: ProductImage[];
  variants: ProductVariant[];
}
