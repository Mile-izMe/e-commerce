import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { UsersModule } from '../users/user.module.js';
import { ChatGateway } from './gateways/chat.gateway.js';
import { WsAuthGuard } from './guards/ws-auth.guard.js';
import { MessagingController } from './messaging.controller.js';
import { MessagingRepository } from './messaging.repository.js';
import { MessagingService } from './messaging.service.js';

@Module({
  imports: [DatabaseModule, AuthModule, UsersModule],
  controllers: [MessagingController],
  providers: [MessagingRepository, MessagingService, WsAuthGuard, ChatGateway],
})
export class MessagingModule {}
