import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { CartRepository } from './repositories/cart.repository.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/user.module.js';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule],
  controllers: [CartController],
  providers: [CartService, CartRepository],
  exports: [CartService],
})
export class CartModule {}
