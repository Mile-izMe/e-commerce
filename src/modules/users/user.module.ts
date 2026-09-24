import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { UsersService } from './user.service.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserController } from './user.controller.js';
import { AuthGuard } from '../auth/guards/auth.guard.js';
import { UserSessionRepository } from './repositories/user-session.repository.js';
import { UsersSessionService } from './user-session.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [UserController],
  providers: [
    UsersService,
    UserRepository,
    UsersSessionService,
    UserSessionRepository,
    AuthGuard,
  ],
  exports: [UsersService, UsersSessionService],
})
export class UsersModule {}
