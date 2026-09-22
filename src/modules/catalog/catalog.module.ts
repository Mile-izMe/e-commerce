import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { ProductRepository } from './repositories/product.repository.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CatalogController],
  providers: [CatalogService, ProductRepository],
})
export class CatalogModule {}
