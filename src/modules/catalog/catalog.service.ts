import { Injectable, NotFoundException } from '@nestjs/common';
import { ProductRepository } from './repositories/product.repository.js';
import type { CatalogProduct } from './entities/catalog-product.js';
import type { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import type {
  ProductListResponseDto,
  ProductResponseDto,
} from './dto/product-response.dto.js';

@Injectable()
export class CatalogService {
  constructor(private readonly products: ProductRepository) {}

  async list(query: ListProductsQueryDto): Promise<ProductListResponseDto> {
    const { products, total } = await this.products.findPage(query);
    return {
      data: products.map((product) => this.toResponse(product)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
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
