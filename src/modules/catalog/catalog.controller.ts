import { Controller, Get, Param, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service.js';
import { ListProductsQueryDto } from './dto/list-products-query.dto.js';
import { ProductSlugParamsDto } from './dto/product-slug-params.dto.js';
import { SuccessMessage } from '../../common/api/success-message.decorator.js';

@Controller('products')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @SuccessMessage('Products retrieved')
  list(@Query() query: ListProductsQueryDto) {
    return this.catalog.list(query);
  }

  @Get(':slug')
  @SuccessMessage('Product retrieved')
  detail(@Param() params: ProductSlugParamsDto) {
    return this.catalog.detail(params.slug);
  }
}
