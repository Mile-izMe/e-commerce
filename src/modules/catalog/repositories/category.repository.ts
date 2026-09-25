import { Inject, Injectable } from '@nestjs/common';
import { DATABASE } from '../../../infrastructure/database/database.constants.js';
import type { DatabaseClient } from '../../../prisma/db.js';
import type { Category } from '../entities/category.js';

@Injectable()
export class CategoryRepository {
  constructor(@Inject(DATABASE) private readonly database: DatabaseClient) {}

  async findActive(): Promise<Category[]> {
    return this.database.orm.public.Category.where({ isActive: true })
      .select('id', 'name', 'slug')
      .orderBy([
        (category) => category.name.asc(),
        (category) => category.id.asc(),
      ])
      .all();
  }
}
