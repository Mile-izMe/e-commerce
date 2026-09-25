import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SuccessMessage } from '../../common/api/success-message.decorator.js';
import { ApiWrappedResponse } from '../../common/api/api-success.decorator.js';
import { CatalogService } from './catalog.service.js';
import { CategoryResponseDto } from './dto/category-response.dto.js';

@ApiTags('catalog')
@Controller('categories')
export class CategoryController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  @SuccessMessage('Categories retrieved')
  @ApiOperation({ summary: 'List active catalog categories' })
  @ApiWrappedResponse(CategoryResponseDto, { isArray: true })
  list(): Promise<CategoryResponseDto[]> {
    return this.catalog.listCategories();
  }
}
