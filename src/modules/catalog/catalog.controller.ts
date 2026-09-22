import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { ProductSlugParamsDto } from './dto/product-slug-params.dto.js';

@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.catalog.list(query);
  }

  @Get(':slug')
  detail(@Param() params: ProductSlugParamsDto) {
    return this.catalog.detail(params.slug);
  }
}
