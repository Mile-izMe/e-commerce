import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ProductRepository } from './repositories/product.repository.js';
import { CategoryRepository } from './repositories/category.repository.js';
import { CategoryController } from './category.controller.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController, CategoryController],
  providers: [CatalogService, ProductRepository, CategoryRepository],
})
export class CatalogModule {}
