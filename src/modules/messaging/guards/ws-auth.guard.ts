import { Injectable } from '@nestjs/common';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { UsersService } from '../../users/user.service.js';
import type { ChatSocket } from '../gateways/chat-socket.js';

@Injectable()
export class WsAuthGuard implements CanActivate {
  constructor(private readonly users: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const socket = context.switchToWs().getClient<ChatSocket>();
    if (
      !socket.data.user ||
      !socket.data.expiresAt ||
      socket.data.expiresAt <= Date.now()
    ) {
      throw new WsException({
        code: 'AUTH_EXPIRED',
        message: 'Reconnect with a fresh access token',
      });
    }
    socket.data.user = await this.users.getForSession(socket.data.user.id);
    return true;
  }
}
