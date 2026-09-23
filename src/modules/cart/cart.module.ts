import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { CartController } from './cart.controller.js';
import { CartService } from './cart.service.js';
import { CartRepository } from './repositories/cart.repository.js';
import { CartUserGuard } from './auth/cart-user.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [CartController],
  providers: [CartService, CartRepository, CartUserGuard],
  exports: [CartService],
})
export class CartModule {}
