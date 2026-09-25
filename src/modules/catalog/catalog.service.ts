import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { isUUID } from 'class-validator';
import {
  CursorPage,
  decodeCursor,
  encodeCursor,
  paginateCursor,
} from '../../common/api/cursor-pagination.js';
import { ProductRepository } from './repositories/product.repository.js';
import { CategoryRepository } from './repositories/category.repository.js';
import type { Category } from './entities/category.js';
import type { CatalogProduct } from './entities/catalog-product.js';
import type { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import type { ProductResponseDto } from './dto/product-response.dto.js';

interface ProductCursor {
  v: 1;
  createdAt: string;
  id: string;
  category: string | null;
}

function parseProductCursor(
  value: string,
  category: string | null,
): ProductCursor {
  const decoded = decodeCursor(value);
  if (
    typeof decoded !== 'object' ||
    decoded === null ||
    !('v' in decoded) ||
    decoded.v !== 1 ||
    !('createdAt' in decoded) ||
    typeof decoded.createdAt !== 'string' ||
    Number.isNaN(Date.parse(decoded.createdAt)) ||
    !('id' in decoded) ||
    typeof decoded.id !== 'string' ||
    !isUUID(decoded.id) ||
    !('category' in decoded) ||
    decoded.category !== category
  ) {
    throw new BadRequestException('Invalid cursor');
  }
  return decoded as unknown as ProductCursor;
}

@Injectable()
export class CatalogService {
  constructor(
    private readonly products: ProductRepository,
    private readonly categories: CategoryRepository,
  ) {}

  listCategories(): Promise<Category[]> {
    return this.categories.findActive();
  }

  async list(
    query: ListProductsQueryDto,
  ): Promise<CursorPage<ProductResponseDto>> {
    const category = query.category ?? null;
    const after = query.cursor
      ? parseProductCursor(query.cursor, category)
      : undefined;
    const page = await paginateCursor(
      query.limit,
      (take) =>
        this.products.findPage({ take, category: query.category, after }),
      (product) =>
        encodeCursor({
          v: 1,
          createdAt: product.createdAt,
          id: product.id,
          category,
        } satisfies ProductCursor),
    );
    return page.map((product) => this.toResponse(product));
  }

  async detail(slug: string): Promise<ProductResponseDto> {
    const product = await this.products.findBySlug(slug);
    if (!product) throw new NotFoundException('Product not found');
    return this.toResponse(product);
  }

  private toResponse(product: CatalogProduct): ProductResponseDto {
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      category: product.category,
      images: product.images,
      variants: product.variants.map((variant) => ({
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        options: variant.options,
        priceAmount: variant.priceAmount.toString(),
        compareAtAmount: variant.compareAtAmount?.toString() ?? null,
        currency: variant.currency,
        // Informational only; checkout must reserve stock transactionally.
        availableQuantity: Math.max(
          0,
          (variant.inventory?.onHand ?? 0) - (variant.inventory?.reserved ?? 0),
        ),
      })),
    };
  }
}
