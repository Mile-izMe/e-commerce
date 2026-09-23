import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { UsersService } from './user.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserController } from './user.controller.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [UsersService, UserRepository, AuthGuard],
  exports: [UsersService],
})
export class UsersModule {}
